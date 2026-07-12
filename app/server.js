require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

/* ============================================================
   Configuração
   ============================================================ */
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1"; // não expõe a base na rede local
const DB_PATH = path.join(__dirname, "data", "db.json");

const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || "local-model";
const LMSTUDIO_TIMEOUT_MS = Number(process.env.LMSTUDIO_TIMEOUT_MS || 20000);
const SHEETS_TIMEOUT_MS = Number(process.env.SHEETS_TIMEOUT_MS || 10000);
const SELLER_PASSWORD = process.env.SELLER_PASSWORD || process.env.OWNER_PASSWORD || "12345";

// Se SESSION_SECRET não estiver no .env, gera um por execução:
// funciona, mas invalida as sessões a cada restart do servidor.
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_COOKIE = "autoio_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

const MAX_LOGS = 500;
const STATUS_PENDENTE = "Pendente";
const STATUS_CONCLUIDO = "Concluído";

let sheetsWebhookUrl = process.env.SHEETS_WEBHOOK_URL || "";

const DEFAULT_VENDEDOR = {
  nome: "",
  negocio: "",
  telefone: "",
  endereco: "",
  categoria: "",
  horario: "",
  observacoes: ""
};

const MENU_TEMPLATES = {  // catálogo de partida; a quantidade pronta do dia começa em 0
  doceria: [
    { nome: "Brigadeiro", categoria: "Doces", preco: 2.5, unidade: "unidade", descricao: "Brigadeiro tradicional" },
    { nome: "Beijinho", categoria: "Doces", preco: 2.5, unidade: "unidade", descricao: "Beijinho tradicional" },
    { nome: "Bolo de chocolate", categoria: "Bolos", preco: 45, unidade: "unidade", descricao: "Bolo caseiro de chocolate" },
    { nome: "Cento de docinhos", categoria: "Doces", preco: 120, unidade: "cento", descricao: "Sortido de docinhos para festa" }
  ],
  marmitaria: [
    { nome: "Marmita pequena", categoria: "Marmitas", preco: 16, unidade: "unidade", descricao: "Marmita individual pequena" },
    { nome: "Marmita média", categoria: "Marmitas", preco: 20, unidade: "unidade", descricao: "Marmita individual média" },
    { nome: "Marmita grande", categoria: "Marmitas", preco: 24, unidade: "unidade", descricao: "Marmita individual grande" },
    { nome: "Sobremesa", categoria: "Extras", preco: 7, unidade: "unidade", descricao: "Sobremesa do dia" }
  ],
  salgados: [
    { nome: "Coxinha", categoria: "Salgados", preco: 5, unidade: "unidade", descricao: "Coxinha tradicional" },
    { nome: "Kibe", categoria: "Salgados", preco: 5, unidade: "unidade", descricao: "Kibe frito" },
    { nome: "Empada", categoria: "Salgados", preco: 6, unidade: "unidade", descricao: "Empada recheada" },
    { nome: "Cento de salgados", categoria: "Salgados", preco: 95, unidade: "cento", descricao: "Sortido de salgados para evento" }
  ]
};

/* ============================================================
   Middlewares base
   Correção 3: CORS restrito à própria origem (antes: cors() aberto,
   o que permitia a qualquer site chamar a API local do vendedor).
   ============================================================ */
const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN,
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não autorizada."));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   Sessão do vendedor (cookie assinado, sem dependência extra)
   Correção 3: antes o /api/login só devolvia ok:true/false e o
   front guardava a "sessão" no sessionStorage. Nenhuma rota era
   protegida: qualquer um com acesso à porta lia /api/data,
   exportava clientes, apagava a base ou trocava o webhook do
   Sheets (exfiltração de pedidos).
   ============================================================ */
