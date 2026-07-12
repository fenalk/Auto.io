# Casos de Teste — Auto.io

## 1. Objetivo

Este documento descreve os critérios de aceitação da Auto.io, com foco no fluxo de registro e classificação de mensagens recebidas pelo vendedor.

Os testes verificam se o sistema consegue registrar mensagens, classificá-las com a IA local (ou com o fallback por regras), registrar pedidos manualmente, manter itens de referência, acompanhar status e exportar os dados.

## 2. Pré-condições Gerais

Antes da execução dos testes, devem existir:

* backend Node.js em execução (`npm start` em `app/`);
* arquivo `.env` configurado a partir de `.env.example`;
* LM Studio local em execução (opcional — o sistema usa fallback por regras se estiver desligado);
* navegador com acesso a `http://localhost:3000`.

## 3. Casos de Teste

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT01 | Sim | Registrar pedido por mensagem com IA ativa | LM Studio em execução | Na tela de registro, enviar uma mensagem como "quero encomendar 100 brigadeiros para sábado". | O pedido deve ser criado com produto, quantidade e data de entrega preenchidos, status "Pendente". |
| CT02 | Sim | Classificar mensagem sem IA disponível | LM Studio desligado | Enviar a mesma mensagem do CT01 com o LM Studio desligado. | O sistema deve usar o fallback por regras e ainda assim registrar o pedido, com origem marcada como fallback. |
| CT03 | Sim | Registrar tarefa a partir de mensagem do vendedor | Login como vendedor feito | Enviar pela caixa do vendedor uma mensagem como "lembra de comprar açúcar amanhã". | A mensagem deve ser registrada como tarefa, não como pedido. |
| CT04 | Sim | Cadastrar cliente pelo remetente da mensagem | Nenhum cliente cadastrado com o mesmo telefone | Preencher nome, telefone e endereço na tela de identificação do remetente e enviar uma mensagem. | O cliente deve ser salvo e reaproveitado nos próximos pedidos com o mesmo telefone. |
| CT05 | Não | Login do vendedor com senha incorreta | Senha configurada em `SELLER_PASSWORD` | Tentar entrar no painel com uma senha errada. | O sistema deve exibir "Senha incorreta" e não liberar o acesso ao painel. |
| CT06 | Sim | Registrar pedido manualmente (fallback) | Login como vendedor feito | Preencher o formulário de registro manual com cliente, produto, quantidade e enviar. | O pedido deve aparecer na tabela de pedidos com origem "manual", sem depender da IA. |
| CT07 | Sim | Usar item de referência para calcular valor estimado | Item de referência cadastrado (ex.: Marmita pequena, R$ 16,00) | Enviar uma mensagem pedindo esse item com quantidade definida. | O pedido deve trazer o valor estimado calculado a partir do preço de referência. |
| CT08 | Não | Adicionar template de itens de referência | Login como vendedor feito | Selecionar um template (ex.: Marmitaria) e clicar em adicionar referências. | Os itens do template devem aparecer na lista de itens/preços de referência. |
| CT09 | Sim | Concluir e reabrir um pedido | Existe ao menos um pedido pendente | Clicar em "Concluir" no pedido e depois em "Reabrir". | O status deve alternar entre "Concluído" e "Pendente" corretamente. |
| CT10 | Não | Buscar registros no painel | Existem pedidos cadastrados | Digitar o nome de um cliente ou produto no campo de busca. | A tabela deve filtrar apenas os registros que contêm o termo buscado. |
| CT11 | Não | Exportar pedidos em CSV | Existe ao menos um pedido cadastrado | Clicar em "Exportar pedidos (CSV)". | Um arquivo CSV com os pedidos deve ser baixado. |
| CT12 | Não | Enviar registro ao Google Sheets | `SHEETS_WEBHOOK_URL` configurada e válida | Registrar um pedido com a integração configurada. | O pedido deve aparecer na aba "Pedidos" da planilha vinculada. |

## 4. Casos Prioritários

Para a validação principal do sistema, os casos prioritários são:

| Código | Justificativa |
| --- | --- |
| CT01 | Demonstra a classificação de pedido pela IA local. |
| CT02 | Garante que o sistema continua funcionando sem o LM Studio. |
| CT03 | Demonstra a distinção entre pedido e tarefa. |
| CT06 | Garante o fallback manual mesmo sem IA. |
| CT07 | Demonstra o uso dos itens de referência no cálculo do valor estimado. |
| CT09 | Garante o controle de status dos registros. |

## 5. Critério de Aceitação Geral

O sistema será considerado funcional quando o vendedor conseguir registrar uma mensagem recebida, ter o pedido ou a tarefa classificado automaticamente (ou registrado manualmente), acompanhar o status no painel, buscar e exportar os registros, mesmo sem o LM Studio disponível.
