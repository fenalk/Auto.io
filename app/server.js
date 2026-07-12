require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");

const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || "http://localhost:1234/v1";
const LMSTUDIO_MODEL = process.env.LMSTUDIO_MODEL || "local-model";
const SELLER_PASSWORD = process.env.SELLER_PASSWORD || process.env.OWNER_PASSWORD || "12345";
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

const MENU_TEMPLATES = {
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

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

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
  return {
    vendedor: { ...DEFAULT_VENDEDOR, ...(raw.vendedor || {}) },
    clientes: Array.isArray(raw.clientes) ? raw.clientes : [],
    cardapio: Array.isArray(raw.cardapio) ? raw.cardapio : [],
    pedidos: Array.isArray(raw.pedidos) ? raw.pedidos : [],
    tarefas: Array.isArray(raw.tarefas) ? raw.tarefas : [],
    logs: Array.isArray(raw.logs) ? raw.logs : []
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(normalizeDb(db), null, 2));
}

function nowBR() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function addLog(db, tipo, mensagem, origem = "server") {
  db.logs.unshift({ dataHora: nowBR(), tipo, mensagem, origem });
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

function findCliente(db, clienteId) {
  if (!clienteId) return null;
  return db.clientes.find(cliente => cliente.id === clienteId) || null;
}

function findMenuItem(db, text) {
  const needle = normalize(text);
  if (!needle) return null;
  return db.cardapio.find(item => item.disponivel !== false && normalize(item.nome).includes(needle))
    || db.cardapio.find(item => item.disponivel !== false && needle.includes(normalize(item.nome)))
    || null;
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
  const itensRecorrentesResumo = db.cardapio.length
    ? db.cardapio
        .filter(item => item.disponivel !== false)
        .map(item => `- ${item.nome} (${item.categoria || "sem categoria"}): R$ ${item.preco || "a confirmar"} por ${item.unidade || "unidade"}`)
        .join("\n")
    : "Nenhum item recorrente cadastrado. Use A confirmar quando o produto não estiver claro.";

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
- Se faltar dado, use "A confirmar".
- Seja conservadora: se parece pedido, classifique como pedido.
- A resposta ao usuário deve ser curta, educada e em português.
- Quando houver cliente identificado, use os dados dele no pedido.
- Os itens recorrentes são apenas referência. Não trate como catálogo fechado.
- Quando um produto combinar com um item recorrente, use o nome desse item.
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
Itens recorrentes cadastrados:
${itensRecorrentesResumo}
Mensagem: ${message}
`;

  const response = await fetch(`${LMSTUDIO_BASE_URL}/chat/completions`, {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LM Studio ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);

  return { ...parsed, origemIA: "lm-studio-local" };
}

async function sendToSheets(tipo, payload) {
  const url = sheetsWebhookUrl;
  if (!url) return { ok: false, motivo: "SHEETS_WEBHOOK_URL não configurado" };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ tipo, payload })
  });

  return { ok: response.ok, status: response.status };
}

function listByKind(db, kind) {
  if (kind === "pedidos") return db.pedidos;
  if (kind === "tarefas") return db.tarefas;
  if (kind === "clientes") return db.clientes;
  if (kind === "cardapio") return db.cardapio;
  return null;
}

app.get("/api/health", async (req, res) => {
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/models`, {
      headers: { "Authorization": "Bearer lm-studio" }
    });
    const models = response.ok ? await response.json() : null;
    res.json({
      ok: true,
      lmstudio: response.ok,
      baseUrl: LMSTUDIO_BASE_URL,
      configuredModel: LMSTUDIO_MODEL,
      models
    });
  } catch (err) {
    res.json({
      ok: true,
      lmstudio: false,
      baseUrl: LMSTUDIO_BASE_URL,
      configuredModel: LMSTUDIO_MODEL,
      error: err.message
    });
  }
});

app.post("/api/login", (req, res) => {
  const { password } = req.body || {};
  res.json({ ok: String(password || "") === SELLER_PASSWORD });
});

app.get("/api/settings", (req, res) => {
  res.json({
    ok: true,
    sheetsConfigured: Boolean(sheetsWebhookUrl),
    lmstudioBaseUrl: LMSTUDIO_BASE_URL,
    lmstudioModel: LMSTUDIO_MODEL
  });
});

app.post("/api/settings", (req, res) => {
  sheetsWebhookUrl = String(req.body?.sheetsWebhookUrl || "").trim();
  const db = readDb();
  addLog(db, "config", sheetsWebhookUrl ? "URL do Google Sheets configurada no backend" : "URL do Google Sheets removida do backend", "server");
  writeDb(db);
  res.json({ ok: true, sheetsConfigured: Boolean(sheetsWebhookUrl), data: db });
});

app.post("/api/sheets-test", async (req, res) => {
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
    res.status(500).json({ ok: false, error: err.message, data: db });
  }
});

