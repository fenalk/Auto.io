/**
 * Auto.io — Backend Google Sheets via Apps Script
 *
 * Como usar:
 * 1. Crie uma planilha no Google Sheets.
 * 2. Vá em Extensões > Apps Script.
 * 3. Cole este código.
 * 4. Clique em Implantar > Nova implantação > Aplicativo da Web.
 * 5. Executar como: você mesmo.
 * 6. Quem pode acessar: qualquer pessoa com o link.
 * 7. Copie a URL e cole no campo "Integração opcional com Google Sheets" do front.
 */

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const body = JSON.parse(e.postData.contents || "{}");
  const tipo = body.tipo;
  const payload = body.payload || {};

  if (tipo === "pedido") {
    appendPedido(ss, payload);
  } else if (tipo === "tarefa") {
    appendTarefa(ss, payload);
  } else {
    appendLog(ss, "desconhecido", JSON.stringify(payload));
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function appendPedido(ss, p) {
  const headers = ["ID", "Data/Hora", "Cliente", "Telefone", "Produto", "Quantidade", "Data Entrega", "Pagamento", "Endereço", "Observações", "Status"];
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
    p.status || "Pendente"
  ]);
  appendLog(ss, "pedido", "Pedido registrado: " + (p.produto || ""));
}

function appendTarefa(ss, t) {
  const headers = ["ID", "Data/Hora", "Tarefa", "Prazo", "Status"];
  const sh = getSheet(ss, "Tarefas", headers);
  sh.appendRow([
    t.id || "",
    t.dataHora || new Date(),
    t.tarefa || "",
    t.prazo || "",
    t.status || "Pendente"
  ]);
  appendLog(ss, "tarefa", "Tarefa registrada");
}

function appendLog(ss, tipo, mensagem) {
  const headers = ["Data/Hora", "Tipo", "Mensagem"];
  const sh = getSheet(ss, "Logs", headers);
  sh.appendRow([new Date(), tipo, mensagem]);
}