function signSession(expiresAt) {
  const payload = `vendedor.${expiresAt}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token) return false;
  const parts = String(token).split(".");
  if (parts.length !== 3) return false;

  const [role, expiresAt, signature] = parts;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`${role}.${expiresAt}`).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  return role === "vendedor" && Number(expiresAt) > Date.now();
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const index = part.indexOf("=");
    if (index === -1) return acc;
    acc[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return acc;
  }, {});
}

function isAuthenticated(req) {
  return verifySession(parseCookies(req)[SESSION_COOKIE]);
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: "Sessão do vendedor necessária." });
  }
  next();
}

// Correção 4: Express 4 não captura rejeição de promise em handler async.
// Sem isso, um erro depois de um await deixava a requisição pendurada.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/* ============================================================
   Banco local (data/db.json)
   ============================================================ */
function emptyDb() {
  return {
    vendedor: { ...DEFAULT_VENDEDOR },
    clientes: [],
    cardapio: [],
    pedidos: [],
    tarefas: [],
    logs: []
  };
}

function normalizeDb(raw = {}) {
  const db = {
    vendedor: { ...DEFAULT_VENDEDOR, ...(raw.vendedor || {}) },
    clientes: Array.isArray(raw.clientes) ? raw.clientes : [],
    cardapio: Array.isArray(raw.cardapio) ? raw.cardapio : [],
    pedidos: Array.isArray(raw.pedidos) ? raw.pedidos : [],
    tarefas: Array.isArray(raw.tarefas) ? raw.tarefas : [],
    logs: Array.isArray(raw.logs) ? raw.logs : []
  };
  if (db.logs.length > MAX_LOGS) db.logs = db.logs.slice(0, MAX_LOGS); // logs não crescem sem limite

  // Cardápio do dia: garante os campos novos em bases antigas.
  db.cardapio = db.cardapio.map(item => ({
    ...item,
    quantidade: parseQuantidade(item.quantidade),
    disponivel: item.disponivel !== false
  }));

  return db;
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    writeDb(emptyDb());
  }
}

function readDb() {
  ensureDb();
  try {
    return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
  } catch (err) {
    // Base corrompida: preserva o arquivo para inspeção e recomeça em vez de derrubar todas as rotas.
    const backup = `${DB_PATH}.corrompido-${Date.now()}`;
    try { fs.renameSync(DB_PATH, backup); } catch (_) { /* ignora */ }
    console.error(`db.json inválido (${err.message}). Backup salvo em ${backup}.`);
    const fresh = emptyDb();
    fresh.logs.unshift({ dataHora: nowBR(), tipo: "erro", mensagem: "db.json estava corrompido e foi reiniciado", origem: "server" });
    writeDb(fresh);
    return fresh;
  }
}

// Correção 5: escrita atômica (tmp + rename). Antes, um crash no meio
// do writeFileSync deixava o db.json truncado/corrompido.
function writeDb(db) {
  const data = normalizeDb(db);
  const tmpPath = `${DB_PATH}.tmp`;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, DB_PATH);
  return data;
}

/* ============================================================
   Utilidades
   ============================================================ */
function nowBR() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function addLog(db, tipo, mensagem, origem = "server") {
  db.logs.unshift({ dataHora: nowBR(), tipo, mensagem, origem });
  if (db.logs.length > MAX_LOGS) db.logs.length = MAX_LOGS;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isDoneStatus(status) {
  return normalize(status) === "concluido";
}

// Status canônico: o front, o CSS e o backend agora falam a mesma língua.
function canonicalStatus(status) {
  return isDoneStatus(status) ? STATUS_CONCLUIDO : STATUS_PENDENTE;
}

// Unidades prontas para retirada agora. Nunca negativo, sempre inteiro.
function parseQuantidade(value) {
  const n = Math.floor(Number(String(value ?? "0").replace(",", ".")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value || "0").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function extractQuantityNumber(value) {
  const text = normalize(value);
  if (text.includes("meio cento")) return 50;
  if (text.includes("cento")) return 100;
  if (text.includes("meia duzia")) return 6;
  if (text.includes("duzia")) return 12;
  const match = String(value || "").match(/\d+(?:[.,]\d+)?/);
  return match ? parseMoney(match[0]) : 0;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Tempo limite de ${timeoutMs}ms excedido ao chamar ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function findCliente(db, clienteId) {
  if (!clienteId) return null;
  return db.clientes.find(cliente => cliente.id === clienteId) || null;
}

function findMenuItem(db, text) {
  const needle = normalize(text);
  if (!needle) return null;
  const disponiveis = db.cardapio.filter(item => item.disponivel !== false && item.nome);
  // Prioriza o item de nome mais longo contido no texto ("Bolo de chocolate" antes de "Bolo").
  return disponiveis
    .filter(item => needle.includes(normalize(item.nome)))
    .sort((a, b) => normalize(b.nome).length - normalize(a.nome).length)[0] || null;
}

function enrichPedidoWithContext(db, pedido, message, cliente) {
  const menuItem = findMenuItem(db, `${pedido.produto} ${message}`);
  const quantidadeNumero = extractQuantityNumber(pedido.quantidade);
  const precoUnitario = menuItem ? parseMoney(menuItem.preco) : 0;

  return {
    ...pedido,
    clienteId: cliente?.id || pedido.clienteId || "",
    cliente: cliente?.nome || pedido.cliente || "A confirmar",
    telefone: cliente?.telefone || pedido.telefone || "",
    endereco: pedido.endereco && pedido.endereco !== "A confirmar" ? pedido.endereco : (cliente?.endereco || "A confirmar"),
    itemCardapioId: menuItem?.id || "",
    precoUnitario: menuItem ? precoUnitario : "",
    valorEstimado: menuItem && quantidadeNumero ? Number((precoUnitario * quantidadeNumero).toFixed(2)) : "",
    precisaConfirmar: !menuItem || !quantidadeNumero || pedido.produto === "A confirmar"
  };
}

/* ============================================================
   Classificação: IA local + fallback por regras
   ============================================================ */
const TIPOS_VALIDOS = ["pedido", "tarefa", "conversa"];

// Correção 1: o tipo devolvido pela IA agora é normalizado e validado.
// Antes, "Pedido" (maiúsculo) ou qualquer variação não batia com nenhum
// if e o registro era descartado em silêncio — enquanto o chat exibia
// "Pedido registrado" para o vendedor.
function coerceTipo(value) {
  const tipo = normalize(value).trim();
  if (TIPOS_VALIDOS.includes(tipo)) return tipo;
  if (tipo.startsWith("pedido") || tipo === "order") return "pedido";
  if (tipo.startsWith("tarefa") || tipo === "task") return "tarefa";
  if (tipo.startsWith("conversa") || tipo === "chat") return "conversa";
  return null;
}

function fallbackAnalyze(message, role = "cliente", db = emptyDb(), cliente = null) {
  const t = normalize(message);
  const taskWords = ["lembra", "lembrar", "comprar", "fazer", "tarefa", "anotar", "agenda", "preparar", "organizar", "resolver"];
  const menuWords = db.cardapio.map(item => normalize(item.nome)).filter(Boolean);
  const orderWords = [
    "quero", "pedido", "encomenda", "encomendar", "bolo", "brigadeiro", "docinho",
    "marmita", "cento", "unidade", "entrega", "retirar", "pix", ...menuWords
  ];

  let tipo = "conversa";
  if (role === "vendedor" && taskWords.some(w => t.includes(w)) && !orderWords.some(w => t.includes(w))) tipo = "tarefa";
  else if (orderWords.some(w => t.includes(w))) tipo = "pedido";
  else if (taskWords.some(w => t.includes(w))) tipo = "tarefa";

  const products = [
    ...db.cardapio.map(item => item.nome).filter(Boolean),
    "brigadeiro", "bolo", "docinho", "marmita", "beijinho", "cupcake", "salgado", "coxinha"
  ];
  const produto = products.find(p => t.includes(normalize(p))) || "A confirmar";
  const qtdMatch = String(message).match(/(\d+)\s?(cento|unidades|unidade|un|bolos|marmitas|doces|brigadeiros)?/i);
  const quantidade = qtdMatch ? qtdMatch[0] : (t.includes("cento") ? "1 cento" : "A confirmar");

  let dataEntrega = "A confirmar";
  if (t.includes("amanha")) dataEntrega = "Amanhã";
  if (t.includes("sabado")) dataEntrega = "Sábado";
  if (t.includes("sexta")) dataEntrega = "Sexta-feira";
  if (t.includes("domingo")) dataEntrega = "Domingo";
  if (t.includes("hoje")) dataEntrega = "Hoje";

  const pagamento = t.includes("pix") ? "Pix" : t.includes("cartao") ? "Cartão" : t.includes("dinheiro") ? "Dinheiro" : "A confirmar";
  const clienteMatch = String(message).match(/cliente\s+([A-Za-zÀ-ÿ ]+?)\s+(pediu|quer|solicitou|encomendou)/i);

  return {
    tipo,
    confianca: 0.6,
    pedido: {
      cliente: cliente?.nome || (clienteMatch ? clienteMatch[1].trim() : (role === "cliente" ? "Cliente do chat" : "Cliente informado")),
      telefone: cliente?.telefone || "",
      produto,
      quantidade,
      dataEntrega,
      horarioEntrega: "",
      pagamento,
      endereco: t.includes("retirar") || t.includes("retirada") ? "Retirada no local" : (cliente?.endereco || "A confirmar"),
      observacoes: message
    },
    tarefa: {
      descricao: message,
      prazo: dataEntrega === "A confirmar" ? "Sem prazo" : dataEntrega,
      prioridade: "Normal"
    },
    resposta: tipo === "pedido"
      ? `Pedido registrado com sucesso. Produto: ${produto}. Quantidade: ${quantidade}. Entrega: ${dataEntrega}.`
      : tipo === "tarefa"
        ? `Tarefa salva com sucesso. ${message}`
        : "Oi! Eu sou a Auto.io. Posso registrar pedidos e tarefas da rotina."
  };
}

function extractJson(text) {
  if (!text) throw new Error("Resposta vazia do modelo.");
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("O modelo não retornou JSON válido.");
  }
}

async function analyzeWithLMStudio(message, role, db = emptyDb(), cliente = null) {
  const cardapioDoDia = db.cardapio.filter(item => item.disponivel !== false);
  const itensRecorrentesResumo = cardapioDoDia.length
    ? cardapioDoDia
        .map(item => {
          const preco = `R$ ${item.preco || "a confirmar"} por ${item.unidade || "unidade"}`;
          const pronto = item.quantidade > 0
            ? `${item.quantidade} pronto(s) para retirada hoje`
            : "esgotado hoje, só sob encomenda";
          return `- ${item.nome} (${item.categoria || "sem categoria"}): ${preco}. ${pronto}.`;
        })
        .join("\n")
    : "Nenhum item no cardápio do dia. Use A confirmar quando o produto não estiver claro.";

  const prompt = `
Você é a IA operacional da Auto.io, uma assistente para vendedores e pequenos negócios com pedidos personalizados.

Sua tarefa é transformar uma mensagem informal em dados estruturados.

Classifique a mensagem como:
- "pedido": pedido de cliente, encomenda personalizada, compra, entrega, retirada, bolo, doces, marmita etc.
- "tarefa": lembrete interno, compra de insumo, rotina do vendedor ou organização da produção.
- "conversa": saudação, dúvida genérica ou mensagem sem registro operacional.

Regras:
- Responda SOMENTE com JSON válido.
- Não use markdown.
- O campo "tipo" deve ser exatamente "pedido", "tarefa" ou "conversa", em minúsculas.
- Se faltar dado, use "A confirmar".
- Seja conservadora: se parece pedido, classifique como pedido.
- A resposta ao usuário deve ser curta, educada e em português.
- Quando houver cliente identificado, use os dados dele no pedido.
- O cardápio do dia lista o que está pronto para retirada agora. Não é catálogo fechado: encomendas sob medida continuam valendo.
- Quando um produto combinar com um item do cardápio, use o nome desse item.
- Se o cliente pedir pronta retirada de um item esgotado hoje, registre o pedido e avise na resposta que ele sai sob encomenda.
- Quando for pedido sob medida, mantenha os detalhes em observações e use "A confirmar" no que faltar.

Formato obrigatório:
{
  "tipo": "pedido|tarefa|conversa",
  "confianca": 0.0,
  "pedido": {
    "cliente": "string",
    "telefone": "string",
    "produto": "string",
    "quantidade": "string",
    "dataEntrega": "string",
    "horarioEntrega": "string",
    "pagamento": "string",
    "endereco": "string",
    "observacoes": "string"
  },
  "tarefa": {
    "descricao": "string",
    "prazo": "string",
    "prioridade": "Baixa|Normal|Alta"
  },
  "resposta": "string"
}

Papel de quem digitou: ${role}
Vendedor: ${db.vendedor.negocio || db.vendedor.nome || "Não cadastrado"}
Cliente identificado: ${cliente ? `${cliente.nome}, telefone ${cliente.telefone || "não informado"}, endereço ${cliente.endereco || "não informado"}` : "Nenhum"}
Cardápio do dia (pronta retirada):
${itensRecorrentesResumo}
Mensagem: ${message}
`;

  // Correção 2: timeout no fetch. Sem AbortController, um LM Studio
  // ligado mas travado deixava a requisição pendurada para sempre e o
  // fallback por regras nunca era acionado.
  const response = await fetchWithTimeout(`${LMSTUDIO_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer lm-studio"
    },
    body: JSON.stringify({
      model: LMSTUDIO_MODEL,
      messages: [
        { role: "system", content: "Você é um extrator de dados. Responda apenas JSON válido, sem markdown." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 900
    })
  }, LMSTUDIO_TIMEOUT_MS);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  const tipo = coerceTipo(parsed?.tipo);

  if (!tipo) {
    throw new Error(`A IA retornou um tipo inválido: ${JSON.stringify(parsed?.tipo)}`);
  }

  return { ...parsed, tipo, origemIA: "lm-studio-local" };
}

