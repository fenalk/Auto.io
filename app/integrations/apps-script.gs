/**
 * Auto.io — Backend em Google Sheets via Apps Script
 * ------------------------------------------------------------
 * Como implantar:
 *   1. Crie uma planilha no Google Sheets.
 *   2. Vá em Extensões > Apps Script.
 *   3. Apague o conteúdo padrão e cole este arquivo inteiro.
 *   4. Clique em Implantar > Nova implantação > Aplicativo da Web.
 *   5. Executar como: você mesmo.
 *   6. Quem pode acessar: qualquer pessoa com o link.
 *   7. Copie a URL gerada e cole no campo "Integração com Google
 *      Sheets" do front-end (index.html).
 *
 * Observação sobre CORS: o Apps Script não permite configurar
 * cabeçalhos CORS livremente, então o front-end envia as
 * requisições em modo "no-cors". Isso funciona para gravar dados,
 * mas o navegador nunca vê a resposta (ela chega "opaca"). Por
 * isso os retornos abaixo existem principalmente para quem testar
 * o endpoint diretamente (Postman, doGet no navegador etc.).
 * ------------------------------------------------------------
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // evita duas mensagens simultâneas colidirem na mesma linha

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const tipo = body.tipo;
    const payload = body.payload || {};

    switch (tipo) {
      case "pedido":
        appendPedido(ss, payload);
        break;
      case "tarefa":
        appendTarefa(ss, payload);
        break;
      case "cliente":
        appendCliente(ss, payload);
        break;
      case "atualizacao":
        atualizarStatus(ss, payload);
        break;
      case "teste":
        appendLog(ss, "teste", payload.mensagem || "Teste de conexão recebido");
        break;
      default:
        appendLog(ss, "desconhecido", JSON.stringify(payload));
    }

    return jsonResponse({ ok: true, tipo: tipo || "desconhecido" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Permite abrir a URL do Web App direto no navegador para checar se o deploy está no ar.
function doGet() {
  return jsonResponse({ ok: true, servico: "Auto.io", status: "online" });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   Escrita nas abas
   ============================================================ */
function getSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#241511").setFontColor("#F7ECDC");
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
  return sh;
}

function appendPedido(ss, p) {
  const headers = ["ID", "Data/Hora", "Cliente", "Telefone", "Produto", "Quantidade", "Data Entrega", "Pagamento", "Endereço", "Observações", "Status", "Origem"];
  const sh = getSheet(ss, "Pedidos", headers);
  sh.appendRow([
    p.id || "",
    p.dataHora || new Date(),
    p.cliente || "",
    p.telefone || "",
    p.produto || "",
    p.quantidade || "",
    p.dataEntrega || "",
    p.pagamento || "",
    p.endereco || "",
    p.observacoes || "",
    p.status || "Pendente",
    p.origem || "chat"
  ]);
  appendLog(ss, "pedido", "Pedido registrado: " + (p.produto || ""));
}

function appendTarefa(ss, t) {
  const headers = ["ID", "Data/Hora", "Tarefa", "Prazo", "Status", "Origem"];
  const sh = getSheet(ss, "Tarefas", headers);
  sh.appendRow([
    t.id || "",
    t.dataHora || new Date(),
    t.tarefa || "",
    t.prazo || "",
    t.status || "Pendente",
    t.origem || "chat"
  ]);
  appendLog(ss, "tarefa", "Tarefa registrada");
}

function appendCliente(ss, c) {
  const headers = ["ID", "Cadastro", "Nome", "Telefone", "Endereco", "Observacoes", "Atualizado Em"];
  const sh = getSheet(ss, "Clientes", headers);
  sh.appendRow([
    c.id || "",
    c.criadoEm || new Date(),
    c.nome || "",
    c.telefone || "",
    c.endereco || "",
    c.observacoes || "",
    c.atualizadoEm || ""
  ]);
  appendLog(ss, "cliente", "Cliente identificado: " + (c.nome || ""));
}

function appendLog(ss, tipo, mensagem) {
  const headers = ["Data/Hora", "Tipo", "Mensagem"];
  const sh = getSheet(ss, "Logs", headers);
  sh.appendRow([new Date(), tipo, mensagem]);
}

// Atualiza o Status de um pedido ou tarefa já existente, localizando a linha pelo ID.
// Usado quando o vendedor marca "Concluir"/"Reabrir" no painel.
function atualizarStatus(ss, payload) {
  const sheetName = payload.kind === "tarefas" ? "Tarefas" : "Pedidos";
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return;

  const data = sh.getDataRange().getValues();
  const idCol = 0; // coluna "ID" é sempre a primeira
  const statusColIndex = data[0].indexOf("Status");
  if (statusColIndex === -1) return;

  for (let row = 1; row < data.length; row++) {
    if (data[row][idCol] === payload.id) {
      sh.getRange(row + 1, statusColIndex + 1).setValue(payload.status || "Pendente");
      appendLog(ss, "atualizacao", `Status de ${payload.id} atualizado para ${payload.status}`);
      break;
    }
  }
}
