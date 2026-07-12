# Processo TO-BE — Atendimento de Pedidos com a Auto.io

## 1. Visão Geral

O processo TO-BE representa como a Auto.io transforma o atendimento manual de pedidos em um fluxo estruturado, com IA local classificando cada mensagem recebida e um painel único centralizando pedidos, clientes, tarefas e o cardápio do dia.

Na nova proposta, a entrada de dados deixa de depender apenas da memória da vendedora. A mensagem recebida é digitada na tela de registro, uma IA local (via LM Studio) interpreta o conteúdo e organiza o resultado em pedido, tarefa ou conversa — com um fallback por regras simples para quando a IA não está disponível.

Duas mudanças estruturais completam o desenho: o **cardápio do dia**, que passa a ser a fonte única do que está pronto para retirada, e a **vitrine** exibida ao lado da conversa, que responde sozinha a pergunta "o que tem hoje?" antes mesmo de o cliente perguntar.

## 2. Fluxo Automatizado Proposto

O processo acontece da seguinte forma:

1. No início do expediente, a vendedora publica o cardápio do dia: informa quais itens estão prontos e quantas unidades tem de cada um.
2. Quem envia a mensagem vê essa vitrine ao lado da conversa, com preço e disponibilidade — itens esgotados aparecem como "sob encomenda". Tocar em um item já começa a mensagem.
3. A vendedora identifica quem enviou a mensagem (cadastro rápido de nome, telefone e endereço) ou reaproveita um cliente já cadastrado, reconhecido pelo telefone.
4. A mensagem recebida é digitada na tela de registro, como chegou pelo canal original.
5. O backend Node.js envia a mensagem para o LM Studio local, com o contexto do cliente e do cardápio do dia (preço, unidade e quantidade pronta de cada item).
6. A IA classifica a mensagem como pedido, tarefa ou conversa, e extrai produto, quantidade, data de entrega, pagamento e observações.
7. Se o LM Studio estiver indisponível, demorar além do tempo limite ou responder de forma inválida, o classificador por regras assume a análise automaticamente — o registro nunca é perdido.
8. O registro é salvo na base local (`app/data/db.json`) com status "Pendente", já com o valor estimado quando o produto casa com um item do cardápio.
9. A cada venda no balcão, a vendedora dá baixa na quantidade; ao chegar a zero, o item passa a "esgotado" na vitrine, mas continua aceitando encomenda.
10. O painel do vendedor atualiza indicadores, pedidos, clientes, tarefas, cardápio e logs.
11. A vendedora pode concluir, reabrir ou excluir qualquer pedido ou tarefa, e buscar registros por cliente ou produto.
12. Quando quiser, pode registrar um pedido manualmente pelo formulário, sem depender da IA.
13. No fim do expediente, "Encerrar o dia" zera as quantidades prontas e mantém o catálogo para amanhã.
14. Opcionalmente, cada registro também é replicado em uma planilha do Google Sheets via Apps Script.

## 3. Componentes da Solução

### 3.1 Registro de Mensagem e Cadastro de Cliente

Tela onde a mensagem recebida é digitada, com cadastro rápido de quem a enviou. Funciona tanto para o próprio vendedor digitar quanto para alguém digitar em nome do cliente.

Principais funções:

* registrar a mensagem recebida por qualquer canal;
* identificar ou cadastrar o remetente (nome, telefone, endereço, observação), reconhecendo clientes repetidos pelo telefone;
* exibir a vitrine do dia ao lado da conversa, com preço e disponibilidade;
* enviar a mensagem para classificação por IA.

### 3.2 Cardápio do Dia (Pronta Retirada)

Fonte única do que existe para vender agora. Cada item tem preço, unidade e quantidade pronta, e assume um de três estados: **pronto**, **esgotado** (no cardápio, mas sem unidade) ou **fora do cardápio** (não oferecido hoje).

Principais funções:

* publicar o que está pronto no início do dia, a partir do zero ou de um template (doceria, marmitaria, salgados);
* dar baixa na quantidade a cada venda no balcão;
* alimentar a vitrine do cliente e o contexto da IA com a disponibilidade real;
* encerrar o dia zerando as quantidades sem perder o catálogo.