async function sendToSheets(tipo, payload) {
  const url = sheetsWebhookUrl;
  if (!url) return { ok: false, motivo: "SHEETS_WEBHOOK_URL não configurado" };

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ tipo, payload })
  }, SHEETS_TIMEOUT_MS);

  return { ok: response.ok, status: response.status };
}

// O envio ao Sheets é acessório: nunca deve derrubar o registro local.
async function trySheets(db, tipo, payload, mensagemOk) {
  try {
    const sheets = await sendToSheets(tipo, payload);
    if (sheets.ok) addLog(db, "sheets", mensagemOk, "server");
  } catch (err) {
    addLog(db, "erro_sheets", err.message, "server");
  }
}

function listByKind(db, kind) {
  if (kind === "pedidos") return db.pedidos;
  if (kind === "tarefas") return db.tarefas;
  if (kind === "clientes") return db.clientes;
  if (kind === "cardapio") return db.cardapio;
  return null;
}

/* ============================================================
   Rotas públicas (usadas pela tela de registro de mensagem)
   ============================================================ */
app.post("/api/login", (req, res) => {
  const password = String(req.body?.password || "");
  const expected = Buffer.from(SELLER_PASSWORD);
  const received = Buffer.from(password);
  const ok = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!ok) return res.status(401).json({ ok: false, error: "Senha incorreta." });

  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.setHeader("Set-Cookie", [
    `${SESSION_COOKIE}=${signSession(expiresAt)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ]);
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", [`${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`]);
  res.json({ ok: true });
});

app.get("/api/session", (req, res) => {
  res.json({ ok: true, autenticado: isAuthenticated(req) });
});

// Cardápio do dia visto por quem manda a mensagem: só o que está no cardápio,
// sem ids internos, origem ou dados do negócio. Prontos primeiro.
app.get("/api/cardapio-do-dia", (req, res) => {
  const itens = readDb().cardapio
    .filter(item => item.disponivel !== false)
    .map(item => ({
      nome: item.nome,
      categoria: item.categoria || "",
      descricao: item.descricao || "",
      preco: item.preco,
      unidade: item.unidade || "unidade",
      quantidade: Number(item.quantidade) || 0,
      pronto: Number(item.quantidade) > 0
    }))
    .sort((a, b) => Number(b.pronto) - Number(a.pronto));

  res.json({ ok: true, itens, atualizadoEm: nowBR() });
});

// Só o número de pendências, para o selo da tela inicial (sem expor dados).
app.get("/api/pendentes", (req, res) => {
  const db = readDb();
  const pendentes = [
    ...db.pedidos.filter(p => !isDoneStatus(p.status)),
    ...db.tarefas.filter(t => !isDoneStatus(t.status))
  ].length;
  res.json({ ok: true, pendentes });
});

app.post("/api/clientes", asyncHandler(async (req, res) => {
  const db = readDb();
  const p = req.body || {};
  if (!p.nome || !String(p.nome).trim()) {
    return res.status(400).json({ ok: false, error: "Informe o nome do cliente." });
  }

  const telefone = String(p.telefone || "").trim();
  // Dedup por dígitos: "(91) 99999-9999" e "91999999999" são o mesmo cliente.
  const telefoneDigits = onlyDigits(telefone);
  const existing = telefoneDigits
    ? db.clientes.find(cliente => onlyDigits(cliente.telefone) === telefoneDigits)
    : null;

  const cliente = {
    id: existing?.id || makeId("CLI"),
    nome: String(p.nome || "").trim(),
    telefone,
    endereco: String(p.endereco || "").trim(),
    observacoes: String(p.observacoes || "").trim(),
    criadoEm: existing?.criadoEm || nowBR(),
    atualizadoEm: nowBR()
  };

  if (existing) Object.assign(existing, cliente);
  else db.clientes.unshift(cliente);

  addLog(db, "cliente", `Cliente identificado: ${cliente.nome}`, "server");
  await trySheets(db, "cliente", cliente, "Cliente enviado ao Google Sheets");
  writeDb(db);

  // A tela do cliente não recebe a base inteira; só o painel autenticado recebe.
  res.json({ ok: true, saved: cliente, data: isAuthenticated(req) ? db : undefined });
}));

app.post("/api/message", asyncHandler(async (req, res) => {
  const { message, role, clienteId } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ ok: false, error: "Mensagem vazia." });
  }

  const db = readDb();
  const cliente = findCliente(db, clienteId);
  const papel = role === "vendedor" ? "vendedor" : "cliente";

  let analysis;
  try {
    analysis = await analyzeWithLMStudio(message, papel, db, cliente);
    addLog(db, "ia", "Mensagem analisada pela IA local do LM Studio", "lm-studio");
  } catch (err) {
    analysis = { ...fallbackAnalyze(message, papel, db, cliente), origemIA: "fallback-regra" };
    addLog(db, "erro_ia", err.message, "lm-studio");
  }

  // Rede de segurança: se algo escapar, cai em "conversa" e fica registrado no log,
  // em vez de sumir sem deixar rastro.
  const tipo = coerceTipo(analysis.tipo);
  if (!tipo) {
    addLog(db, "erro_ia", `Tipo não reconhecido (${analysis.tipo}). Mensagem registrada como conversa.`, "server");
    analysis.tipo = "conversa";
  } else {
    analysis.tipo = tipo;
  }

  let saved = null;

  if (analysis.tipo === "pedido") {
    const pedidoBase = {
      id: makeId("PED"),
      dataHora: nowBR(),
      cliente: analysis.pedido?.cliente || "A confirmar",
      telefone: analysis.pedido?.telefone || "",
      produto: analysis.pedido?.produto || "A confirmar",
      quantidade: analysis.pedido?.quantidade || "A confirmar",
      dataEntrega: analysis.pedido?.dataEntrega || "A confirmar",
      horarioEntrega: analysis.pedido?.horarioEntrega || "",
      pagamento: analysis.pedido?.pagamento || "A confirmar",
      endereco: analysis.pedido?.endereco || "A confirmar",
      observacoes: analysis.pedido?.observacoes || message,
      status: STATUS_PENDENTE,
      origem: analysis.origemIA || "ia"
    };
    const pedido = enrichPedidoWithContext(db, pedidoBase, message, cliente);
    db.pedidos.unshift(pedido);
    saved = pedido;
    addLog(db, "pedido", `Pedido registrado: ${pedido.produto}`, "server");
    await trySheets(db, "pedido", pedido, "Pedido enviado ao Google Sheets");
  }

  if (analysis.tipo === "tarefa") {
    const tarefa = {
      id: makeId("TAR"),
      dataHora: nowBR(),
      tarefa: analysis.tarefa?.descricao || message,
      prazo: analysis.tarefa?.prazo || "Sem prazo",
      prioridade: analysis.tarefa?.prioridade || "Normal",
      status: STATUS_PENDENTE,
      origem: analysis.origemIA || "ia"
    };
    db.tarefas.unshift(tarefa);
    saved = tarefa;
    addLog(db, "tarefa", `Tarefa registrada: ${tarefa.tarefa}`, "server");
    await trySheets(db, "tarefa", tarefa, "Tarefa enviada ao Google Sheets");
  }

  if (analysis.tipo === "conversa") {
    addLog(db, "conversa", message, "server");
  }

  writeDb(db);
  res.json({ ok: true, analysis, saved, data: isAuthenticated(req) ? db : undefined });
}));

/* ============================================================
   Rotas do painel do vendedor (exigem sessão)
   ============================================================ */
app.get("/api/health", requireAuth, asyncHandler(async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${LMSTUDIO_BASE_URL}/models`, {
      headers: { "Authorization": "Bearer lm-studio" }
    }, 5000);
    const models = response.ok ? await response.json() : null;
    res.json({ ok: true, lmstudio: response.ok, baseUrl: LMSTUDIO_BASE_URL, configuredModel: LMSTUDIO_MODEL, models });
  } catch (err) {
    res.json({ ok: true, lmstudio: false, baseUrl: LMSTUDIO_BASE_URL, configuredModel: LMSTUDIO_MODEL, error: err.message });
  }
}));

