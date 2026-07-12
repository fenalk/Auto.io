(() => {
  "use strict";

  const SELLER_SESSION_KEY = "autoio-seller-session";
  const CLIENT_SESSION_KEY = "autoio-client-session";

  const TABLE_CONFIG = {
    pedidos: {
      cols: [
        { key: "dataHora", label: "Data/Hora" },
        { key: "cliente", label: "Cliente" },
        { key: "telefone", label: "Telefone" },
        { key: "produto", label: "Produto" },
        { key: "quantidade", label: "Quantidade" },
        { key: "dataEntrega", label: "Entrega" },
        { key: "valorEstimado", label: "Valor estimado" },
        { key: "status", label: "Status", type: "status" },
        { key: "precisaConfirmar", label: "Confirmar", type: "boolean" }
      ],
      empty: "Nenhum pedido ainda.",
      actionable: true
    },
    clientes: {
      cols: [
        { key: "criadoEm", label: "Cadastro" },
        { key: "nome", label: "Nome" },
        { key: "telefone", label: "Telefone" },
        { key: "endereco", label: "Endereço" },
        { key: "observacoes", label: "Observacoes" }
      ],
      empty: "Nenhum cliente cadastrado ainda.",
      actionable: false
    },
    tarefas: {
      cols: [
        { key: "dataHora", label: "Data/Hora" },
        { key: "tarefa", label: "Tarefa" },
        { key: "prazo", label: "Prazo" },
        { key: "prioridade", label: "Prioridade" },
        { key: "status", label: "Status", type: "status" }
      ],
      empty: "Nenhuma tarefa ainda.",
      actionable: true
    },
    cardapio: {
      cols: [
        { key: "nome", label: "Item" },
        { key: "categoria", label: "Categoria" },
        { key: "preco", label: "Preço" },
        { key: "unidade", label: "Unidade" },
        { key: "quantidade", label: "Prontos hoje" },
        { key: "disponivel", label: "No cardápio", type: "boolean" },
        { key: "atualizadoEm", label: "Atualizado" }
      ],
      empty: "Cardápio do dia vazio. Adicione o que está pronto para retirada.",
      actionable: false
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

  let state = {
    vendedor: {},
    clientes: [],
    cardapio: [],
    pedidos: [],
    tarefas: [],
    logs: []
  };
  let currentTab = "pedidos";
  let searchTerm = "";
  let currentClient = loadCurrentClient();

  function normalizeState(raw = {}) {
    return {
      vendedor: raw.vendedor || {},
      clientes: Array.isArray(raw.clientes) ? raw.clientes : [],
      cardapio: Array.isArray(raw.cardapio) ? raw.cardapio : [],
      pedidos: Array.isArray(raw.pedidos) ? raw.pedidos : [],
      tarefas: Array.isArray(raw.tarefas) ? raw.tarefas : [],
      logs: Array.isArray(raw.logs) ? raw.logs : []
    };
  }

  function loadCurrentClient() {
    try {
      const raw = sessionStorage.getItem(CLIENT_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveCurrentClient(cliente) {
    currentClient = cliente;
    try {
      if (cliente) sessionStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(cliente));
      else sessionStorage.removeItem(CLIENT_SESSION_KEY);
    } catch (err) {
      console.error("Auto.io: não foi possível salvar cliente da sessão.", err);
    }
    updateClientGreeting();
  }

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function formatDateInputValue(value) {
    if (!value) return "A confirmar";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("pt-BR");
  }

  function formatMoney(value) {
    if (value === "" || value === null || value === undefined) return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin", // envia o cookie de sessão do vendedor
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload?.error || `Falha na requisição (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  // Rotas públicas (mensagem e cadastro do remetente) não devolvem mais a base
  // inteira: só o painel autenticado recebe "data".
  function setServerState(nextState) {
    if (!nextState) return;
    state = normalizeState(nextState);
    render();
  }

  async function refreshData() {
    try {
      setServerState(await apiFetch("/api/data"));
    } catch (err) {
      if (err.status === 401) {
        setOwnerLoggedIn(false);
        showToast("Sessão expirada. Entre novamente.", "error");
        goToView("login");
        return;
      }
      showToast("Não consegui carregar o backend local. Confira se o Node está rodando.", "error");
      console.error("Auto.io: falha ao sincronizar com o backend.", err);
    }
  }

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

  function isDoneStatus(status) {
    return normalize(status) === "concluido";
  }

  function pendingCount() {
    return [
      ...state.pedidos.filter(p => !isDoneStatus(p.status)),
      ...state.tarefas.filter(t => !isDoneStatus(t.status))
    ].length;
  }

  function setLandingBadge(n) {
    const badge = document.querySelector("#landingPendingBadge");
    if (!badge) return;
    badge.textContent = n === 0 ? "Tudo em dia" : `${n} pendente${n > 1 ? "s" : ""}`;
  }

  function updateLandingBadge() {
    setLandingBadge(pendingCount());
  }

  // Selo da tela inicial: rota pública que devolve só o número, sem expor dados.
  async function refreshBadge() {
    try {
      const result = await apiFetch("/api/pendentes");
      setLandingBadge(Number(result.pendentes) || 0);
    } catch (err) {
      console.error("Auto.io: falha ao buscar pendências.", err);
    }
  }

  function updateClientGreeting() {
    const greeting = document.querySelector("#clientGreeting");
    if (!greeting) return;
    greeting.textContent = currentClient?.nome
      ? `Remetente: ${currentClient.nome}. Registre a mensagem recebida.`
      : "Registre a mensagem recebida";
  }

  function render() {
    document.querySelector("#pedidosCount").textContent = state.pedidos.length;
    document.querySelector("#tarefasCount").textContent = state.tarefas.length;
    document.querySelector("#clientesCount").textContent = state.clientes.length;
    document.querySelector("#pendentesCount").textContent = pendingCount();
    renderTable();
    renderMenu();
    renderMenuOptions();
    updateLandingBadge();
    updateClientGreeting();
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
    if (!rows.length) return `<div class="empty-state">${escapeHTML(config.empty)}</div>`;

    const headCells = config.cols.map(c => `<th>${escapeHTML(c.label)}</th>`).join("");
    const actionsHead = config.actionable ? "<th>Ações</th>" : "";
    const bodyRows = rows.map(row => {
      const cells = config.cols.map(c => {
        let value = row[c.key];
        if (c.key === "valorEstimado" || c.key === "preco") value = formatMoney(value);
        if (c.type === "status") {
          return `<td><span class="status" data-status="${escapeHTML(row[c.key])}">${escapeHTML(row[c.key])}</span></td>`;
        }
        if (c.type === "boolean") {
          return `<td>${value ? "Sim" : "Não"}</td>`;
        }
        return `<td>${escapeHTML(value)}</td>`;
      }).join("");

      const actionsCell = config.actionable ? `<td class="row-actions">
        <button type="button" class="done" data-action="toggle" data-kind="${currentTab}" data-id="${escapeHTML(row.id)}">${isDoneStatus(row.status) ? "Reabrir" : "Concluir"}</button>
        <button type="button" class="remove" data-action="remove" data-kind="${currentTab}" data-id="${escapeHTML(row.id)}">Excluir</button>
      </td>` : "";

      return `<tr>${cells}${actionsCell}</tr>`;
    }).join("");

    return `<table><thead><tr>${headCells}${actionsHead}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  }

  function renderMenuOptions() {
    const datalist = document.querySelector("#menuOptions");
    if (!datalist) return;
    datalist.innerHTML = state.cardapio
      .filter(item => item.disponivel !== false)
      .map(item => `<option value="${escapeHTML(item.nome)}"></option>`)
      .join("");
  }

  // Estado do item no cardápio do dia: fora do cardápio, esgotado ou pronto.
  function dishState(item) {
    if (item.disponivel === false) return "fora";
    return Number(item.quantidade) > 0 ? "pronto" : "esgotado";
  }

  function updateMenuSummary() {
    const summary = document.querySelector("#menuSummary");
    if (!summary) return;

    const noCardapio = state.cardapio.filter(item => item.disponivel !== false);
    const prontos = noCardapio.filter(item => Number(item.quantidade) > 0);
    const unidades = prontos.reduce((total, item) => total + Number(item.quantidade || 0), 0);

    if (!state.cardapio.length) {
      summary.textContent = "Cardápio vazio.";
    } else if (!prontos.length) {
      summary.textContent = `Nada pronto para retirada agora. ${noCardapio.length} item(ns) só sob encomenda.`;
    } else {
      summary.textContent = `${unidades} unidade${unidades > 1 ? "s" : ""} pronta${unidades > 1 ? "s" : ""} para retirada, em ${prontos.length} item${prontos.length > 1 ? "ns" : ""}.`;
    }
  }

  function renderMenu() {
    const wrap = document.querySelector("#menuList");
    if (!wrap) return;

    updateMenuSummary();

    if (!state.cardapio.length) {
      wrap.innerHTML = `<div class="empty-state">Nada no cardápio ainda. Use um modelo pronto ou adicione o primeiro item.</div>`;
      return;
    }

    const rotulo = { pronto: "Pronto", esgotado: "Esgotado", fora: "Fora do cardápio" };

    wrap.innerHTML = state.cardapio.map(item => {
      const estado = dishState(item);
      const id = escapeHTML(item.id);
      const quantidade = Number(item.quantidade) || 0;

      return `
      <article class="dish" data-state="${estado}">
        <header class="dish-head">
          <span class="dish-category">${escapeHTML(item.categoria || "Sem categoria")}</span>
          <span class="dish-flag">${rotulo[estado]}</span>
        </header>

        <strong class="dish-name">${escapeHTML(item.nome)}</strong>
        <p class="dish-desc">${escapeHTML(item.descricao || "Sem descrição")}</p>

        <p class="dish-price">
          ${formatMoney(item.preco) || "Preço a confirmar"}
          <span>por ${escapeHTML(item.unidade || "unidade")}</span>
        </p>

        <div class="dish-stock">
          <button type="button" class="step" data-menu-step="-1" data-id="${id}" aria-label="Uma unidade a menos de ${escapeHTML(item.nome)}" ${quantidade === 0 ? "disabled" : ""}>−</button>
          <label class="visually-hidden" for="qtd-${id}">Prontos de ${escapeHTML(item.nome)}</label>
          <input id="qtd-${id}" class="dish-qty" type="number" min="0" step="1" value="${quantidade}" data-menu-qty="${id}" />
          <button type="button" class="step" data-menu-step="1" data-id="${id}" aria-label="Uma unidade a mais de ${escapeHTML(item.nome)}">+</button>
          <span class="dish-stock-label">prontos</span>
        </div>

        <div class="dish-actions">
          <button type="button" class="ghost" data-menu-toggle="${id}">${item.disponivel === false ? "Voltar ao cardápio" : "Tirar do cardápio"}</button>
          <button type="button" class="ghost remove" data-menu-remove="${id}">Excluir</button>
        </div>
      </article>`;
    }).join("");
  }

  async function patchMenuItem(id, payload, mensagem) {
    try {
      const result = await apiFetch(`/api/cardapio/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      setServerState(result.data);
      refreshBoard();
      if (mensagem) showToast(mensagem);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  /* ---- Cardápio do dia visto por quem envia a mensagem ---- */
  async function refreshBoard() {
    const list = document.querySelector("#boardList");
    const summary = document.querySelector("#boardSummary");
    if (!list || !summary) return;

    try {
      const result = await apiFetch("/api/cardapio-do-dia");
      renderBoard(result.itens || []);
    } catch (err) {
      summary.textContent = "Não consegui carregar o cardápio agora.";
      list.innerHTML = "";
      console.error("Auto.io: falha ao carregar o cardápio do dia.", err);
    }
  }

  function renderBoard(itens) {
    const list = document.querySelector("#boardList");
    const summary = document.querySelector("#boardSummary");

    if (!itens.length) {
      summary.textContent = "O cardápio de hoje ainda não foi publicado.";
      list.innerHTML = `<div class="empty-state">Nada listado por enquanto. Você pode pedir por encomenda pela mensagem.</div>`;
      return;
    }

    const prontos = itens.filter(item => item.pronto);
    summary.textContent = prontos.length
      ? `${prontos.length} item${prontos.length > 1 ? "ns" : ""} pronto${prontos.length > 1 ? "s" : ""} para levar agora.`
      : "Nada pronto para levar agora — tudo sai por encomenda.";

    list.innerHTML = itens.map(item => `
      <button type="button" class="board-item" data-board-item="${escapeHTML(item.nome)}" data-pronto="${item.pronto}">
        <span class="board-item-main">
          <strong>${escapeHTML(item.nome)}</strong>
          <span class="board-item-desc">${escapeHTML(item.descricao || item.categoria || "")}</span>
        </span>
        <span class="board-item-side">
          <span class="board-price">${formatMoney(item.preco) || "A combinar"}</span>
          <span class="board-flag">${item.pronto ? `${item.quantidade} disponível${item.quantidade > 1 ? "eis" : ""}` : "Sob encomenda"}</span>
        </span>
      </button>
    `).join("");
  }

  function bindBoard() {
    const list = document.querySelector("#boardList");
    const input = document.querySelector("#messageInput");
    if (!list || !input) return;

    // Toque no item = rascunho da mensagem pronto para o cliente ajustar.
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-board-item]");
      if (!btn) return;
      const nome = btn.dataset.boardItem;
      input.value = btn.dataset.pronto === "true"
        ? `Quero 1 ${nome} para retirar hoje.`
        : `Quero encomendar 1 ${nome}. `;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  function botReply(type, item, role = "cliente") {
    if (type === "pedido") {
      const valor = item?.valorEstimado ? `\nValor estimado: ${formatMoney(item.valorEstimado)}` : "";
      const confirmar = item?.precisaConfirmar ? "\nAlguns dados ainda precisam ser confirmados pelo vendedor." : "";
      return role === "cliente"
        ? `Pedido recebido. O vendedor já recebeu o registro.${valor}${confirmar}`
        : `Pedido registrado com sucesso. A central foi atualizada.${valor}${confirmar}`;
    }
    if (type === "tarefa") return `Tarefa salva com sucesso.\n\n${item?.tarefa || ""}`;
    return role === "cliente"
      ? "Me conta o que você quer pedir, com quantidade e data de entrega."
      : "Digite uma mensagem de pedido ou tarefa que eu registro na central.";
  }

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

      try {
        const result = await apiFetch("/api/message", {
          method: "POST",
          body: JSON.stringify({
            message: text,
            role,
            clienteId: role === "cliente" ? currentClient?.id : undefined
          })
        });
        setServerState(result.data);
        refreshBadge();
        if (role === "cliente") refreshBoard();

        const type = result.analysis?.tipo || "conversa";
        const fallbackNote = result.analysis?.origemIA === "fallback-regra"
          ? "\n\nUsei o fallback local porque a IA não respondeu."
          : "";
        addMsg("bot", `${result.analysis?.resposta || botReply(type, result.saved, role)}${fallbackNote}`, type !== "conversa");
      } catch (err) {
        addMsg("bot", "Não consegui falar com o backend local agora. Confira se o servidor Node está aberto e tente novamente.");
        showToast(err.message, "error");
      }
    });

    return { addMsg, inputEl };
  }

  function goToView(view) {
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
    const target = document.querySelector(`#view-${view}`);
    if (target) target.classList.add("active");
    window.scrollTo(0, 0);

    if (view === "login") {
      const pass = document.querySelector("#loginPassword");
      document.querySelector("#loginError").hidden = true;
      if (pass) { pass.value = ""; pass.focus(); }
    }
    if (view === "client-register") document.querySelector("#clientName")?.focus();
    if (view === "client") {
      refreshBoard();
      document.querySelector("#messageInput")?.focus();
    }
    if (view === "owner") {
      refreshData();
      document.querySelector("#ownerMessageInput")?.focus();
    }
    if (view === "landing") refreshBadge();
  }

  function isOwnerLoggedIn() {
    try {
      return sessionStorage.getItem(SELLER_SESSION_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function setOwnerLoggedIn(value) {
    try {
      if (value) sessionStorage.setItem(SELLER_SESSION_KEY, "1");
      else sessionStorage.removeItem(SELLER_SESSION_KEY);
    } catch (err) {
      console.error("Auto.io: não foi possível salvar a sessão do vendedor.", err);
    }
  }

  function bindViewNavigation() {
    document.querySelector("#selectClient").addEventListener("click", () => {
      goToView(currentClient ? "client" : "client-register");
    });
    document.querySelector("#selectOwner").addEventListener("click", () => {
      goToView(isOwnerLoggedIn() ? "owner" : "login");
    });
    document.querySelector("#loginBack").addEventListener("click", () => goToView("landing"));
    document.querySelector("#clientRegisterBack").addEventListener("click", () => goToView("landing"));
    document.querySelector("#clientBack").addEventListener("click", () => goToView("landing"));
    document.querySelector("#changeClient").addEventListener("click", () => {
      saveCurrentClient(null);
      goToView("client-register");
    });
    document.querySelector("#ownerLogout").addEventListener("click", async () => {
      try {
        await apiFetch("/api/logout", { method: "POST" });
      } catch (err) {
        console.error("Auto.io: falha ao encerrar a sessão no servidor.", err);
      }
      setOwnerLoggedIn(false);
      state = normalizeState({});
      render();
      showToast("Sessão encerrada.");
      goToView("landing");
    });

    document.querySelector("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pass = document.querySelector("#loginPassword");
      const error = document.querySelector("#loginError");
      let authenticated = false;

      try {
        const result = await apiFetch("/api/login", {
          method: "POST",
          body: JSON.stringify({ password: pass.value })
        });
        authenticated = result.ok;
      } catch (err) {
        if (err.status !== 401) {
          showToast("Não consegui validar a senha no backend local.", "error");
        }
      }

      if (authenticated) {
        setOwnerLoggedIn(true);
        error.hidden = true;
        showToast("Login realizado. Bem-vindo ao painel!");
        goToView("owner");
      } else {
        error.hidden = false;
        pass.value = "";
        pass.focus();
        const card = document.querySelector(".auth-card");
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
      }
    });
  }

  function bindClientRegister() {
    const form = document.querySelector("#clientRegisterForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const fd = new FormData(form);
      const payload = {
        nome: fd.get("nome").trim(),
        telefone: fd.get("telefone").trim(),
        endereco: fd.get("endereco").trim(),
        observacoes: fd.get("observacoes").trim()
      };

      try {
        const result = await apiFetch("/api/clientes", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        saveCurrentClient(result.saved);
        setServerState(result.data);
        refreshBadge();
        showToast("Cadastro rápido salvo.");
        goToView("client");
      } catch (err) {
        showToast(err.message, "error");
      }
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
        cliente: fd.get("cliente").trim(),
        telefone: fd.get("telefone").trim(),
        produto: fd.get("produto").trim(),
        quantidade: fd.get("quantidade").trim(),
        dataEntrega: formatDateInputValue(fd.get("dataEntrega")),
        pagamento: fd.get("pagamento") || "A confirmar",
        endereco: fd.get("endereco").trim() || "A confirmar",
        observacoes: fd.get("observacoes").trim()
      };

      try {
        const result = await apiFetch("/api/manual-order", {
          method: "POST",
          body: JSON.stringify(item)
        });
        setServerState(result.data);
        form.reset();
        showToast("Pedido registrado na central.");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  function bindMenu() {
    document.querySelector("#addTemplate").addEventListener("click", async () => {
      const template = document.querySelector("#templateSelect").value;
      try {
        const result = await apiFetch("/api/cardapio/templates", {
          method: "POST",
          body: JSON.stringify({ template })
        });
        setServerState(result.data);
        showToast("Modelo adicionado. Agora informe quantos estão prontos.");
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.querySelector("#closeDay").addEventListener("click", () => {
      confirmAction("Encerrar o dia? As quantidades prontas vão a zero e os itens continuam no cardápio.", async () => {
        try {
          const result = await apiFetch("/api/cardapio/encerrar-dia", { method: "POST" });
          setServerState(result.data);
          showToast("Dia encerrado. Nada mais consta como pronto.");
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });

    document.querySelector("#menuForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const fd = new FormData(form);
      const payload = {
        nome: fd.get("nome").trim(),
        categoria: fd.get("categoria").trim(),
        preco: fd.get("preco").trim(),
        unidade: fd.get("unidade").trim(),
        quantidade: fd.get("quantidade"),
        descricao: fd.get("descricao").trim()
      };

      try {
        const result = await apiFetch("/api/cardapio", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setServerState(result.data);
        form.reset();
        document.querySelector("#menuQty").value = "0";
        showToast("Item adicionado ao cardápio do dia.");
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    const menuList = document.querySelector("#menuList");

    menuList.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("button[data-menu-remove]");
      if (removeBtn) {
        removeItem("cardapio", removeBtn.dataset.menuRemove);
        return;
      }

      // Baixa rápida ao vender no balcão (−1) ou saída de mais uma fornada (+1).
      const stepBtn = e.target.closest("button[data-menu-step]");
      if (stepBtn) {
        const item = state.cardapio.find(row => row.id === stepBtn.dataset.id);
        if (!item) return;
        const quantidade = Math.max(0, (Number(item.quantidade) || 0) + Number(stepBtn.dataset.menuStep));
        patchMenuItem(item.id, { quantidade }, quantidade === 0 ? `${item.nome}: esgotado.` : null);
        return;
      }

      const toggleBtn = e.target.closest("button[data-menu-toggle]");
      if (!toggleBtn) return;
      const item = state.cardapio.find(row => row.id === toggleBtn.dataset.menuToggle);
      if (!item) return;

      const voltando = item.disponivel === false;
      patchMenuItem(
        item.id,
        { disponivel: voltando },
        voltando ? `${item.nome} voltou ao cardápio.` : `${item.nome} saiu do cardápio de hoje.`
      );
    });

    // Digitar a quantidade direto (ex.: saiu a fornada, são 24).
    menuList.addEventListener("change", (e) => {
      const input = e.target.closest("input[data-menu-qty]");
      if (!input) return;
      patchMenuItem(input.dataset.menuQty, { quantidade: input.value }, "Quantidade atualizada.");
    });
  }

  async function toggleStatus(kind, id) {
    const list = state[kind];
    const item = list.find(r => r.id === id);
    if (!item) return;

    const nextStatus = isDoneStatus(item.status) ? "Pendente" : "Concluído";
    try {
      const result = await apiFetch(`/api/${kind}/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus })
      });
      setServerState(result.data);
      showToast(`Marcado como ${nextStatus.toLowerCase()}.`);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function removeItem(kind, id) {
    confirmAction("Excluir este registro? Essa ação não pode ser desfeita.", async () => {
      try {
        const result = await apiFetch(`/api/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
        setServerState(result.data);
        showToast("Registro excluído.");
      } catch (err) {
        showToast(err.message, "error");
      }
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
      confirmAction("Limpar pedidos, clientes, tarefas e logs? Itens e preços de referência serão mantidos.", async () => {
        try {
          const result = await apiFetch("/api/clear", { method: "POST" });
          saveCurrentClient(null);
          setServerState(result.data);
          showToast("Base reiniciada.");
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }

  function bindWebhookSettings() {
    document.querySelector("#saveWebhook").addEventListener("click", async () => {
      const url = document.querySelector("#webhookUrl").value.trim();
      try {
        const result = await apiFetch("/api/settings", {
          method: "POST",
          body: JSON.stringify({ sheetsWebhookUrl: url })
        });
        if (result.data) setServerState(result.data);
        showToast(url ? "URL salva no backend." : "URL removida. A demo segue no backend local.");
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.querySelector("#testWebhook").addEventListener("click", async () => {
      const url = document.querySelector("#webhookUrl").value.trim();
      if (!url) {
        showToast("Salve a URL do Web App antes de testar.", "error");
        return;
      }
      try {
        await apiFetch("/api/settings", {
          method: "POST",
          body: JSON.stringify({ sheetsWebhookUrl: url })
        });
        const result = await apiFetch("/api/sheets-test", { method: "POST" });
        setServerState(result.data);
        showToast("Teste enviado. Confira a aba Logs na planilha e no painel.");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  function bindExport() {
    document.querySelector("#exportPedidos").addEventListener("click", () => {
      if (!state.pedidos.length) return showToast("Sem pedidos para exportar ainda.", "error");
      window.location.href = "/api/export/pedidos";
    });
    document.querySelector("#exportTarefas").addEventListener("click", () => {
      if (!state.tarefas.length) return showToast("Sem tarefas para exportar ainda.", "error");
      window.location.href = "/api/export/tarefas";
    });
    document.querySelector("#exportClientes").addEventListener("click", () => {
      if (!state.clientes.length) return showToast("Sem clientes para exportar ainda.", "error");
      window.location.href = "/api/export/clientes";
    });
  }

  async function init() {
    bindViewNavigation();
    bindBoard();
    bindClientRegister();
    bindQuickOrderForm();
    bindMenu();
    bindTabs();
    bindSearch();
    bindTableActions();
    bindClear();
    bindWebhookSettings();
    bindExport();

    const clientChat = createChatWidget({ chatId: "chat", formId: "messageForm", inputId: "messageInput", role: "cliente" });
    const ownerChat = createChatWidget({ chatId: "ownerChat", formId: "ownerMessageForm", inputId: "ownerMessageInput", role: "vendedor" });
    if (clientChat) clientChat.addMsg("bot", botReply("conversa", null, "cliente"));
    if (ownerChat) ownerChat.addMsg("bot", botReply("conversa", null, "vendedor"));

    render();
    goToView("landing");

    try {
      const session = await apiFetch("/api/session");
      setOwnerLoggedIn(Boolean(session.autenticado));

      if (session.autenticado) {
        await refreshData();
        const settings = await apiFetch("/api/settings");
        if (settings.sheetsConfigured) {
          document.querySelector("#webhookUrl").placeholder = "Google Sheets já configurado no backend";
        }
      }
    } catch (err) {
      showToast("Não consegui falar com o backend local. Confira se o Node está rodando.", "error");
      console.error("Auto.io: falha ao iniciar.", err);
    }

    refreshBadge();
  }

  init();
})();