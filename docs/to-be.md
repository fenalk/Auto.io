# Processo TO-BE — Atendimento de Pedidos com a Auto.io

## 1. Visão Geral

O processo TO-BE representa como a Auto.io transforma o atendimento manual de pedidos em um fluxo estruturado, com IA local classificando cada mensagem recebida e um painel único centralizando pedidos, clientes, tarefas e itens de referência.

Na nova proposta, a entrada de dados deixa de depender apenas da memória da vendedora. A mensagem recebida é digitada na tela de registro, uma IA local (via LM Studio) interpreta o conteúdo e organiza o resultado em pedido, tarefa ou conversa — com um fallback por regras simples para quando a IA não está disponível.

## 2. Fluxo Automatizado Proposto

O processo acontece da seguinte forma:

1. A vendedora identifica quem enviou a mensagem (cadastro rápido de nome, telefone e endereço) ou usa um cliente já cadastrado.
2. A mensagem recebida é digitada na tela de registro, como chegou pelo canal original.
3. O backend Node.js envia a mensagem para o LM Studio local, com o contexto do cliente e dos itens de referência cadastrados.
4. A IA classifica a mensagem como pedido, tarefa ou conversa, e extrai produto, quantidade, data de entrega, pagamento e observações.
5. Se o LM Studio estiver indisponível ou responder de forma inválida, um classificador por regras assume a análise automaticamente.
6. O registro é salvo na base local (`app/data/db.json`) com status "Pendente".
7. O painel do vendedor atualiza indicadores, tabela de pedidos, clientes, tarefas, itens/preços e logs em tempo real.
8. A vendedora pode concluir, reabrir ou excluir qualquer pedido ou tarefa, e buscar registros por cliente ou produto.
9. Quando quiser, pode registrar um pedido manualmente pelo formulário de fallback, sem depender da IA.
10. Opcionalmente, cada registro também é replicado em uma planilha do Google Sheets via Apps Script.

## 3. Componentes da Solução

### 3.1 Registro de Mensagem e Cadastro de Cliente

Tela onde a mensagem recebida é digitada, com cadastro rápido de quem a enviou. Funciona tanto para o próprio vendedor digitar quanto para alguém digitar em nome do cliente.

Principais funções:

* registrar a mensagem recebida por qualquer canal;
* identificar ou cadastrar o remetente (nome, telefone, endereço, observação);
* enviar a mensagem para classificação por IA.

### 3.2 Classificação por IA Local (LM Studio) com Fallback por Regras

Motor de interpretação que transforma texto livre em dados estruturados.

Principais funções:

* classificar a mensagem como pedido, tarefa ou conversa;
* extrair produto, quantidade, data de entrega, pagamento e observações;
* usar os itens de referência cadastrados como contexto, sem tratá-los como catálogo fechado;
* acionar o fallback por regras simples quando o LM Studio falha, mantendo o registro funcionando.

### 3.3 Painel de Acompanhamento

Painel central com indicadores de pedidos, tarefas, clientes e pendências.

Principais funções:

* listar e buscar pedidos, clientes, tarefas, itens/preços e logs;
* concluir, reabrir ou excluir pedidos e tarefas;
* exportar pedidos, tarefas e clientes em CSV;
* manter itens e preços de referência, com templates prontos por segmento (doceria, marmitaria, salgados).

## 4. Como o TO-BE Resolve os Gargalos do AS-IS

| Gargalo no AS-IS | Solução no TO-BE |
| --- | --- |
| Falta de registro padronizado do pedido | A IA (ou o formulário manual) estrutura cada pedido em campos fixos: produto, quantidade, data, pagamento. |
| Ausência de base centralizada | Pedidos, clientes, tarefas, itens e logs ficam em uma única base local, visível no painel. |
| Uso do WhatsApp como registro principal | O WhatsApp continua sendo o canal de contato, mas deixa de ser o único repositório: a mensagem é registrada no sistema. |
| Dependência de memória ou anotações manuais | O registro e a classificação ficam salvos e consultáveis a qualquer momento. |
| Falta de referência de preços e itens comuns | Itens e preços de referência ficam cadastrados e são usados como contexto pela IA. |
| Ausência de controle de status | Cada pedido e tarefa tem status "Pendente" ou "Concluído", com opção de reabrir. |
| Nenhum histórico ou exportação | Exportação em CSV pelo painel e, opcionalmente, espelhamento em Google Sheets. |

## 5. Diagrama do Processo TO-BE

```text
Vendedora identifica o remetente da mensagem
        ↓
Mensagem recebida é digitada na tela de registro
        ↓
Backend Node.js envia a mensagem ao LM Studio local
        ↓
IA classifica: pedido / tarefa / conversa   (fallback por regras se a IA falhar)
        ↓
Registro salvo em app/data/db.json com status "Pendente"
        ↓
Painel atualiza indicadores, pedidos, clientes, tarefas, itens/preços e logs
        ↓
Opcional: cópia enviada ao Google Sheets via Apps Script
```