app.get("/api/data", requireAuth, (req, res) => {
  res.json(readDb());
});

app.get("/api/templates", requireAuth, (req, res) => {
  res.json({ ok: true, templates: MENU_TEMPLATES });
});

app.get("/api/settings", requireAuth, (req, res) => {
  res.json({
    ok: true,
    sheetsConfigured: Boolean(sheetsWebhookUrl),
    lmstudioBaseUrl: LMSTUDIO_BASE_URL,
    lmstudioModel: LMSTUDIO_MODEL
  });
});

app.post("/api/settings", requireAuth, (req, res) => {
  const url = String(req.body?.sheetsWebhookUrl || "").trim();
  // Só aceita https (o webhook do Apps Script é https). Evita apontar o
  // envio de pedidos para um endereço arbitrário por engano.
  if (url && !/^https:\/\//i.test(url)) {
    return res.status(400).json({ ok: false, error: "Informe uma URL https válida do Apps Script." });
  }

  sheetsWebhookUrl = url;
  const db = readDb();
  addLog(db, "config", url ? "URL do Google Sheets configurada no backend" : "URL do Google Sheets removida do backend", "server");
  writeDb(db);
  res.json({ ok: true, sheetsConfigured: Boolean(sheetsWebhookUrl), data: db });
});

app.post("/api/sheets-test", requireAuth, asyncHandler(async (req, res) => {
  const db = readDb();
  try {
    const sheets = await sendToSheets("teste", {
      mensagem: "Teste de conexao a partir do painel Auto.io",
      dataHora: nowBR()
    });

    if (!sheets.ok) {
      addLog(db, "erro_sheets", sheets.motivo || `Google Sheets respondeu ${sheets.status}`, "server");
      writeDb(db);
      return res.status(400).json({ ok: false, error: sheets.motivo || "Não foi possível confirmar o envio ao Google Sheets.", data: db });
    }

    addLog(db, "sheets", "Teste enviado ao Google Sheets", "server");
    writeDb(db);
    res.json({ ok: true, data: db });
  } catch (err) {
    addLog(db, "erro_sheets", err.message, "server");
    writeDb(db);
    res.status(502).json({ ok: false, error: err.message, data: db });
  }
}));

