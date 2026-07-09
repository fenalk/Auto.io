/**
 * Auto.io — Simulador de atendimento
 * ------------------------------------------------------------
 * Organização do arquivo (tudo dentro de uma IIFE para não vazar
 * variáveis globais, já que o projeto roda sem bundler/módulos):
 *
 *   1. Config / constantes
 *   2. Estado e persistência (localStorage)
 *   3. Utilitários genéricos
 *   4. Toast e modal de confirmação (substituem alert/confirm)
 *   5. Classificação da mensagem (cliente/dona -> pedido/tarefa)
 *   6. Extração de dados da mensagem (produto, quantidade, data...)
 *   7. Integração opcional com Google Sheets (Apps Script)
 *   8. Renderização (chat, KPIs, tabelas)
 *   9. Ações de linha (concluir / excluir)
 *  10. Exportação CSV
 *  11. Ligação de eventos + inicialização
 * ------------------------------------------------------------
 */
(() => {
  "use strict";

  /* ============================================================
     1. Config / constantes
     ============================================================ */
  const STORAGE_KEY = "autoio-demo-v2";
  const STORAGE_KEY_LEGACY = "autoio-demo-v1";
  const WEBHOOK_KEY = "autoio-webhook-url";
  const SESSION_KEY = "autoio-owner-session";
  const DEMO_PASSWORD = "12345"; // senha fixa apenas para fins de demonstração

  const TASK_WORDS = [
    "lembra", "lembrar", "comprar", "fazer", "tarefa", "anotar", "agenda",
    "preparar", "organizar", "arrumar", "limpar", "pagar", "separar", "revisar"
  ];
  const ORDER_WORDS = [
    "quero", "pedido", "encomenda", "encomendar", "bolo", "bolos", "brigadeiro",
    "brigadeiros", "docinho", "docinhos", "marmita", "marmitas", "cento", "duzia",
    "entrega", "retirar", "salgado", "salgados", "cupcake", "beijinho", "torta", "doce", "doces"
  ];
  const GREETING_WORDS = ["oi", "ola", "bom dia", "boa tarde", "boa noite", "tudo bem", "obrigada", "obrigado", "valeu"];

  const PRODUCTS = ["brigadeiro", "bolo", "docinho", "marmita", "beijinho", "cupcake", "salgado", "torta", "doce"];

  const WEEKDAY_LABELS = {
    domingo: "Domingo", segunda: "Segunda-feira", terca: "Terça-feira",
    quarta: "Quarta-feira", quinta: "Quinta-feira", sexta: "Sexta-feira", sabado: "Sábado"
  };

  const TABLE_CONFIG = {
    pedidos: {
      cols: [
        { key: "dataHora", label: "Data/Hora" },
        { key: "cliente", label: "Cliente" },
        { key: "produto", label: "Produto" },
        { key: "quantidade", label: "Quantidade" },
        { key: "dataEntrega", label: "Entrega" },
        { key: "pagamento", label: "Pagamento" },
        { key: "status", label: "Status", type: "status" },
        { key: "observacoes", label: "Observações" }
      ],
      empty: "Nenhum pedido ainda. Assim que um cliente mandar mensagem, ele aparece aqui.",
      actionable: true
    },
    tarefas: {
      cols: [
        { key: "dataHora", label: "Data/Hora" },
        { key: "tarefa", label: "Tarefa" },
        { key: "prazo", label: "Prazo" },
        { key: "status", label: "Status", type: "status" }
      ],
      empty: "Nenhuma tarefa ainda. Mande um lembrete no chat como \"dona do negócio\".",
      actionable: true
    },
    logs: {
      cols: [
        { key: "dataHora", label: "Data/Hora" },
        { key: "tipo", label: "Tipo" },
        { key: "mensagem", label: "Mensagem" },
        { key: "origem", label: "Origem" }
      ],
      empty: "Nenhum log registrado ainda.",
      actionable: false
    }
  };

  /* ============================================================
     2. Estado e persistência
     ============================================================ */
  let state = loadState();
  let currentView = "landing";
  let currentTab = "pedidos";
  let searchTerm = "";

  function normalizeState(raw) {
    return {
      pedidos: Array.isArray(raw && raw.pedidos) ? raw.pedidos : [],
      tarefas: Array.isArray(raw && raw.tarefas) ? raw.tarefas : [],
      logs: Array.isArray(raw && raw.logs) ? raw.logs : []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeState(JSON.parse(raw));

      // migração silenciosa de uma versão anterior do armazenamento local
      const legacy = localStorage.getItem(STORAGE_KEY_LEGACY);
      if (legacy) {
        const migrated = normalizeState(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (err) {
      console.error("Auto.io: falha ao ler dados salvos, iniciando vazio.", err);
    }
    return { pedidos: [], tarefas: [], logs: [] };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Auto.io: falha ao salvar dados.", err);
      showToast("Não consegui salvar no navegador (modo privado ou memória cheia?).", "error");
    }
    render();
  }

  /* ============================================================
     3. Utilitários genéricos
     ============================================================ */
  function nowBR() {
    return new Date().toLocaleString("pt-BR");
  }

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function formatDateInputValue(value) {
    if (!value) return "A confirmar";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("pt-BR");
  }

  /* ============================================================
     4. Toast e modal de confirmação
     ------------------------------------------------------------
     Substituem alert()/confirm(): não travam a UI, seguem o tema
     visual da aplicação e funcionam melhor em mobile.
     ============================================================ */
  function showToast(message, type = "success", timeout = 4200) {
    const wrap = document.getElementById("toastWrap");
    const div = document.createElement("div");
    div.className = `toast${type === "error" ? " error" : ""}`;
    div.textContent = message;
    wrap.appendChild(div);
    setTimeout(() => div.remove(), timeout);
  }

  function confirmAction(message, onConfirm) {
    const backdrop = document.getElementById("confirmModal");
    const desc = document.getElementById("confirmDesc");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    desc.textContent = message;
    backdrop.classList.remove("hidden");

    function cleanup() {
      backdrop.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
    }
    function onOk() { cleanup(); onConfirm(); }
    function onCancel() { cleanup(); }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  }

  /* ============================================================
     5. Classificação da mensagem
     ------------------------------------------------------------
     Estratégia: pontuação por palavras-chave em vez de um único
     "if" em cascata. Isso evita que uma mensagem com uma palavra
     de tarefa e três de pedido seja classificada errado, e trata
     saudações/mensagens curtas como conversa (não gera lixo na
     central de controle).
     ============================================================ */
  function classifyMessage(text, role) {
    const t = normalize(text);

    // atalho: "cliente Maria pediu..." é sempre pedido, mesmo
    // quando é a dona digitando em nome do cliente.
    if (/cliente\s+[a-z]+.*\b(pediu|quer|solicitou|encomendou)\b/.test(t)) return "pedido";

    const taskScore = TASK_WORDS.filter(w => t.includes(w)).length;
    const orderScore = ORDER_WORDS.filter(w => t.includes(w)).length;

    if (taskScore === 0 && orderScore === 0) {
      const isGreeting = GREETING_WORDS.some(w => t.includes(w));
      const isTooShort = t.trim().split(/\s+/).filter(Boolean).length <= 2;
      if (isGreeting || isTooShort) return "conversa";
      // mensagem sem palavras-chave claras: só vira tarefa se for a dona
      return role === "dona" ? "tarefa" : "conversa";
    }

    if (orderScore > taskScore) return "pedido";
    if (taskScore > orderScore) return "tarefa";
    // empate: o papel de quem está falando desempata
    return role === "dona" ? "tarefa" : "pedido";
  }

  /* ============================================================
     6. Extração de dados da mensagem
     ============================================================ */
  function parseQuantity(text) {
    const t = normalize(text);

    const wordAmounts = [
      [/meia\s*duzia/, "6 (meia dúzia)"],
      [/\b(uma|1)\s*duzia/, "12 (1 dúzia)"],
      [/meio\s*cento/, "50 (meio cento)"],
      [/\b(um|1)\s*cento\b/, "100 (1 cento)"]
    ];
    for (const [re, label] of wordAmounts) {
      if (re.test(t)) return label;
    }

    // procura números que não façam parte de um horário (ex.: "15h", "às 15:30")
    const numberMatches = [...text.matchAll(/\d+(?:[.,]\d+)?/g)];
    for (const match of numberMatches) {
      const end = match.index + match[0].length;
      const after = text.slice(end, end + 2).toLowerCase();
      const before = normalize(text.slice(Math.max(0, match.index - 4), match.index));
      const looksLikeTime = after.startsWith("h") || after.startsWith(":") || before.includes("as ") || before.includes("às");
      if (looksLikeTime) continue;

      const unitMatch = text.slice(end, end + 16).match(/^\s*(unidades?|un\.?|bolos?|marmitas?|docinhos?|salgados?|kg|quilos?|litros?)/i);
      return unitMatch ? `${match[0]} ${unitMatch[1]}` : match[0];
    }
    return "A confirmar";
  }

  function parseDeliveryDate(text) {
    const t = normalize(text);
    let base = "A confirmar";

    if (t.includes("depois de amanha")) base = "Depois de amanhã";
    else if (t.includes("amanha")) base = "Amanhã";
    else if (t.includes("hoje")) base = "Hoje";
    else {
      const dayKey = Object.keys(WEEKDAY_LABELS).find(d => t.includes(d));
      if (dayKey) base = WEEKDAY_LABELS[dayKey];
    }

    const explicitDate = text.match(/\b(\d{1,2})\/(\d{1,2})(\/\d{2,4})?\b/);
    if (explicitDate) base = explicitDate[0];

    const time = t.match(/\b(\d{1,2})[h:](\d{2})?\b/);
    if (time) {
      const minutes = time[2] ? time[2] : "00";
      base += ` às ${time[1]}h${minutes !== "00" ? minutes : ""}`;
    }
    return base;
  }

  function parseClientName(text, role) {
    const patterns = [
      /cliente\s+([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)?)\s+(?:pediu|quer|solicitou|encomendou)/i,
      /pedido\s+d[ae]\s+([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)?)/i
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return role === "cliente" ? "Cliente do chat" : "Cliente informado";
  }

  function extractOrder(text, role) {
    const t = normalize(text);
    const produto = PRODUCTS.find(p => t.includes(p)) || "Pedido informado por mensagem";
    const meta = { dataHora: nowBR(), timestamp: Date.now() };

    return {
      id: uid("PED"),
      ...meta,
      cliente: parseClientName(text, role),
      telefone: "",
      produto,
      quantidade: parseQuantity(text),
      dataEntrega: parseDeliveryDate(text),
      pagamento: t.includes("pix") ? "Pix" : t.includes("cartao") ? "Cartão" : t.includes("dinheiro") ? "Dinheiro" : t.includes("transferencia") ? "Transferência" : "A confirmar",
      endereco: t.includes("retirar") || t.includes("retirada") ? "Retirada no local" : "A confirmar",
      observacoes: text,
      status: "Pendente",
      origem: "chat"
    };
  }

  function extractTask(text) {
    const meta = { dataHora: nowBR(), timestamp: Date.now() };
    return {
      id: uid("TAR"),
      ...meta,
      tarefa: text,
      prazo: parseDeliveryDate(text) === "A confirmar" ? "Sem prazo" : parseDeliveryDate(text),
      status: "Pendente",
      origem: "chat"
    };
  }

  function botReply(type, item, role = "cliente") {
    if (type === "pedido") {
      const resumo = `Cliente: ${item.cliente}\nProduto: ${item.produto}\nQuantidade: ${item.quantidade}\nEntrega: ${item.dataEntrega}\nPagamento: ${item.pagamento}`;
      return role === "cliente"
        ? `Pedido recebido, obrigada! 🍰✅\n\n${resumo}\n\nQualquer alteração é só me avisar por aqui.`
        : `Pedido registrado com sucesso! 🍰✅\n\n${resumo}\n\nA central da Auto.io já foi atualizada.`;
    }
    if (type === "tarefa") {
      return `Tarefa salva com sucesso! ✅\n\n${item.tarefa}\nPrazo: ${item.prazo}\n\nVocê não precisa abrir planilha: a conversa virou registro.`;
    }
    return role === "cliente"
      ? "Oi! Eu sou a assistente da loja 🍰. Me conta o que você quer encomendar, com quantidade e data de entrega, que eu já registro seu pedido."
      : "Pode digitar como se estivesse falando com a cliente. Eu identifico se é pedido ou tarefa e já registro na central.";
  }

  /* ============================================================
     7. Integração opcional com Google Sheets
     ------------------------------------------------------------
     O Web App do Apps Script não devolve uma resposta legível a
     partir de um domínio diferente sem CORS, então o fetch usa
     mode:"no-cors". Isso significa que o navegador NUNCA consegue
     ler o corpo/status da resposta (é "opaca" por design) — o
     catch só pega falhas de rede (sem internet, URL inválida por
     DNS etc.), não erros de lógica no Apps Script. Por isso o
     botão "Testar envio" pede para conferir a aba Logs na planilha.
     ============================================================ */
  async function sendToWebhook(tipo, payload) {
    const url = localStorage.getItem(WEBHOOK_KEY);
    if (!url) return;

    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ tipo, payload })
      });
      addLog("sheets", `Registro enviado ao Google Sheets: ${tipo}`);
    } catch (err) {
      addLog("erro", `Falha ao enviar ao Google Sheets: ${err.message}`);
      showToast("Não consegui falar com o Google Sheets. Confira a URL salva.", "error");
    }
  }

  function addLog(tipo, mensagem, origem = "front") {
    state.logs.unshift({ dataHora: nowBR(), timestamp: Date.now(), tipo, mensagem, origem });
  }

  /* ============================================================
     8. Renderização
     ============================================================ */
  function pendingCount() {
    return [
      ...state.pedidos.filter(p => p.status === "Pendente"),
      ...state.tarefas.filter(t => t.status === "Pendente")
    ].length;
  }

  function updateLandingBadge() {
    const badge = document.querySelector("#landingPendingBadge");
    if (!badge) return;
    const n = pendingCount();
    badge.textContent = n === 0 ? "Tudo em dia ✓" : `${n} pendente${n > 1 ? "s" : ""}`;
  }

  function render() {
    document.querySelector("#pedidosCount").textContent = state.pedidos.length;
    document.querySelector("#tarefasCount").textContent = state.tarefas.length;
    document.querySelector("#clientesCount").textContent = new Set(state.pedidos.map(p => p.cliente)).size;
    document.querySelector("#pendentesCount").textContent = pendingCount();
    renderTable();
    updateLandingBadge();
  }

  /* ------------------------------------------------------------
     Widget de chat reutilizável: a área do cliente e o "registrar
     por mensagem" da dona usam a mesma lógica de classificação,
     mudando apenas os elementos do DOM e o papel (role) fixo.
     ------------------------------------------------------------ */
  function createChatWidget({ chatId, formId, inputId, role }) {
    const chatEl = document.querySelector(`#${chatId}`);
    const formEl = document.querySelector(`#${formId}`);
    const inputEl = document.querySelector(`#${inputId}`);
    if (!chatEl || !formEl || !inputEl) return null;

    function addMsg(who, text, registro = false) {
      const div = document.createElement("div");
      div.className = `msg ${who}${registro ? " registro" : ""}`;
      div.textContent = text;
      chatEl.appendChild(div);
      chatEl.scrollTop = chatEl.scrollHeight;
    }

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (!text) return;

      addMsg("user", text);
      inputEl.value = "";

      const type = classifyMessage(text, role);
      const origem = role === "cliente" ? "chat-cliente" : "chat-dona";
      let item = null;

      if (type === "pedido") {
        item = extractOrder(text, role);
        state.pedidos.unshift(item);
        addLog("pedido", `Pedido registrado: ${item.produto} / ${item.quantidade}`, origem);
        await sendToWebhook("pedido", item);
      } else if (type === "tarefa") {
        item = extractTask(text);
        state.tarefas.unshift(item);
        addLog("tarefa", `Tarefa registrada: ${item.tarefa}`, origem);
        await sendToWebhook("tarefa", item);
      } else {
        addLog("conversa", text, origem);
      }

      addMsg("bot", botReply(type, item, role), type === "pedido" || type === "tarefa");
      saveState();
    });

    return { addMsg, inputEl };
  }

  function matchesSearch(row, term) {
    if (!term) return true;
    const needle = normalize(term);
    return Object.values(row).some(value => normalize(String(value ?? "")).includes(needle));
  }

  function renderTable() {
    const wrap = document.querySelector("#tableWrap");
    const config = TABLE_CONFIG[currentTab];
    const rows = state[currentTab].filter(row => matchesSearch(row, searchTerm));
    wrap.innerHTML = table(rows, config);
  }

  function table(rows, config) {
    if (!rows.length) {
      return `<div class="empty-state">${escapeHTML(config.empty)}</div>`;
    }

    const headCells = config.cols.map(c => `<th>${escapeHTML(c.label)}</th>`).join("");
    const actionsHead = config.actionable ? `<th>Ações</th>` : "";

    const bodyRows = rows.map(row => {
      const cells = config.cols.map(c => {
        if (c.type === "status") {
          return `<td><span class="status" data-status="${escapeHTML(row[c.key] || "")}">${escapeHTML(row[c.key] || "")}</span></td>`;
        }
        return `<td>${escapeHTML(row[c.key] || "")}</td>`;
      }).join("");

      let actionsCell = "";
      if (config.actionable) {
        const isDone = row.status === "Concluído";
        actionsCell = `<td class="row-actions">
          <button type="button" class="done" data-action="toggle" data-kind="${currentTab}" data-id="${escapeHTML(row.id)}">${isDone ? "Reabrir" : "Concluir"}</button>
          <button type="button" class="remove" data-action="remove" data-kind="${currentTab}" data-id="${escapeHTML(row.id)}">Excluir</button>
        </td>`;
      }

      return `<tr>${cells}${actionsCell}</tr>`;
    }).join("");

    return `<table><thead><tr>${headCells}${actionsHead}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  /* ============================================================
     9. Ações de linha (concluir / excluir)
     ------------------------------------------------------------
     Delegação de eventos no container da tabela: os botões são
     recriados a cada render(), então um único listener no wrapper
     evita reanexar handlers toda hora.
     ============================================================ */
  function toggleStatus(kind, id) {
    const list = state[kind];
    const item = list.find(r => r.id === id);
    if (!item) return;
    item.status = item.status === "Concluído" ? "Pendente" : "Concluído";
    addLog(kind === "pedidos" ? "pedido" : "tarefa", `Status atualizado para "${item.status}" (${id})`);
    sendToWebhook("atualizacao", { kind, id, status: item.status });
    saveState();
    showToast(`Marcado como ${item.status.toLowerCase()}.`);
  }

  function removeItem(kind, id) {
    confirmAction("Excluir este registro? Essa ação não pode ser desfeita.", () => {
      state[kind] = state[kind].filter(r => r.id !== id);
      addLog(kind === "pedidos" ? "pedido" : "tarefa", `Registro excluído (${id})`);
      saveState();
      showToast("Registro excluído.");
    });
  }

  /* ============================================================
     10. Exportação CSV
     ------------------------------------------------------------
     Inclui BOM (\ufeff) porque o Excel em pt-BR só reconhece
     acentuação em UTF-8 automaticamente com esse marcador.
     ============================================================ */
  function exportCSV(name, rows, config) {
    if (!rows.length) return showToast("Sem dados para exportar ainda.", "error");
    const cols = config.cols.map(c => c.key);
    const header = config.cols.map(c => c.label).join(";");
    const body = rows.map(row => cols.map(c => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const csv = "\ufeff" + header + "\r\n" + body;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-autoio.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ============================================================
     11. Ligação de eventos + inicialização
     ============================================================ */
  function bindExamples() {
    document.querySelectorAll("[data-example]").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.querySelector(`#${btn.dataset.target}`);
        if (!input) return;
        input.value = btn.dataset.example;
        input.focus();
      });
    });
  }

  function bindQuickOrderForm() {
    const form = document.querySelector("#quickOrderForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const fd = new FormData(form);
      const item = {
        id: uid("PED"),
        dataHora: nowBR(),
        timestamp: Date.now(),
        cliente: fd.get("cliente").trim(),
        telefone: fd.get("telefone").trim(),
        produto: fd.get("produto").trim(),
        quantidade: fd.get("quantidade").trim(),
        dataEntrega: formatDateInputValue(fd.get("dataEntrega")),
        pagamento: fd.get("pagamento") || "A confirmar",
        endereco: fd.get("endereco").trim() || "A confirmar",
        observacoes: fd.get("observacoes").trim(),
        status: "Pendente",
        origem: "manual"
      };
      state.pedidos.unshift(item);
      addLog("pedido", `Pedido manual registrado: ${item.produto}`);
      await sendToWebhook("pedido", item);
      form.reset();
      saveState();
      showToast("Pedido registrado na central.");
    });
  }

  function bindTabs() {
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        currentTab = btn.dataset.tab;
        renderTable();
      });
    });
  }

  function bindSearch() {
    document.querySelector("#searchInput").addEventListener("input", (e) => {
      searchTerm = e.target.value;
      renderTable();
    });
  }

  function bindTableActions() {
    document.querySelector("#tableWrap").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, kind, id } = btn.dataset;
      if (action === "toggle") toggleStatus(kind, id);
      if (action === "remove") removeItem(kind, id);
    });
  }

  function bindClear() {
    document.querySelector("#clearBtn").addEventListener("click", () => {
      confirmAction("Limpar todos os dados desta demonstração? Isso apaga pedidos, tarefas e logs salvos neste navegador.", () => {
        state = { pedidos: [], tarefas: [], logs: [] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        showToast("Demonstração reiniciada.");
        render();
      });
    });
  }

  function bindWebhookSettings() {
    document.querySelector("#saveWebhook").addEventListener("click", () => {
      const url = document.querySelector("#webhookUrl").value.trim();
      localStorage.setItem(WEBHOOK_KEY, url);
      showToast(url ? "URL salva. Próximos registros serão enviados ao Google Sheets." : "URL removida. A demo segue funcionando só no navegador.");
    });

    document.querySelector("#testWebhook").addEventListener("click", async () => {
      const url = localStorage.getItem(WEBHOOK_KEY);
      if (!url) {
        showToast("Salve a URL do Web App antes de testar.", "error");
        return;
      }
      await sendToWebhook("teste", { mensagem: "Teste de conexão a partir do painel Auto.io", dataHora: nowBR() });
      showToast("Teste enviado. Confira a aba Logs na sua planilha para confirmar o recebimento.");
    });
  }

  function bindExport() {
    document.querySelector("#exportPedidos").addEventListener("click", () => exportCSV("pedidos", state.pedidos, TABLE_CONFIG.pedidos));
    document.querySelector("#exportTarefas").addEventListener("click", () => exportCSV("tarefas", state.tarefas, TABLE_CONFIG.tarefas));
  }

  /* ============================================================
     11b. Navegação entre telas
     ------------------------------------------------------------
     Quatro telas controladas por uma classe .active em elementos
     .screen: seleção de perfil -> login (só dona) -> área do
     cliente (chat) ou painel da dona (gestão completa).
     ============================================================ */
  function goToView(view) {
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    const target = document.querySelector(`#view-${view}`);
    if (target) target.classList.add("active");
    currentView = view;
    window.scrollTo(0, 0);

    if (view === "login") {
      const pass = document.querySelector("#loginPassword");
      document.querySelector("#loginError").hidden = true;
      if (pass) { pass.value = ""; pass.focus(); }
    }
    if (view === "client") {
      const input = document.querySelector("#messageInput");
      if (input) input.focus();
    }
    if (view === "owner") {
      const input = document.querySelector("#ownerMessageInput");
      if (input) input.focus();
    }
    if (view === "landing") updateLandingBadge();
  }

  function isOwnerLoggedIn() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch (err) {
      return false;
    }
  }

  function setOwnerLoggedIn(value) {
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, "1");
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (err) {
      console.error("Auto.io: não foi possível salvar a sessão da dona.", err);
    }
  }

  function bindViewNavigation() {
    document.querySelector("#selectClient").addEventListener("click", () => goToView("client"));

    document.querySelector("#selectOwner").addEventListener("click", () => {
      goToView(isOwnerLoggedIn() ? "owner" : "login");
    });

    document.querySelector("#loginBack").addEventListener("click", () => goToView("landing"));
    document.querySelector("#clientBack").addEventListener("click", () => goToView("landing"));

    document.querySelector("#ownerLogout").addEventListener("click", () => {
      setOwnerLoggedIn(false);
      showToast("Sessão encerrada.");
      goToView("landing");
    });

    document.querySelector("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const pass = document.querySelector("#loginPassword");
      const error = document.querySelector("#loginError");

      if (pass.value === DEMO_PASSWORD) {
        setOwnerLoggedIn(true);
        error.hidden = true;
        showToast("Login realizado. Bem-vinda ao painel!");
        goToView("owner");
      } else {
        error.hidden = false;
        pass.value = "";
        pass.focus();
        const card = document.querySelector(".auth-card");
        card.classList.remove("shake");
        void card.offsetWidth; // força reflow para poder repetir a animação
        card.classList.add("shake");
      }
    });
  }

  /* ============================================================
     12. Inicialização
     ============================================================ */
  function init() {
    bindViewNavigation();
    bindExamples();
    bindQuickOrderForm();
    bindTabs();
    bindSearch();
    bindTableActions();
    bindClear();
    bindWebhookSettings();
    bindExport();

    const clientChat = createChatWidget({ chatId: "chat", formId: "messageForm", inputId: "messageInput", role: "cliente" });
    const ownerChat = createChatWidget({ chatId: "ownerChat", formId: "ownerMessageForm", inputId: "ownerMessageInput", role: "dona" });

    if (clientChat) clientChat.addMsg("bot", botReply("conversa", null, "cliente"));
    if (ownerChat) ownerChat.addMsg("bot", botReply("conversa", null, "dona"));

    document.querySelector("#webhookUrl").value = localStorage.getItem(WEBHOOK_KEY) || "";
    render();
    goToView("landing");
  }

  init();
})();