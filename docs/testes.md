# Casos de Teste — Auto.io

## 1. Objetivo

Este documento descreve os critérios de aceitação da Auto.io, com foco no fluxo de registro e classificação de mensagens recebidas pelo vendedor e na gestão do cardápio do dia.

Os testes verificam se o sistema consegue publicar o que está pronto para retirada, registrar mensagens, classificá-las com a IA local (ou com o fallback por regras), registrar pedidos manualmente, acompanhar status, proteger a base e exportar os dados.

## 2. Pré-condições Gerais

Antes da execução dos testes, devem existir:

* backend Node.js em execução (`npm start` em `app/`);
* arquivo `.env` configurado a partir de `.env.example`, com `SELLER_PASSWORD` e `SESSION_SECRET` preenchidos;
* LM Studio local em execução (opcional — o sistema usa fallback por regras se estiver desligado);
* navegador com acesso a `http://localhost:3000`.

## 3. Casos de Teste

### 3.1 Registro e Classificação

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT01 | Sim | Registrar pedido por mensagem com IA ativa | LM Studio em execução | Na tela de registro, enviar "quero encomendar 100 brigadeiros para sábado". | Pedido criado com produto, quantidade e data de entrega preenchidos, status "Pendente" e origem `lm-studio-local`. |
| CT02 | Sim | Classificar mensagem sem IA disponível | LM Studio desligado | Enviar a mesma mensagem do CT01. | O fallback por regras assume, o pedido é registrado com origem `fallback-regra` e o log registra `erro_ia`. |
| CT03 | Sim | Fallback quando a IA trava | LM Studio ligado, mas sem responder (modelo carregando ou travado) | Enviar uma mensagem de pedido e cronometrar a resposta. | O sistema aguarda no máximo o tempo de `LMSTUDIO_TIMEOUT_MS`, cai no fallback e registra o pedido. A tela não fica travada. |
| CT04 | Sim | Resposta da IA fora do formato esperado | LM Studio devolvendo tipo inválido (ex.: "Pedido" com maiúscula ou texto livre) | Enviar uma mensagem de pedido. | O sistema normaliza o tipo ou cai no fallback. Em nenhum caso a mensagem é descartada em silêncio: sempre existe registro ou log correspondente. |
| CT05 | Sim | Registrar tarefa a partir de mensagem do vendedor | Login como vendedor feito | Enviar pela caixa do vendedor "lembra de comprar açúcar amanhã". | A mensagem é registrada como tarefa, não como pedido. |
| CT06 | Sim | Registrar pedido manualmente | Login como vendedor feito | Preencher o formulário de registro manual com cliente, produto e quantidade, e enviar. | O pedido aparece na tabela com origem `manual`, sem depender da IA. |

### 3.2 Clientes

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT07 | Sim | Cadastrar cliente pelo remetente da mensagem | Nenhum cliente com o mesmo telefone | Preencher nome, telefone e endereço na tela de identificação do remetente e enviar uma mensagem. | O cliente é salvo e seus dados são reaproveitados no pedido. |
| CT08 | Não | Reconhecer cliente com telefone em formato diferente | Cliente já cadastrado com `(91) 99999-9999` | Cadastrar novamente o mesmo cliente digitando `91999999999`. | O sistema reconhece o mesmo cliente e atualiza o cadastro, sem criar duplicata. |

### 3.3 Cardápio do Dia

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT09 | Sim | Publicar item pronto para retirada | Login como vendedor feito | No bloco Cardápio do dia, adicionar "Coxinha", preço R$ 5,00, 12 prontos. | O item aparece com etiqueta "Pronto" e o resumo do card informa as unidades disponíveis. |
| CT10 | Não | Adicionar template de cardápio | Login como vendedor feito | Selecionar um template (ex.: Marmitaria) e clicar em usar modelo pronto. | Os itens do template aparecem no cardápio com quantidade zerada, aguardando a vendedora informar o que preparou. |
| CT11 | Sim | Dar baixa ao vender no balcão | Item com 12 unidades prontas | Clicar em `−` uma vez. | A quantidade passa a 11 e a alteração persiste após recarregar a página. |
| CT12 | Sim | Item esgotado continua aceitando encomenda | Item com 1 unidade pronta | Clicar em `−` até zerar. | O item passa a "Esgotado", permanece no cardápio e aparece como "Sob encomenda" para o cliente. |
| CT13 | Não | Tirar item do cardápio do dia | Item cadastrado | Clicar em "Tirar do cardápio". | O item some da vitrine do cliente, mas continua no catálogo do painel, esmaecido. |
| CT14 | Sim | Encerrar o dia | Ao menos um item com quantidade maior que zero | Clicar em "Encerrar o dia" e confirmar. | Todas as quantidades vão a zero, nenhum item é excluído e o log registra o encerramento. |
| CT15 | Sim | Vitrine do dia visível para quem envia a mensagem | Cardápio com um item pronto e um esgotado | Abrir a tela de registro de mensagem. | A vitrine lista o item pronto com a quantidade disponível e o esgotado como "Sob encomenda". Nenhum dado de cliente ou pedido é exibido. |
| CT16 | Não | Iniciar mensagem a partir da vitrine | Cardápio com item pronto | Tocar no item na vitrine. | O campo de mensagem é preenchido com um rascunho ("Quero 1 Coxinha para retirar hoje."), pronto para ajuste e envio. |
| CT17 | Sim | Calcular valor estimado pelo cardápio | Item cadastrado (ex.: Brigadeiro, R$ 2,50) | Enviar "quero 100 brigadeiros para sábado". | O pedido traz o valor estimado de R$ 250,00, calculado a partir do preço do item. |