app.post("/api/vendedor", requireAuth, (req, res) => {
  const db = readDb();
  db.vendedor = { ...DEFAULT_VENDEDOR, ...(req.body || {}) };
  addLog(db, "vendedor", "Perfil do vendedor atualizado", "server");
  writeDb(db);
  res.json({ ok: true, saved: db.vendedor, data: db });
});

app.post("/api/cardapio/templates", requireAuth, (req, res) => {
  const db = readDb();
  const key = req.body?.template;
  const template = MENU_TEMPLATES[key];
  if (!template) return res.status(400).json({ ok: false, error: "Template de cardápio inválido." });

  const added = template.map(item => ({
    id: makeId("ITEM"),
    ...item,
    quantidade: 0, // nada pronto ainda: a vendedora informa o que assou hoje
    disponivel: true,
    origem: "template",
    atualizadoEm: nowBR()
  }));
  db.cardapio.unshift(...added);
  addLog(db, "cardapio", `Template adicionado ao cardápio: ${key}`, "server");
  writeDb(db);
  res.json({ ok: true, added, data: db });
});

app.post("/api/cardapio", requireAuth, (req, res) => {
  const db = readDb();
  const p = req.body || {};
  if (!p.nome || !String(p.nome).trim()) {
    return res.status(400).json({ ok: false, error: "Informe o nome do item." });
  }

  const item = {
    id: makeId("ITEM"),
    nome: String(p.nome || "").trim(),
    categoria: String(p.categoria || "Personalizado").trim(),
    preco: parseMoney(p.preco),
    unidade: String(p.unidade || "unidade").trim(),
    quantidade: parseQuantidade(p.quantidade), // unidades prontas para retirada hoje
    descricao: String(p.descricao || "").trim(),
    disponivel: p.disponivel !== false,
    origem: "personalizado",
    atualizadoEm: nowBR()
  };

  db.cardapio.unshift(item);
  addLog(db, "cardapio", `Item no cardápio do dia: ${item.nome} (${item.quantidade} pronto(s))`, "server");
  writeDb(db);
  res.json({ ok: true, saved: item, data: db });
});