app.get("/api/data", (req, res) => {
  res.json(readDb());
});

app.get("/api/templates", (req, res) => {
  res.json({ ok: true, templates: MENU_TEMPLATES });
});

app.post("/api/clientes", async (req, res) => {
  const db = readDb();
  const p = req.body || {};
  if (!p.nome || !String(p.nome).trim()) {
    return res.status(400).json({ ok: false, error: "Informe o nome do cliente." });
  }

  const telefone = String(p.telefone || "").trim();
  const existing = telefone ? db.clientes.find(cliente => normalize(cliente.telefone) === normalize(telefone)) : null;
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

  try {
    const sheets = await sendToSheets("cliente", cliente);
    if (sheets.ok) addLog(db, "sheets", "Cliente enviado ao Google Sheets", "server");
  } catch (err) {
    addLog(db, "erro_sheets", err.message, "server");
  }

  writeDb(db);
  res.json({ ok: true, saved: cliente, data: db });
});

app.post("/api/vendedor", (req, res) => {
  const db = readDb();
  db.vendedor = { ...DEFAULT_VENDEDOR, ...(req.body || {}) };
  addLog(db, "vendedor", "Perfil do vendedor atualizado", "server");
  writeDb(db);
  res.json({ ok: true, saved: db.vendedor, data: db });
});

app.post("/api/cardapio/templates", (req, res) => {
  const db = readDb();
  const key = req.body?.template;
  const template = MENU_TEMPLATES[key];
  if (!template) return res.status(400).json({ ok: false, error: "Template de cardápio inválido." });

  const added = template.map(item => ({
    id: makeId("ITEM"),
    ...item,
    disponivel: true,
    origem: "template"
  }));
  db.cardapio.unshift(...added);
  addLog(db, "cardapio", `Template adicionado: ${key}`, "server");
  writeDb(db);
  res.json({ ok: true, added, data: db });
});

app.post("/api/cardapio", (req, res) => {
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
    descricao: String(p.descricao || "").trim(),
    disponivel: p.disponivel !== false,
    origem: "personalizado"
  };

  db.cardapio.unshift(item);
  addLog(db, "cardapio", `Item adicionado: ${item.nome}`, "server");
  writeDb(db);
  res.json({ ok: true, saved: item, data: db });
});

app.patch("/api/cardapio/:id", (req, res) => {
  const db = readDb();
  const item = db.cardapio.find(row => row.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Item não encontrado." });

  const p = req.body || {};
  Object.assign(item, {
    nome: p.nome !== undefined ? String(p.nome).trim() : item.nome,
    categoria: p.categoria !== undefined ? String(p.categoria).trim() : item.categoria,
    preco: p.preco !== undefined ? parseMoney(p.preco) : item.preco,
    unidade: p.unidade !== undefined ? String(p.unidade).trim() : item.unidade,
    descricao: p.descricao !== undefined ? String(p.descricao).trim() : item.descricao,
    disponivel: p.disponivel !== undefined ? Boolean(p.disponivel) : item.disponivel
  });

  addLog(db, "cardapio", `Item atualizado: ${item.nome}`, "server");
  writeDb(db);
  res.json({ ok: true, saved: item, data: db });
});

app.post("/api/message", async (req, res) => {
  const { message, role, clienteId } = req.body || {};
  const db = readDb();
  const cliente = findCliente(db, clienteId);

  if (!message || !String(message).trim()) {
    return res.status(400).json({ ok: false, error: "Mensagem vazia." });
  }

  let analysis;
  try {
    analysis = await analyzeWithLMStudio(message, role || "cliente", db, cliente);
    addLog(db, "ia", "Mensagem analisada pela IA local do LM Studio", "lm-studio");
  } catch (err) {
    analysis = { ...fallbackAnalyze(message, role || "cliente", db, cliente), origemIA: "fallback-regra" };
    addLog(db, "erro_ia", err.message, "lm-studio");
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
      status: "Pendente",
      origem: analysis.origemIA || "ia"
    };
    const pedido = enrichPedidoWithContext(db, pedidoBase, message, cliente);
    db.pedidos.unshift(pedido);
    saved = pedido;
    addLog(db, "pedido", `Pedido registrado: ${pedido.produto}`, "server");

    try {
      const sheets = await sendToSheets("pedido", pedido);
      if (sheets.ok) addLog(db, "sheets", "Pedido enviado ao Google Sheets", "server");
    } catch (err) {
      addLog(db, "erro_sheets", err.message, "server");
    }
  }

  if (analysis.tipo === "tarefa") {
    const tarefa = {
      id: makeId("TAR"),
      dataHora: nowBR(),
      tarefa: analysis.tarefa?.descricao || message,
      prazo: analysis.tarefa?.prazo || "Sem prazo",
      prioridade: analysis.tarefa?.prioridade || "Normal",
      status: "Pendente",
      origem: analysis.origemIA || "ia"
    };
    db.tarefas.unshift(tarefa);
    saved = tarefa;
    addLog(db, "tarefa", `Tarefa registrada: ${tarefa.tarefa}`, "server");

    try {
      const sheets = await sendToSheets("tarefa", tarefa);
      if (sheets.ok) addLog(db, "sheets", "Tarefa enviada ao Google Sheets", "server");
    } catch (err) {
      addLog(db, "erro_sheets", err.message, "server");
    }
  }

  if (analysis.tipo === "conversa") {
    addLog(db, "conversa", message, "server");
  }

  writeDb(db);
  res.json({ ok: true, analysis, saved, data: db });
});

