# Escopo do Projeto — Auto.io

## 1. Contexto da Auto.io

A Auto.io é uma solução voltada para pequenos negócios com processos internos manuais, repetitivos, descentralizados e pouco padronizados. A proposta é mapear esses processos, identificar gargalos e transformá-los em fluxos organizados, utilizando IA local para melhorar a eficiência operacional.

O processo escolhido para a implementação é o **atendimento de pedidos personalizados de confeitarias e marmitarias**. A validação foi feita com uma microempreendedora que produz bolos artesanais sozinha e vê o negócio crescer — junto com a sobrecarga.

## 2. Problema Identificado

Hoje, o cliente descobre o trabalho da confeiteira pelas redes sociais, principalmente o Instagram. Mas, na hora de pedir, ele cai no WhatsApp: um canal que serve muito bem para conversar e muito mal para registrar.

O pedido chega como texto solto, misturado com conversa pessoal. A vendedora anota como dá — no papel, na própria conversa ou na memória. Não existe campo padrão para produto, quantidade, data de entrega ou pagamento. Antes disso, ela ainda responde dezenas de vezes por dia à mesma pergunta: "o que você tem pronto hoje?".

O resultado é pedido esquecido, pedido duplicado, valor cobrado errado e nenhuma visão do que já foi assumido para cada data.

## 3. Gargalos do Processo Atual

Foram identificados oito gargalos principais:

1. Pedidos registrados de forma informal, sem padrão de campos (produto, quantidade, data, pagamento).
2. Ausência de uma base centralizada de pedidos, clientes e tarefas.
3. Uso do WhatsApp como canal de pedido **e** como arquivo, misturando atendimento com armazenamento de dados.
4. Dependência da memória ou de anotações em papel para lembrar preços e itens comuns.
5. Falta de visibilidade sobre o que está pronto para pronta retirada: a vendedora responde de memória, cliente por cliente, e corre o risco de prometer item esgotado.
6. Falta de controle sobre o status de cada pedido e tarefa (pendente ou concluído).
7. Ausência de um fallback quando não há tempo ou ferramenta para registrar um pedido complexo.
8. Nenhum histórico exportável para acompanhar vendas ao longo do tempo.

## 4. A Virada Proposta: o link substitui o WhatsApp como canal de pedido

A Auto.io não compete com o Instagram nem tenta eliminar a conversa. Ela separa dois papéis que hoje estão colados no mesmo aplicativo:

| Papel | Antes | Depois |
| --- | --- | --- |
| **Descoberta** — o cliente conhece o trabalho | Instagram | Instagram (não muda) |
| **Pedido** — o cliente encomenda | WhatsApp, em texto solto | **Link da Auto.io**, divulgado no perfil |
| **Registro** — o pedido vira dado | Papel, memória, print da conversa | Base local, estruturada, com status |

O cliente vê o bolo no Instagram, toca no link do perfil, abre a Auto.io, **vê o cardápio do dia** e escreve o pedido do jeito que escreveria numa mensagem. A IA local estrutura o texto e o pedido chega organizado no painel da confeiteira — sem ela precisar copiar nada de lugar nenhum.

O canal antigo não deixa de funcionar: se um pedido ainda chegar por WhatsApp, telefone ou balcão, a vendedora cola a mensagem no painel e o resultado é o mesmo.

## 5. Escopo Funcional do Projeto

O Auto.io tem oito funcionalidades principais:

### 5.1 Pedido pelo Cliente (autoatendimento)

Tela pública, acessada pelo link. O cliente se identifica (nome, telefone, endereço, observação), vê o cardápio do dia ao lado da conversa e escreve o pedido em texto livre, como faria no WhatsApp. Clientes que já pediram antes são reconhecidos pelo telefone.

### 5.2 Vitrine do Dia

Ao lado da caixa de mensagem, o cliente vê o que está pronto para retirada agora, com preço e disponibilidade. Itens esgotados aparecem como "sob encomenda" — o pedido continua possível, só muda o prazo. Tocar em um item já inicia a mensagem com o produto escolhido.

