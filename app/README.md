# Auto.io 

Este pacote transforma o escopo da Auto.io em uma aplicação demonstrável hoje.

## O que o MVP mostra

- Cliente envia uma mensagem de pedido.
- Dona do negócio envia uma tarefa da rotina.
- A aplicação classifica a mensagem.
- Pedido ou tarefa aparece na central de controle.
- Os dados ficam salvos no navegador.
- Opcionalmente, os registros são enviados para Google Sheets por Apps Script.
- CSV pode ser exportado para demonstrar rastreabilidade.

## Por que esse caminho é mais seguro para apresentação?

O fluxo antigo dependia de WhatsApp/Telegram, token, n8n, IA, memória do agente e Google Sheets ao mesmo tempo.
Para apresentação, isso é arriscado. O MVP preserva o valor de negócio, mas remove as partes instáveis do caminho crítico.

## Como rodar localmente

Abra o arquivo `index.html` no navegador.

## Como integrar com Google Sheets

1. Crie uma planilha no Google Sheets.
2. Vá em Extensões > Apps Script.
3. Cole o conteúdo de `apps-script.gs`.
4. Implante como Aplicativo da Web.
5. Copie a URL gerada.
6. Cole a URL no campo "Integração opcional com Google Sheets" no front.
7. Envie uma mensagem ou registre um pedido.

## Demonstração recomendada

1. Abra a aplicação.
2. Envie: "Oi, queria encomendar um cento de brigadeiros para sábado, pagamento por pix."
3. Mostre o pedido aparecendo na central.
4. Troque o papel para "Dona do negócio".
5. Envie: "Lembra de comprar açúcar amanhã cedo."
6. Mostre a tarefa aparecendo na central.
7. Exporte o CSV ou mostre a planilha se tiver conectado o Apps Script.

## Frase para apresentação

"A Auto.io resolve o problema de microempreendedoras que trabalham pelo WhatsApp e perdem pedidos ou tarefas porque não conseguem parar para organizar uma planilha. Mesmo neste MVP, a conversa já vira registro operacional e a dona ganha uma central de controle simples."