app.post("/api/manual-order", async (req, res) => {
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
    status: "Pendente",
    origem: "manual"
  }, `${p.produto || ""} ${p.observacoes || ""}`, null);

  db.pedidos.unshift(pedido);
  addLog(db, "pedido", `Pedido manual registrado: ${pedido.produto}`, "server");

  try {
    const sheets = await sendToSheets("pedido", pedido);
    if (sheets.ok) addLog(db, "sheets", "Pedido manual enviado ao Google Sheets", "server");
  } catch (err) {
    addLog(db, "erro_sheets", err.message, "server");
  }

  writeDb(db);
  res.json({ ok: true, saved: pedido, data: db });
});

app.post("/api/manual-task", async (req, res) => {
  const db = readDb();
  const p = req.body || {};
  const tarefa = {
    id: makeId("TAR"),
    dataHora: nowBR(),
    tarefa: p.tarefa || p.descricao || "Tarefa sem descricao",
    prazo: p.prazo || "Sem prazo",
    prioridade: p.prioridade || "Normal",
    status: "Pendente",
    origem: "manual"
  };

  db.tarefas.unshift(tarefa);
  addLog(db, "tarefa", `Tarefa manual registrada: ${tarefa.tarefa}`, "server");

  try {
    const sheets = await sendToSheets("tarefa", tarefa);
    if (sheets.ok) addLog(db, "sheets", "Tarefa manual enviada ao Google Sheets", "server");
  } catch (err) {
    addLog(db, "erro_sheets", err.message, "server");
  }

  writeDb(db);
  res.json({ ok: true, saved: tarefa, data: db });
});

app.patch("/api/:kind/:id/status", async (req, res) => {
  const db = readDb();
  const list = listByKind(db, req.params.kind);
  if (!list) return res.status(404).json({ ok: false, error: "Tipo inválido." });

  const item = list.find(row => row.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: "Registro não encontrado." });

  const nextStatus = req.body?.status || (item.status === "Concluido" ? "Pendente" : "Concluido");
  item.status = nextStatus;
  addLog(db, req.params.kind === "pedidos" ? "pedido" : "tarefa", `Status atualizado para "${nextStatus}" (${item.id})`, "server");

  try {
    const sheets = await sendToSheets("atualizacao", { kind: req.params.kind, id: item.id, status: item.status });
    if (sheets.ok) addLog(db, "sheets", "Status enviado ao Google Sheets", "server");
  } catch (err) {
    addLog(db, "erro_sheets", err.message, "server");
  }

  writeDb(db);
  res.json({ ok: true, saved: item, data: db });
});

app.delete("/api/:kind/:id", (req, res) => {
  const db = readDb();
  const list = listByKind(db, req.params.kind);
  if (!list) return res.status(404).json({ ok: false, error: "Tipo inválido." });

  const before = list.length;
  db[req.params.kind] = list.filter(row => row.id !== req.params.id);
  if (db[req.params.kind].length === before) {
    return res.status(404).json({ ok: false, error: "Registro não encontrado." });
  }

  addLog(db, req.params.kind === "pedidos" ? "pedido" : req.params.kind, `Registro excluído (${req.params.id})`, "server");
  writeDb(db);
  res.json({ ok: true, data: db });
});

app.post("/api/clear", (req, res) => {
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

app.get("/api/export/:type", (req, res) => {
  const db = readDb();
  const type = req.params.type;
  const rows = db[type];

  if (!Array.isArray(rows)) return res.status(404).send("Tipo inválido.");
  if (!rows.length) return res.status(404).send("Sem dados.");

  const cols = Object.keys(rows[0]);
  const csv = [
    cols.join(";"),
    ...rows.map(row => cols.map(c => `"${String(row[c] || "").replaceAll('"', '""')}"`).join(";"))
  ].join("\n");

  res.setHeader("Content-Type", "text/csv;charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${type}-autoio.csv"`);
  res.send(csv);
});

if (require.main === module) {
  app.listen(PORT, () => {
    ensureDb();
    console.log(`Auto.io rodando em http://localhost:${PORT}`);
    console.log(`LM Studio endpoint: ${LMSTUDIO_BASE_URL}/chat/completions`);
  });
}

module.exports = { app, ensureDb, readDb, writeDb };
