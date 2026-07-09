const STORAGE_KEY = "autoio-demo-v1";
const WEBHOOK_KEY = "autoio-webhook-url";

let state = loadState();
let currentRole = "cliente";
let currentTab = "pedidos";

const chat = document.querySelector("#chat");
const input = document.querySelector("#messageInput");

function loadState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"pedidos":[],"tarefas":[],"logs":[]}');
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function nowBR() {
  return new Date().toLocaleString("pt-BR");
}

function addLog(tipo, mensagem, origem = "front") {
  state.logs.unshift({ dataHora: nowBR(), tipo, mensagem, origem });
}

function normalize(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function classifyMessage(text, role) {
  const t = normalize(text);
  const taskWords = ["lembra", "lembrar", "comprar", "fazer", "tarefa", "anotar", "agenda", "preparar", "organizar"];
  const orderWords = ["quero", "pedido", "encomenda", "encomendar", "bolo", "brigadeiro", "docinho", "marmita", "cento", "unidade", "entrega", "retirar"];

  if (role === "dona" && taskWords.some(w => t.includes(w)) && !orderWords.some(w => t.includes(w))) return "tarefa";
  if (orderWords.some(w => t.includes(w))) return "pedido";
  if (taskWords.some(w => t.includes(w))) return "tarefa";
  return "conversa";
}

function extractOrder(text, role) {
  const t = normalize(text);
  const products = ["brigadeiro", "bolo", "docinho", "marmita", "beijinho", "cupcake", "salgado"];
  const produto = products.find(p => t.includes(p)) || "Pedido informado por mensagem";
  const qtdMatch = text.match(/(\d+)\s?(cento|unidades|unidade|un|bolos|marmitas|doces)?/i);
  const quantidade = qtdMatch ? qtdMatch[0] : (t.includes("cento") ? "1 cento" : "A confirmar");
  const pagamento = t.includes("pix") ? "Pix" : t.includes("cartao") ? "Cartão" : t.includes("dinheiro") ? "Dinheiro" : "A confirmar";

  let dataEntrega = "A confirmar";
  if (t.includes("amanha")) dataEntrega = "Amanhã";
  if (t.includes("sabado")) dataEntrega = "Sábado";
  if (t.includes("sexta")) dataEntrega = "Sexta-feira";
  if (t.includes("domingo")) dataEntrega = "Domingo";

  const clienteMatch = text.match(/cliente\s+([A-Za-zÀ-ÿ ]+?)\s+(pediu|quer|solicitou)/i);
  const cliente = clienteMatch ? clienteMatch[1].trim() : (role === "cliente" ? "Cliente do chat" : "Cliente informado");

  return {
    id: `PED-${Date.now()}`,
    dataHora: nowBR(),
    cliente,
    telefone: "",
    produto,
    quantidade,
    dataEntrega,
    pagamento,
    endereco: t.includes("retirar") ? "Retirada no local" : "A confirmar",
    observacoes: text,
    status: "Pendente"
  };
}

function extractTask(text) {
  let prazo = "Sem prazo";
  const t = normalize(text);
  if (t.includes("amanha")) prazo = "Amanhã";
  if (t.includes("hoje")) prazo = "Hoje";
  if (t.includes("cedo")) prazo += " cedo";

  return {
    id: `TAR-${Date.now()}`,
    dataHora: nowBR(),
    tarefa: text,
    prazo,
    status: "Pendente"
  };
}

function botReply(type, item) {
  if (type === "pedido") {
    return `Pedido registrado com sucesso! 🍰✅\n\nResumo:\nCliente: ${item.cliente}\nProduto: ${item.produto}\nQuantidade: ${item.quantidade}\nEntrega: ${item.dataEntrega}\nPagamento: ${item.pagamento}\n\nA central da Auto.io já foi atualizada.`;
  }
  if (type === "tarefa") {
    return `Tarefa salva com sucesso! ✅\n\n${item.tarefa}\nPrazo: ${item.prazo}\n\nA dona não precisa abrir planilha: a conversa virou registro.`;
  }
  return "Oi! Eu sou a Auto.io 🍰. Posso registrar pedidos de clientes ou tarefas da rotina do negócio.";
}

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
  }
}

