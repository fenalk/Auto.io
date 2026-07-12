# Processo TO-BE — Atendimento de Pedidos com a Auto.io

## 1. Visão Geral

O processo TO-BE transforma o atendimento manual de pedidos em um fluxo estruturado. A mudança central é de **canal**: o cliente continua descobrindo o trabalho da confeiteira pelo Instagram, mas passa a **pedir pelo link da Auto.io**, e não mais por uma conversa solta no WhatsApp.

Isso resolve o problema na origem. No AS-IS, o pedido nasce como texto informal dentro de um aplicativo de conversa e só depois alguém tenta transformá-lo em registro — quase sempre a memória da vendedora. No TO-BE, o pedido **já nasce dentro do sistema**: o cliente escreve com as próprias palavras, uma IA local interpreta e o registro aparece estruturado no painel, sem ninguém copiar nada de lugar nenhum.

A liberdade do texto livre é mantida de propósito. Não se pede ao cliente que aprenda um formulário; pede-se que escreva como já escreveria.

## 2. Fluxo Automatizado Proposto

1. **Descoberta:** o cliente vê o trabalho da confeiteira no Instagram e toca no link da Auto.io divulgado no perfil.
2. **Vitrine:** ao abrir, ele encontra o cardápio do dia ao lado da caixa de mensagem — o que está pronto para retirada, com preço e quantidade. Itens esgotados aparecem como "sob encomenda".
3. **Identificação:** o cliente informa nome, telefone, endereço e uma observação, se quiser. Se já pediu antes, é reconhecido pelo telefone e os dados são reaproveitados.
4. **Pedido em texto livre:** ele escreve o que quer, do jeito que escreveria numa mensagem — *"quero 2 bolos de chocolate para sábado, pago no pix"*. Tocar em um item da vitrine já começa a frase.
5. **Interpretação:** o backend envia o texto ao LM Studio local, junto do contexto do cliente identificado e do cardápio do dia (preço, unidade e disponibilidade de cada item).
6. **Classificação:** a IA devolve o tipo (pedido, tarefa ou conversa) e os campos extraídos — produto, quantidade, data de entrega, pagamento e observações.
7. **Resiliência:** se o LM Studio estiver desligado, demorar além do tempo limite ou responder fora do formato, o classificador por regras assume automaticamente. O pedido do cliente nunca é perdido por causa da IA.
8. **Registro:** o pedido é salvo na base local (`app/data/db.json`) com status "Pendente" e valor estimado, quando o produto casa com um item do cardápio.
9. **Confirmação:** o cliente recebe na tela a confirmação de que o pedido chegou, com o valor estimado e o aviso de quais dados a vendedora ainda vai confirmar.
10. **Painel:** a confeiteira vê o pedido já estruturado — cliente, telefone, produto, quantidade, data, pagamento — junto dos indicadores de pendências.
11. **Outros canais:** se um pedido ainda chegar por WhatsApp, telefone ou balcão, ela cola a mensagem na caixa do painel e o mesmo motor faz o trabalho. Se preferir, usa o formulário manual.
12. **Operação do dia:** a cada venda no balcão ela dá baixa na quantidade do cardápio; ao zerar, o item vira "esgotado" na vitrine, mas continua aceitando encomenda.
13. **Acompanhamento:** ela conclui, reabre ou exclui pedidos e tarefas, busca por cliente ou produto e exporta em CSV.
14. **Encerramento:** ao fim do expediente, "Encerrar o dia" zera as quantidades prontas e mantém o catálogo para amanhã.
15. **Opcional:** cada registro pode ser replicado em uma planilha do Google Sheets via Apps Script.

## 3. Componentes da Solução

### 3.1 Tela de Pedido do Cliente (pública, acessada pelo link)

Porta de entrada do cliente vindo das redes sociais.

Principais funções:

* exibir a vitrine do dia com preço e disponibilidade;
* identificar ou cadastrar o cliente (nome, telefone, endereço, observação), reconhecendo quem já pediu antes pelo telefone;
* receber o pedido em texto livre, sem formulário;
* devolver confirmação com valor estimado e o que ainda será confirmado pela vendedora.

Por ser pública, esta tela **não** enxerga a base: ela conhece apenas o cardápio do dia.

### 3.2 Cardápio do Dia (Pronta Retirada)

Fonte única do que existe para vender agora. Cada item tem preço, unidade e quantidade pronta, e assume um de três estados: **pronto**, **esgotado** (no cardápio, sem unidade) ou **fora do cardápio** (não oferecido hoje).

Principais funções:

* publicar o que está pronto no início do dia, do zero ou a partir de um template (doceria, marmitaria, salgados);
* dar baixa na quantidade a cada venda no balcão;
* alimentar a vitrine do cliente e o contexto da IA com a disponibilidade real;
* encerrar o dia zerando as quantidades sem perder o catálogo.