### 5.3 Classificação por IA Local

Uma IA local, via LM Studio, interpreta o texto e classifica como pedido, tarefa ou conversa, extraindo produto, quantidade, data de entrega, pagamento e observações. O cardápio do dia e o cliente identificado entram no prompt como contexto, permitindo calcular o valor estimado.

### 5.4 Fallback por Regras

Quando o LM Studio está desligado, lento ou responde fora do formato, um classificador por regras assume a análise. A chamada à IA tem tempo limite configurável: uma IA travada não segura o pedido do cliente.

### 5.5 Registro pela Vendedora

O painel tem a mesma caixa de mensagem, para o pedido que ainda chegar por outro canal, e um formulário manual para quando ela prefere digitar os campos direto, sem IA.

### 5.6 Cardápio do Dia (Pronta Retirada)

Cadastro do que está pronto para levar agora: item, preço, unidade e quantidade disponível. Inclui templates prontos (doceria, marmitaria, salgados), baixa rápida a cada venda no balcão e a ação "Encerrar o dia", que zera as quantidades sem apagar o catálogo. O cardápio orienta o atendimento, mas não fecha o escopo: encomendas sob medida continuam sendo escritas em texto livre.

### 5.7 Painel de Acompanhamento

Painel organizado em cinco blocos (Hoje, Entrada, Cardápio do dia, Registros e Ajustes), com indicadores, tabelas de pedidos, clientes, tarefas, cardápio e logs, busca, exportação em CSV e opção de concluir, reabrir ou excluir registros.

### 5.8 Controle de Acesso e Proteção dos Dados

A tela de pedido é pública, porque o cliente precisa alcançá-la pelo link. O painel é protegido por senha e sessão assinada: todas as rotas que leem ou alteram a base exigem autenticação. A tela do cliente enxerga apenas o cardápio do dia — nunca a base de clientes e pedidos.

## 6. Tecnologias Utilizadas

* **Node.js + Express:** backend local que recebe os pedidos, aplica as regras de negócio e mantém a base.
* **LM Studio:** execução local de um modelo de IA para interpretar o texto do cliente, sem depender de serviços externos.
* **HTML, CSS e JavaScript:** front-end da tela de pedido e do painel, sem framework.
* **Arquivo JSON local (`app/data/db.json`):** persistência de pedidos, clientes, tarefas, cardápio e logs, com escrita atômica.
* **Módulo `crypto` do Node:** sessão do vendedor em cookie assinado (HMAC), sem dependências extras.
* **Google Sheets + Apps Script (opcional):** espelhamento dos registros em uma planilha.
* **GitHub:** versionamento, documentação e histórico do projeto.

## 7. Resultado Esperado

Ao final do projeto, o cliente que descobriu a confeiteira no Instagram consegue tocar em um link, ver o que tem pronto hoje, escrever o pedido do jeito dele e recebê-lo confirmado — enquanto a confeiteira vê esse mesmo pedido chegar estruturado no painel, com status, valor estimado e histórico exportável. Tudo rodando no computador dela, sem nuvem, e funcionando mesmo com a IA desligada.

## 8. Fora do Escopo

* **Publicação do link na internet.** O MVP roda localmente (`http://localhost:3000`); o cenário do link é demonstrado nesse ambiente. Publicar de fato exige hospedagem ou túnel — etapa de infraestrutura, não de produto.
* **Pagamento online.** A forma de pagamento é combinada no pedido (Pix, dinheiro, cartão), não processada pelo sistema.
* **Integração automática com WhatsApp e Instagram.** O canal antigo continua manual: a vendedora cola a mensagem no painel.
* **Agenda com limite de produção.** A regra levantada na entrevista — no máximo 3 produções por dia, de quarta a domingo — está especificada, mas ainda não implementada como trava no sistema.