### 3.4 Acompanhamento e Exportação

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT18 | Sim | Concluir e reabrir um pedido | Existe ao menos um pedido pendente | Clicar em "Concluir" e depois em "Reabrir". | O status alterna entre "Concluído" e "Pendente", e o indicador de pendências acompanha a mudança. |
| CT19 | Não | Buscar registros no painel | Existem pedidos cadastrados | Digitar o nome de um cliente ou produto no campo de busca. | A tabela filtra apenas os registros que contêm o termo buscado. |
| CT20 | Não | Exportar pedidos em CSV | Existe ao menos um pedido cadastrado | Clicar em "Exportar pedidos (CSV)". | Um arquivo CSV é baixado, abre no Excel com os acentos corretos e traz todas as colunas do pedido. |
| CT21 | Não | Limpar a base preservando o cardápio | Existem pedidos e itens no cardápio | Clicar em "Limpar base" (bloco Ajustes) e confirmar. | Pedidos, clientes, tarefas e logs são apagados; o cardápio e o perfil permanecem. |

### 3.5 Acesso e Segurança

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT22 | Não | Login do vendedor com senha incorreta | Senha configurada em `SELLER_PASSWORD` | Tentar entrar no painel com senha errada. | O sistema exibe "Senha incorreta" e não libera o painel. |
| CT23 | Sim | Bloquear acesso à base sem sessão | Servidor em execução, sem login feito | Chamar `GET /api/data` diretamente (navegador ou `curl`), sem cookie de sessão. | O servidor responde `401` e não devolve nenhum dado. O mesmo vale para exclusão, exportação e ajustes. |
| CT24 | Não | Vitrine não expõe dados internos | Cardápio publicado | Chamar `GET /api/cardapio-do-dia` sem login. | A resposta traz apenas nome, categoria, descrição, preço, unidade, quantidade e disponibilidade — sem ids internos, clientes ou pedidos. |

### 3.6 Integração e Resiliência

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT25 | Não | Enviar registro ao Google Sheets | `SHEETS_WEBHOOK_URL` configurada e válida | Registrar um pedido com a integração ativa. | O pedido aparece na aba "Pedidos" da planilha vinculada e o log registra o envio. |
| CT26 | Não | Falha no Google Sheets não derruba o registro | URL do Sheets inválida ou fora do ar | Registrar um pedido. | O pedido é salvo normalmente na base local e o log registra `erro_sheets`. |
| CT27 | Não | Base corrompida não derruba o app | Servidor parado | Corromper manualmente o `app/data/db.json` e iniciar o servidor. | O arquivo é preservado como `db.json.corrompido-<timestamp>`, uma base nova é criada e o app continua respondendo. |

## 4. Casos Prioritários

Para a validação principal do sistema, os casos prioritários são:

| Código | Justificativa |
| --- | --- |
| CT01 | Demonstra a classificação de pedido pela IA local. |
| CT02 | Garante que o sistema continua funcionando sem o LM Studio. |
| CT03 | Garante que uma IA lenta ou travada não bloqueia o atendimento. |
| CT04 | Garante que nenhuma mensagem é perdida quando a IA responde fora do formato. |
| CT05 | Demonstra a distinção entre pedido e tarefa. |
| CT06 | Garante o fallback manual mesmo sem IA. |
| CT09, CT11, CT12, CT14 | Demonstram o ciclo completo do cardápio do dia: publicar, vender, esgotar e encerrar. |
| CT15 | Demonstra a vitrine que responde "o que tem hoje?" sem ocupar a vendedora. |
| CT17 | Demonstra o cálculo do valor estimado a partir do cardápio. |
| CT18 | Garante o controle de status dos registros. |
| CT23 | Garante que a base de clientes e pedidos não fica exposta. |

## 5. Critério de Aceitação Geral

O sistema será considerado funcional quando o vendedor conseguir publicar o cardápio do dia, registrar uma mensagem recebida, ter o pedido ou a tarefa classificado automaticamente (ou registrado manualmente), acompanhar o status no painel, buscar e exportar os registros — tudo isso mesmo com o LM Studio desligado ou travado, com o cliente enxergando apenas o que está disponível, e com a base protegida por senha.