### 3.3 Classificação por IA Local (LM Studio) com Fallback por Regras

Motor que transforma texto livre em dados estruturados.

Principais funções:

* classificar a mensagem como pedido, tarefa ou conversa;
* extrair produto, quantidade, data de entrega, pagamento e observações;
* usar o cardápio do dia como contexto, inclusive a disponibilidade, sem tratá-lo como catálogo fechado;
* calcular o valor estimado quando o produto casa com um item do cardápio;
* acionar o fallback por regras quando a IA falha, demora ou devolve resposta fora do formato.

### 3.4 Painel do Vendedor

Organizado em cinco blocos, na ordem do dia: **Hoje** (indicadores), **Entrada** (mensagem de outros canais e formulário manual), **Cardápio do dia**, **Registros** e **Ajustes**.

Principais funções:

* listar e buscar pedidos, clientes, tarefas, cardápio e logs;
* concluir, reabrir ou excluir pedidos e tarefas;
* exportar pedidos, tarefas e clientes em CSV;
* configurar a integração com o Google Sheets e limpar a base com segurança.

### 3.5 Controle de Acesso e Confiabilidade da Base

Camada que protege o que foi registrado — necessária justamente porque a tela do cliente é pública.

Principais funções:

* exigir senha para abrir o painel, com sessão em cookie assinado e validade limitada;
* bloquear todas as rotas de leitura e alteração da base sem sessão válida;
* expor à tela pública apenas o cardápio do dia;
* gravar a base de forma atômica, para que uma falha no meio da escrita não corrompa os dados.

## 4. Como o TO-BE Resolve os Gargalos do AS-IS

| Gargalo no AS-IS | Solução no TO-BE |
| --- | --- |
| Falta de registro padronizado do pedido | O pedido nasce dentro do sistema: a IA (ou o formulário manual) o estrutura em campos fixos. |
| Ausência de base centralizada | Pedidos, clientes, tarefas, cardápio e logs ficam em uma única base local, visível no painel. |
| WhatsApp como canal de pedido e arquivo | O pedido passa a entrar pelo link da Auto.io. O WhatsApp volta a ser só conversa — e, quando usado, a mensagem é colada no painel. |
| Dependência de memória ou anotações manuais | O registro e a classificação ficam salvos e consultáveis a qualquer momento. |
| Falta de referência de preços e itens comuns | O cardápio do dia guarda preço e unidade, e a IA calcula o valor estimado com base neles. |
| Nenhum controle do que está pronto para retirada | O cardápio registra a quantidade pronta, com baixa a cada venda e item marcado como esgotado ao zerar. |
| Cliente sem visibilidade do disponível | A vitrine responde "o que tem hoje?" sozinha, antes de o cliente perguntar. |
| Ausência de controle de status | Cada pedido e tarefa tem status "Pendente" ou "Concluído", com opção de reabrir. |
| Nenhum histórico ou exportação | Exportação em CSV pelo painel e, opcionalmente, espelhamento em Google Sheets. |

## 5. Diagrama do Processo TO-BE

```text
Cliente descobre o trabalho no Instagram
        ↓
Toca no link da Auto.io divulgado no perfil
        ↓
Vê a vitrine do dia (preço, pronto para retirar ou sob encomenda)
        ↓
Informa seus dados (ou é reconhecido pelo telefone)
        ↓
Escreve o pedido em texto livre, como faria no WhatsApp
        ↓
Backend Node.js envia ao LM Studio local
   (contexto: cliente identificado + cardápio do dia com disponibilidade)
        ↓
IA classifica: pedido / tarefa / conversa
   └─ IA desligada, lenta ou fora do formato → fallback por regras
        ↓
Registro salvo em app/data/db.json: status "Pendente" + valor estimado
        ↓
Cliente recebe a confirmação na tela
        ↓
Painel da confeiteira mostra o pedido já estruturado
        ↓
Venda no balcão → baixa na quantidade → item vira "esgotado" ao zerar
        ↓
Fim do dia: "Encerrar o dia" zera as quantidades e mantém o catálogo
        ↓
Opcional: cópia enviada ao Google Sheets via Apps Script

  [Canal alternativo] Pedido chegou por WhatsApp, telefone ou balcão
        ↓
  Vendedora cola a mensagem na caixa do painel → mesmo motor, mesmo registro
```

## 6. Nota sobre o Ambiente do Protótipo

No MVP, a aplicação roda localmente (`http://localhost:3000`), e o cenário do link é demonstrado nesse ambiente. Publicar o link de verdade — para que o cliente o alcance a partir do Instagram — é uma etapa de infraestrutura (hospedagem ou túnel), fora do escopo funcional deste projeto. O fluxo, as telas e as regras de negócio já estão desenhados para esse cenário.