# Casos de Teste — Auto.io

## 1. Objetivo

Este documento descreve os critérios de aceitação da Auto.io, cobrindo os dois caminhos de entrada do pedido:

* o **cliente**, que chega pelo link divulgado nas redes sociais, vê o cardápio do dia e escreve o pedido em texto livre;
* a **vendedora**, que registra pelo painel o pedido chegado por outro canal (WhatsApp, telefone, balcão) ou pelo formulário manual.

Os testes verificam a interpretação por IA local, o fallback por regras, a gestão do cardápio do dia, o acompanhamento dos registros, a proteção da base e a exportação dos dados.

## 2. Pré-condições Gerais

Antes da execução dos testes, devem existir:

* backend Node.js em execução (`npm start` em `app/`);
* arquivo `.env` configurado a partir de `.env.example`, com `SELLER_PASSWORD` e `SESSION_SECRET` preenchidos;
* LM Studio local em execução (opcional — o sistema usa fallback por regras se estiver desligado);
* navegador com acesso a `http://localhost:3000` (no cenário real, o link divulgado no perfil).

## 3. Casos de Teste

### 3.1 Pedido pelo Cliente (autoatendimento pelo link)

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT01 | Sim | Cliente vê o cardápio do dia ao abrir o link | Cardápio com um item pronto e um esgotado | Abrir o link e clicar em "Começar meu pedido". | A vitrine lista o item pronto com a quantidade disponível e o esgotado como "Sob encomenda". Nenhum dado de outro cliente ou pedido aparece. |
| CT02 | Sim | Cliente se identifica e faz o pedido em texto livre | LM Studio em execução | Preencher nome, telefone e endereço; enviar "quero 2 bolos de chocolate para sábado, pago no pix". | O pedido é criado com produto, quantidade, data de entrega e pagamento preenchidos, status "Pendente" e origem `lm-studio-local`. O cliente recebe a confirmação na tela. |
| CT03 | Sim | Pedido do cliente chega estruturado no painel | CT02 executado | Entrar no painel do vendedor e abrir a aba Pedidos. | O pedido aparece com cliente, telefone, produto, quantidade, data e valor estimado — sem nenhuma digitação da vendedora. |
| CT04 | Não | Iniciar o pedido a partir da vitrine | Cardápio com item pronto | Tocar em um item da vitrine. | O campo de mensagem é preenchido com um rascunho ("Quero 1 Bolo de cenoura para retirar hoje."), pronto para ajuste e envio. |
| CT05 | Não | Encomenda de item esgotado | Item no cardápio com quantidade zero | Tocar no item esgotado e enviar o pedido. | O pedido é registrado normalmente. A resposta indica que o item sai sob encomenda, e não por pronta retirada. |
| CT06 | Não | Cliente recorrente é reconhecido | Cliente já cadastrado com `(91) 99999-9999` | Fazer um novo pedido informando `91999999999`. | O sistema reconhece o mesmo cliente, atualiza o cadastro e não cria duplicata. |

### 3.2 Interpretação por IA e Resiliência

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT07 | Sim | Pedido registrado sem IA disponível | LM Studio desligado | Enviar o mesmo pedido do CT02. | O fallback por regras assume, o pedido é registrado com origem `fallback-regra` e o log guarda o `erro_ia`. Para o cliente, o fluxo é idêntico. |
| CT08 | Sim | IA ligada, mas travada | LM Studio sem responder (modelo carregando ou travado) | Enviar um pedido e cronometrar a resposta. | O sistema espera no máximo `LMSTUDIO_TIMEOUT_MS`, cai no fallback e registra o pedido. A tela do cliente não trava. |
| CT09 | Sim | IA responde fora do formato esperado | LM Studio devolvendo tipo inválido (ex.: "Pedido" com maiúscula) | Enviar um pedido. | O sistema normaliza o tipo ou cai no fallback. Em nenhum caso o pedido é descartado em silêncio: sempre existe registro ou log correspondente. |
| CT10 | Sim | Valor estimado calculado pelo cardápio | Item cadastrado (ex.: Brigadeiro, R$ 2,50) | Enviar "quero 100 brigadeiros para sábado". | O pedido traz valor estimado de R$ 250,00, calculado a partir do preço do item. |

### 3.3 Registro pela Vendedora (outros canais)

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT11 | Sim | Colar mensagem recebida por outro canal | Login como vendedor feito | No painel, colar "Cliente Mariana pediu 2 bolos para sexta às 15h, retirada no local". | A mensagem é interpretada pelo mesmo motor e vira pedido, com os campos extraídos. |
| CT12 | Sim | Registrar tarefa de produção | Login como vendedor feito | Enviar pela caixa do painel "lembra de comprar açúcar amanhã". | A mensagem é registrada como tarefa, não como pedido. |
| CT13 | Sim | Registrar pedido pelo formulário manual | Login como vendedor feito | Preencher cliente, produto e quantidade no formulário e enviar. | O pedido aparece na tabela com origem `manual`, sem depender da IA. |