function addMessage(who, text) {
  const div = document.createElement("div");
  div.className = `msg ${who}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

document.querySelectorAll(".role").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".role").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentRole = btn.dataset.role;
  });
});

document.querySelectorAll("[data-example]").forEach(btn => {
  btn.addEventListener("click", () => {
    input.value = btn.dataset.example;
    input.focus();
  });
});

document.querySelector("#messageForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage("user", text);
  input.value = "";

  const type = classifyMessage(text, currentRole);
  let item = null;

  if (type === "pedido") {
    item = extractOrder(text, currentRole);
    state.pedidos.unshift(item);
    addLog("pedido", `Pedido registrado: ${item.produto} / ${item.quantidade}`);
    await sendToWebhook("pedido", item);
  } else if (type === "tarefa") {
    item = extractTask(text);
    state.tarefas.unshift(item);
    addLog("tarefa", `Tarefa registrada: ${item.tarefa}`);
    await sendToWebhook("tarefa", item);
  } else {
    addLog("conversa", text);
  }

  addMessage("bot", botReply(type, item));
  saveState();
});

document.querySelector("#quickOrderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const item = {
    id: `PED-${Date.now()}`,
    dataHora: nowBR(),
    cliente: fd.get("cliente"),
    telefone: fd.get("telefone"),
    produto: fd.get("produto"),
    quantidade: fd.get("quantidade"),
    dataEntrega: fd.get("dataEntrega"),
    pagamento: fd.get("pagamento"),
    endereco: fd.get("endereco"),
    observacoes: fd.get("observacoes"),
    status: "Pendente"
  };
  state.pedidos.unshift(item);
  addLog("pedido", `Pedido manual registrado: ${item.produto}`);
  await sendToWebhook("pedido", item);
  e.target.reset();
  saveState();
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentTab = btn.dataset.tab;
    renderTable();
  });
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  if (!confirm("Limpar os dados da demonstração?")) return;
  state = { pedidos: [], tarefas: [], logs: [] };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
});

document.querySelector("#saveWebhook").addEventListener("click", () => {
  localStorage.setItem(WEBHOOK_KEY, document.querySelector("#webhookUrl").value.trim());
  alert("URL salva. Próximos registros tentarão enviar ao Google Sheets.");
});

document.querySelector("#exportPedidos").addEventListener("click", () => exportCSV("pedidos", state.pedidos));
document.querySelector("#exportTarefas").addEventListener("click", () => exportCSV("tarefas", state.tarefas));

function render() {
  document.querySelector("#pedidosCount").textContent = state.pedidos.length;
  document.querySelector("#tarefasCount").textContent = state.tarefas.length;
  document.querySelector("#clientesCount").textContent = new Set(state.pedidos.map(p => p.cliente)).size;
  document.querySelector("#pendentesCount").textContent = [
    ...state.pedidos.filter(p => p.status === "Pendente"),
    ...state.tarefas.filter(t => t.status === "Pendente")
  ].length;
  renderTable();
}

function renderTable() {
  const wrap = document.querySelector("#tableWrap");
  if (currentTab === "pedidos") {
    wrap.innerHTML = table(state.pedidos, ["dataHora", "cliente", "produto", "quantidade", "dataEntrega", "pagamento", "status", "observacoes"]);
  } else if (currentTab === "tarefas") {
    wrap.innerHTML = table(state.tarefas, ["dataHora", "tarefa", "prazo", "status"]);
  } else {
    wrap.innerHTML = table(state.logs, ["dataHora", "tipo", "mensagem", "origem"]);
  }
}

function table(rows, cols) {
  if (!rows.length) return `<div style="padding:18px;color:#72584c">Nenhum registro ainda.</div>`;
  return `<table><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(row => `<tr>${cols.map(c => `<td>${c === "status" ? `<span class="status">${row[c] || ""}</span>` : escapeHTML(row[c] || "")}</td>`).join("")}</tr>`).join("")}
  </tbody></table>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
}

function exportCSV(name, rows) {
  if (!rows.length) return alert("Sem dados para exportar.");
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(";"), ...rows.map(row => cols.map(c => `"${String(row[c] || "").replaceAll('"', '""')}"`).join(";"))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-autoio.csv`;
  a.click();
}

document.querySelector("#webhookUrl").value = localStorage.getItem(WEBHOOK_KEY) || "";
addMessage("bot", "Bem-vindo à Auto.io 🍰. Envie uma mensagem de pedido ou uma tarefa da rotina para eu registrar automaticamente.");
render();