app.patch("/api/cardapio/:id", requireAuth, (req, res) => {
  const db = readDb();
  const item = db.cardapio.find(row => row.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Item não encontrado." });

  const p = req.body || {};
  Object.assign(item, {
    nome: p.nome !== undefined ? String(p.nome).trim() : item.nome,
    categoria: p.categoria !== undefined ? String(p.categoria).trim() : item.categoria,
    preco: p.preco !== undefined ? parseMoney(p.preco) : item.preco,
    unidade: p.unidade !== undefined ? String(p.unidade).trim() : item.unidade,
    quantidade: p.quantidade !== undefined ? parseQuantidade(p.quantidade) : item.quantidade,
    descricao: p.descricao !== undefined ? String(p.descricao).trim() : item.descricao,
    disponivel: p.disponivel !== undefined ? Boolean(p.disponivel) : item.disponivel,
    atualizadoEm: nowBR()
  });

  addLog(db, "cardapio", `Cardápio atualizado: ${item.nome} (${item.quantidade} pronto(s))`, "server");
  writeDb(db);
  res.json({ ok: true, saved: item, data: db });
});

// Fim do expediente: zera o que estava pronto para retirada, mantendo o catálogo.
app.post("/api/cardapio/encerrar-dia", requireAuth, (req, res) => {
  const db = readDb();
  const comEstoque = db.cardapio.filter(item => item.quantidade > 0).length;
  db.cardapio = db.cardapio.map(item => ({ ...item, quantidade: 0, atualizadoEm: nowBR() }));

  addLog(db, "cardapio", `Dia encerrado: ${comEstoque} item(ns) zerado(s) no cardápio`, "server");
  writeDb(db);
  res.json({ ok: true, data: db });
});

app.post("/api/manual-order", requireAuth, asyncHandler(async (req, res) => {
  const db = readDb();
  const p = req.body || {};
  const pedido = enrichPedidoWithContext(db, {
    id: makeId("PED"),
    dataHora: nowBR(),
    cliente: p.cliente || "A confirmar",
    telefone: p.telefone || "",
    produto: p.produto || "A confirmar",
    quantidade: p.quantidade || "A confirmar",
    dataEntrega: p.dataEntrega || "A confirmar",
    horarioEntrega: p.horarioEntrega || "",
    pagamento: p.pagamento || "A confirmar",
    endereco: p.endereco || "A confirmar",
    observacoes: p.observacoes || "",
    status: STATUS_PENDENTE,
    origem: "manual"
  }, `${p.produto || ""} ${p.observacoes || ""}`, null);

  db.pedidos.unshift(pedido);
  addLog(db, "pedido", `Pedido manual registrado: ${pedido.produto}`, "server");
  await trySheets(db, "pedido", pedido, "Pedido manual enviado ao Google Sheets");

  writeDb(db);
  res.json({ ok: true, saved: pedido, data: db });
}));

app.post("/api/manual-task", requireAuth, asyncHandler(async (req, res) => {
  const db = readDb();
  const p = req.body || {};
  const tarefa = {
    id: makeId("TAR"),
    dataHora: nowBR(),
    tarefa: p.tarefa || p.descricao || "Tarefa sem descrição",
    prazo: p.prazo || "Sem prazo",
    prioridade: p.prioridade || "Normal",
    status: STATUS_PENDENTE,
    origem: "manual"
  };

  db.tarefas.unshift(tarefa);
  addLog(db, "tarefa", `Tarefa manual registrada: ${tarefa.tarefa}`, "server");
  await trySheets(db, "tarefa", tarefa, "Tarefa manual enviada ao Google Sheets");

  writeDb(db);
  res.json({ ok: true, saved: tarefa, data: db });
}));

// Status só existe em pedidos e tarefas (antes dava para gravar "status" dentro de um cliente).
app.patch("/api/:kind/:id/status", requireAuth, asyncHandler(async (req, res) => {
  const kind = req.params.kind;
  if (!["pedidos", "tarefas"].includes(kind)) {
    return res.status(400).json({ ok: false, error: "Status só se aplica a pedidos e tarefas." });
  }

  const db = readDb();
  const item = listByKind(db, kind).find(row => row.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Registro não encontrado." });

  const nextStatus = req.body?.status
    ? canonicalStatus(req.body.status)
    : (isDoneStatus(item.status) ? STATUS_PENDENTE : STATUS_CONCLUIDO);

  item.status = nextStatus;
  addLog(db, kind === "pedidos" ? "pedido" : "tarefa", `Status atualizado para "${nextStatus}" (${item.id})`, "server");
  await trySheets(db, "atualizacao", { kind, id: item.id, status: item.status }, "Status enviado ao Google Sheets");

  writeDb(db);
  res.json({ ok: true, saved: item, data: db });
}));

app.delete("/api/:kind/:id", requireAuth, (req, res) => {
  const kind = req.params.kind;
  const db = readDb();
  const list = listByKind(db, kind);
  if (!list) return res.status(404).json({ ok: false, error: "Tipo inválido." });

  const before = list.length;
  db[kind] = list.filter(row => row.id !== req.params.id);
  if (db[kind].length === before) {
    return res.status(404).json({ ok: false, error: "Registro não encontrado." });
  }

  addLog(db, kind === "pedidos" ? "pedido" : kind, `Registro excluído (${req.params.id})`, "server");
  writeDb(db);
  res.json({ ok: true, data: db });
});

app.post("/api/clear", requireAuth, (req, res) => {
  const current = readDb();
  const db = {
    ...emptyDb(),
    vendedor: current.vendedor,
    cardapio: current.cardapio,
    logs: [{ dataHora: nowBR(), tipo: "sistema", mensagem: "Base reiniciada", origem: "server" }]
  };
  writeDb(db);
  res.json({ ok: true, data: db });
});

/* ============================================================
   Exportação CSV
   ============================================================ */
const EXPORTAVEIS = ["pedidos", "tarefas", "clientes", "cardapio", "logs"];

// Evita CSV injection: célula iniciada por = + - @ vira fórmula no Excel/Sheets.
function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

app.get("/api/export/:type", requireAuth, (req, res) => {
  const type = req.params.type;
  if (!EXPORTAVEIS.includes(type)) return res.status(404).send("Tipo inválido.");

  const rows = readDb()[type];
  if (!rows.length) return res.status(404).send("Sem dados.");

  // União das chaves: antes, se o primeiro registro tivesse menos campos, colunas sumiam.
  const cols = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const csv = [
    cols.join(";"),
    ...rows.map(row => cols.map(c => csvCell(row[c])).join(";"))
  ].join("\n");

  res.setHeader("Content-Type", "text/csv;charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${type}-autoio.csv"`);
  res.send("\uFEFF" + csv); // BOM: acentos abrem corretamente no Excel
});

/* ============================================================
   404 e tratamento central de erros (correção 4)
   ============================================================ */
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: "Rota não encontrada." });
});

app.use((err, req, res, next) => {
  console.error("Erro não tratado:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: "Erro interno no servidor Auto.io." });
});

if (require.main === module) {
  ensureDb();
  app.listen(PORT, HOST, () => {
    console.log(`Auto.io rodando em http://${HOST}:${PORT}`);
    console.log(`LM Studio endpoint: ${LMSTUDIO_BASE_URL}/chat/completions (timeout ${LMSTUDIO_TIMEOUT_MS}ms)`);
    if (!process.env.SESSION_SECRET) {
      console.log("Aviso: SESSION_SECRET não definido no .env. As sessões do vendedor caem a cada restart.");
    }
  });
}

module.exports = { app, ensureDb, readDb, writeDb };