### 3.4 Cardápio do Dia

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT14 | Sim | Publicar item pronto para retirada | Login como vendedor feito | No bloco Cardápio do dia, adicionar "Bolo de cenoura", R$ 45,00, 3 prontos. | O item aparece com etiqueta "Pronto", e o resumo do card informa as unidades disponíveis. |
| CT15 | Não | Adicionar template de cardápio | Login como vendedor feito | Selecionar um template (ex.: Doceria) e usar o modelo pronto. | Os itens entram no cardápio com quantidade zerada, aguardando a vendedora informar o que preparou. |
| CT16 | Sim | Dar baixa ao vender no balcão | Item com 3 unidades prontas | Clicar em `−` uma vez. | A quantidade passa a 2 e a alteração persiste após recarregar a página. |
| CT17 | Sim | Item esgotado continua aceitando encomenda | Item com 1 unidade pronta | Clicar em `−` até zerar e abrir a tela do cliente. | O item passa a "Esgotado" no painel e a "Sob encomenda" na vitrine, permanecendo no cardápio. |
| CT18 | Não | Tirar item do cardápio do dia | Item cadastrado | Clicar em "Tirar do cardápio". | O item some da vitrine do cliente, mas continua no catálogo do painel, esmaecido. |
| CT19 | Sim | Encerrar o dia | Ao menos um item com quantidade maior que zero | Clicar em "Encerrar o dia" e confirmar. | Todas as quantidades vão a zero, nenhum item é excluído e o log registra o encerramento. |

### 3.5 Acompanhamento e Exportação

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT20 | Sim | Concluir e reabrir um pedido | Existe ao menos um pedido pendente | Clicar em "Concluir" e depois em "Reabrir". | O status alterna entre "Concluído" e "Pendente", e o indicador de pendências acompanha a mudança. |
| CT21 | Não | Buscar registros no painel | Existem pedidos cadastrados | Digitar o nome de um cliente ou produto no campo de busca. | A tabela filtra apenas os registros que contêm o termo buscado. |
| CT22 | Não | Exportar pedidos em CSV | Existe ao menos um pedido cadastrado | Clicar em "Exportar pedidos (CSV)". | Um arquivo CSV é baixado, abre no Excel com os acentos corretos e traz todas as colunas do pedido. |
| CT23 | Não | Limpar a base preservando o cardápio | Existem pedidos e itens no cardápio | Clicar em "Limpar base" (bloco Ajustes) e confirmar. | Pedidos, clientes, tarefas e logs são apagados; o cardápio e o perfil permanecem. |

### 3.6 Acesso e Segurança

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT24 | Não | Login do vendedor com senha incorreta | Senha configurada em `SELLER_PASSWORD` | Tentar entrar no painel com senha errada. | O sistema exibe "Senha incorreta" e não libera o painel. |
| CT25 | Sim | Base protegida contra acesso sem sessão | Servidor em execução, sem login feito | Chamar `GET /api/data` diretamente (navegador ou `curl`), sem cookie de sessão. | O servidor responde `401` e não devolve nenhum dado. O mesmo vale para exclusão, exportação e ajustes. |
| CT26 | Sim | Tela pública não expõe dados internos | Cardápio publicado e pedidos existentes | Chamar `GET /api/cardapio-do-dia` sem login. | A resposta traz apenas nome, categoria, descrição, preço, unidade, quantidade e disponibilidade — sem ids internos, clientes ou pedidos. |

### 3.7 Integração e Confiabilidade

| Código | Prioridade | Caso de Teste | Pré-condição | Passos de Execução | Resultado Esperado |
| --- | --- | --- | --- | --- | --- |
| CT27 | Não | Enviar registro ao Google Sheets | `SHEETS_WEBHOOK_URL` configurada e válida | Registrar um pedido com a integração ativa. | O pedido aparece na aba "Pedidos" da planilha vinculada e o log registra o envio. |
| CT28 | Não | Falha no Google Sheets não derruba o pedido | URL do Sheets inválida ou fora do ar | Fazer um pedido pelo link do cliente. | O pedido é salvo normalmente na base local e o log registra `erro_sheets`. |
| CT29 | Não | Base corrompida não derruba o app | Servidor parado | Corromper manualmente o `app/data/db.json` e iniciar o servidor. | O arquivo é preservado como `db.json.corrompido-<timestamp>`, uma base nova é criada e o app continua respondendo. |

## 4. Casos Prioritários

Para a validação principal do sistema, os casos prioritários são:

| Código | Justificativa |
| --- | --- |
| CT01, CT02, CT03 | Demonstram a virada central do projeto: o pedido nasce no cliente, pelo link, e chega estruturado no painel sem digitação. |
| CT07 | Garante que o pedido do cliente não se perde quando o LM Studio está desligado. |
| CT08, CT09 | Garantem que IA lenta ou fora do formato não trava nem descarta o pedido. |
| CT10 | Demonstra o valor estimado calculado a partir do cardápio. |
| CT11, CT12 | Demonstram o caminho alternativo (outros canais) e a distinção entre pedido e tarefa. |
| CT14, CT16, CT17, CT19 | Demonstram o ciclo completo do cardápio: publicar, vender, esgotar e encerrar. |
| CT20 | Garante o controle de status dos registros. |
| CT25, CT26 | Garantem que a tela pública não expõe a base de clientes e pedidos. |

## 5. Critério de Aceitação Geral

O sistema será considerado funcional quando o cliente conseguir abrir o link, ver o que está pronto no dia, escrever o pedido em texto livre e recebê-lo confirmado — e a confeiteira encontrar esse mesmo pedido já estruturado no painel, com status, valor estimado e histórico exportável. Tudo isso deve continuar valendo com o LM Studio desligado ou travado, com a tela pública enxergando apenas o cardápio, e com a base protegida por senha.