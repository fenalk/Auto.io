# Auto.io — Assistente inteligente para microempreendedoras do ramo alimentício

A **Auto.io** é uma automação voltada para confeiteiras, doceiras, marmiteiras e demais
microempreendedoras da área de alimentação que gerenciam o negócio inteiro pelo WhatsApp —
muitas vezes com a mão na massa, sem tempo para abrir planilhas ou responder mensagens na hora.

A proposta conecta o WhatsApp da empreendedora a um agente de inteligência artificial com
memória de conversa, capaz de distinguir sozinho dois tipos de interação:

- **um cliente querendo fazer um pedido**, e
- **a própria dona registrando uma tarefa da rotina**.

Sem menus e sem comandos especiais: a IA entende o contexto da mensagem e decide o que fazer.

Quando um cliente manda algo como *"quero encomendar um cento de brigadeiros para sábado"*, o
agente responde de forma acolhedora e registra o pedido automaticamente. Quando a dona manda
*"lembra de comprar açúcar amanhã cedo"*, o agente salva o lembrete na aba de tarefas. Em ambos
os casos, a empreendedora não digita nada em lugar nenhum — **a conversa já é o registro**.

O resultado é uma central de controle simples e visual, alimentada em tempo real pela IA, que
resolve três problemas crônicos de quem trabalha sozinha no ramo alimentício: pedidos
esquecidos, tarefas anotadas em papel e a impossibilidade de parar a produção para organizar
informações.

---

## Sobre este pacote

Na visão completa, a Auto.io depende de várias peças ligadas ao mesmo tempo:
WhatsApp/Telegram, token de API, orquestração no **n8n**, o agente de IA com memória e o Google
Sheets. Isso entrega muito valor, mas é frágil para rodar em uma apresentação ao vivo — basta
um token expirar ou a IA sair do ar para a demonstração travar.

Este pacote é um **MVP demonstrável hoje, direto no navegador**. Ele preserva o valor de negócio
da Auto.io (a conversa virar registro operacional e a dona ganhar uma central de controle) e
remove as partes instáveis do caminho crítico. A classificação pedido/tarefa e a extração de
dados (produto, quantidade, data, forma de pagamento) rodam localmente, sem depender de nenhum
serviço externo. A integração com o Google Sheets continua disponível, porém **opcional**.

### O que o MVP faz

- O cliente conversa como faria no WhatsApp e recebe a confirmação do pedido na hora.
- A dona registra pedidos recebidos por telefone e tarefas da rotina pela mesma conversa.
- Cada mensagem é classificada automaticamente como pedido, tarefa ou conversa.
- Pedidos e tarefas aparecem na central de controle, com busca, status e KPIs.
- Existe um **registro rápido manual** como plano B, caso a dona prefira preencher um formulário.
- Os dados ficam salvos no navegador (localStorage) entre sessões.
- Opcionalmente, cada registro é enviado para o Google Sheets via Apps Script.
- Pedidos e tarefas podem ser exportados em CSV.

---

## Telas

1. **Seleção de perfil** — a pessoa escolhe entrar como *cliente* ou como *dona do negócio*.
2. **Área do cliente** — uma conversa em tela cheia, no estilo WhatsApp, só para fazer pedidos.
3. **Login da dona** — protege o painel com senha (ambiente de demonstração: senha `12345`).
4. **Painel da dona** — registro por mensagem, registro rápido manual, central de controle
   (pedidos, tarefas e logs), exportação em CSV e a integração com o Google Sheets.

---

## Como rodar localmente

Abra o arquivo `index.html` no navegador. Não é preciso instalar nada nem subir servidor.

---

## Como integrar com o Google Sheets (opcional)

1. Crie uma planilha no Google Sheets.
2. Vá em **Extensões > Apps Script**.
3. Apague o conteúdo padrão e cole o arquivo `apps-script.gs` inteiro.
4. Clique em **Implantar > Nova implantação > Aplicativo da Web**.
   - *Executar como:* você mesmo.
   - *Quem pode acessar:* qualquer pessoa com o link.
5. Copie a URL gerada.
6. No painel da dona, cole a URL no campo **"Integração com Google Sheets"** e clique em **Salvar URL**.
7. Envie uma mensagem ou registre um pedido — ele aparece nas abas *Pedidos*, *Tarefas* e *Logs*.

> **Sobre a confirmação de envio:** o Apps Script não devolve uma resposta legível ao navegador
> (a requisição é enviada em modo `no-cors`), então o botão **"Testar envio"** apenas confirma
> que a mensagem saiu. Para validar o recebimento, confira a aba **Logs** da sua planilha.

---

## Estrutura dos arquivos

| Arquivo          | Função                                                                 |
|------------------|------------------------------------------------------------------------|
| `index.html`     | Marcação das quatro telas e componentes de UI.                         |
| `styles.css`     | Tema visual ("comanda de confeitaria") e layout responsivo.            |
| `script.js`      | Navegação, classificação de mensagens, central de controle e CSV.      |
| `apps-script.gs` | Backend opcional no Google Sheets (grava nas abas Pedidos/Tarefas/Logs).|

---

## Observações técnicas

- **Sem dependências e sem build:** HTML, CSS e JavaScript puros. Todo o JS roda dentro de uma
  IIFE para não vazar variáveis globais.
- **Persistência local:** os registros ficam no `localStorage` do navegador; a sessão da dona
  fica no `sessionStorage`. Limpar os dados do navegador reinicia a demonstração.
- **Classificação por pontuação:** em vez de um único `if`, a mensagem é pontuada por
  palavras-chave de pedido e de tarefa, o que reduz erros quando um texto mistura os dois. O
  papel de quem escreve (cliente/dona) serve de desempate.
- **Responsivo:** a área do cliente ocupa a tela inteira como um app de conversa; o painel se
  reorganiza em coluna única em telas menores.