### 3.3 Classificação por IA Local (LM Studio) com Fallback por Regras

Motor de interpretação que transforma texto livre em dados estruturados.

Principais funções:

* classificar a mensagem como pedido, tarefa ou conversa;
* extrair produto, quantidade, data de entrega, pagamento e observações;
* usar o cardápio do dia como contexto (inclusive a disponibilidade), sem tratá-lo como catálogo fechado;
* calcular o valor estimado quando o produto casa com um item do cardápio;
* acionar o fallback por regras quando o LM Studio falha, demora ou devolve resposta fora do formato, mantendo o registro funcionando.

### 3.4 Painel de Acompanhamento

Painel central organizado em cinco blocos, na ordem do dia: **Hoje** (indicadores), **Entrada** (mensagem e formulário), **Cardápio do dia**, **Registros** e **Ajustes**.

Principais funções:

* listar e buscar pedidos, clientes, tarefas, cardápio e logs;
* concluir, reabrir ou excluir pedidos e tarefas;
* exportar pedidos, tarefas e clientes em CSV;
* configurar a integração com o Google Sheets e limpar a base com segurança.

### 3.5 Controle de Acesso e Confiabilidade da Base

Camada que protege o que foi registrado.

Principais funções:

* exigir senha para abrir o painel, com sessão em cookie assinado e validade limitada;
* bloquear o acesso às rotas de leitura e alteração da base sem sessão válida;
* expor à tela de registro apenas o cardápio do dia, nunca a base de clientes e pedidos;
* gravar a base de forma atômica, de modo que uma falha no meio da escrita não corrompa os dados.

## 4. Como o TO-BE Resolve os Gargalos do AS-IS

| Gargalo no AS-IS | Solução no TO-BE |
| --- | --- |
| Falta de registro padronizado do pedido | A IA (ou o formulário manual) estrutura cada pedido em campos fixos: produto, quantidade, data, pagamento. |
| Ausência de base centralizada | Pedidos, clientes, tarefas, cardápio e logs ficam em uma única base local, visível no painel. |
| Uso do WhatsApp como registro principal | O WhatsApp continua sendo o canal de contato, mas deixa de ser o único repositório: a mensagem é registrada no sistema. |
| Dependência de memória ou anotações manuais | O registro e a classificação ficam salvos e consultáveis a qualquer momento. |
| Falta de referência de preços e itens comuns | O cardápio do dia guarda preço e unidade, e a IA usa isso para calcular o valor estimado. |
| Nenhum controle do que está pronto para retirada | O cardápio do dia registra a quantidade pronta, com baixa a cada venda e item marcado como esgotado ao zerar. |
| Cliente sem visibilidade do disponível | A vitrine ao lado da conversa mostra o que está pronto, o preço e o que só sai por encomenda. |
| Ausência de controle de status | Cada pedido e tarefa tem status "Pendente" ou "Concluído", com opção de reabrir. |
| Nenhum histórico ou exportação | Exportação em CSV pelo painel e, opcionalmente, espelhamento em Google Sheets. |

## 5. Diagrama do Processo TO-BE

```text
Início do dia: vendedora publica o cardápio (itens + quantidade pronta)
        ↓
Cliente vê a vitrine ao lado da conversa (preço, pronto ou sob encomenda)
        ↓
Vendedora identifica o remetente da mensagem
        ↓
Mensagem recebida é digitada na tela de registro
        ↓
Backend Node.js envia a mensagem ao LM Studio local
   (contexto: cliente identificado + cardápio do dia com disponibilidade)
        ↓
IA classifica: pedido / tarefa / conversa
   └─ IA desligada, lenta ou com resposta inválida → fallback por regras
        ↓
Registro salvo em app/data/db.json com status "Pendente" e valor estimado
        ↓
Venda no balcão → baixa na quantidade → item vira "esgotado" ao zerar
        ↓
Painel atualiza indicadores, pedidos, clientes, tarefas, cardápio e logs
        ↓
Fim do dia: "Encerrar o dia" zera as quantidades e mantém o catálogo
        ↓
Opcional: cópia enviada ao Google Sheets via Apps Script
```