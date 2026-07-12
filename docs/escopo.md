# Escopo do Projeto — Auto.io

## 1. Contexto da Auto.io

A Auto.io é uma solução voltada para pequenos negócios com processos internos manuais, repetitivos, descentralizados e pouco padronizados. A proposta é mapear esses processos, identificar gargalos e transformá-los em fluxos organizados, utilizando IA local para melhorar a eficiência operacional.

O processo escolhido para a implementação é o atendimento de pedidos personalizados de confeitarias e marmitarias, um problema comum entre microempreendedoras que ainda recebem encomendas por WhatsApp, ligação, Instagram ou atendimento presencial, sem nenhum registro estruturado.

## 2. Problema Identificado

Vendedoras do ramo alimentício recebem pedidos por múltiplos canais informais, geralmente misturados com conversas pessoais. As informações ficam espalhadas em conversas de WhatsApp, anotações em papel ou apenas na memória da responsável pelo atendimento.

Esse cenário gera pedidos esquecidos, falta de padronização de preços e prazos, dificuldade em confirmar dados do cliente e ausência de qualquer histórico confiável de vendas e tarefas de produção. Soma-se a isso a pergunta que se repete todo dia — "o que você tem pronto hoje?" — respondida de memória, item por item, cliente por cliente.

## 3. Gargalos do Processo Atual

Foram identificados oito gargalos principais:

1. Pedidos registrados de forma informal, sem padrão de campos (produto, quantidade, data, pagamento).
2. Ausência de uma base centralizada de pedidos, clientes e tarefas.
3. Uso do WhatsApp como único canal e como registro, misturando atendimento com armazenamento de dados.
4. Dependência da memória ou de anotações em papel para lembrar preços e itens comuns.
5. Falta de visibilidade sobre o que está pronto para pronta retirada, o que obriga a responder de memória a cada cliente e gera venda de item já esgotado.
6. Falta de controle sobre o status de cada pedido e tarefa (pendente ou concluído).
7. Ausência de um fallback quando não há tempo ou ferramenta para registrar um pedido complexo.
8. Nenhum histórico exportável para acompanhar vendas ao longo do tempo.

## 4. Escopo Funcional do Projeto

O Auto.io tem oito funcionalidades principais:

### 4.1 Registro de Mensagem Recebida

Tela para digitar a mensagem recebida por WhatsApp, ligação, Instagram ou atendimento presencial, com cadastro rápido de quem enviou (nome, telefone, endereço, observação). Clientes repetidos são reconhecidos pelo telefone, independentemente da formatação usada.

### 4.2 Classificação por IA Local

Uma IA local, via LM Studio, interpreta a mensagem e classifica como pedido, tarefa ou conversa, extraindo produto, quantidade, data de entrega, pagamento e observações. O cardápio do dia e o cliente identificado entram no prompt como contexto.

### 4.3 Fallback por Regras

Quando o LM Studio está desligado, **lento** ou responde de forma inválida, um classificador por regras simples assume a análise, garantindo que o registro nunca pare de funcionar. A chamada à IA tem tempo limite configurável, de modo que uma IA travada não bloqueia o atendimento.

### 4.4 Registro Manual

Formulário de registro manual como alternativa direta à IA, para quando o vendedor prefere digitar os dados do pedido sem depender da classificação automática.

### 4.5 Cardápio do Dia (Pronta Retirada)

Cadastro do que está pronto para o cliente levar agora: item, preço, unidade e **quantidade disponível**. Inclui templates prontos para doceria, marmitaria e salgados, baixa rápida a cada venda no balcão e a ação "Encerrar o dia", que zera as quantidades sem apagar o catálogo. O cardápio orienta o atendimento, mas não fecha o escopo: pedidos sob medida continuam sendo registrados por mensagem livre.

### 4.6 Vitrine do Dia para Quem Envia a Mensagem

Na tela de registro, ao lado da conversa, aparece o que está pronto para retirada, com preço e disponibilidade. Itens esgotados aparecem como "sob encomenda". Tocar em um item já inicia a mensagem com o produto escolhido.

### 4.7 Painel de Acompanhamento

Painel organizado em cinco blocos (indicadores, entrada de mensagens, cardápio do dia, registros e ajustes), com pedidos, clientes, tarefas, cardápio e logs, busca, exportação em CSV e opção de concluir, reabrir ou excluir registros.

### 4.8 Controle de Acesso e Proteção dos Dados

O painel é protegido por senha e por sessão assinada. As rotas que leem ou alteram a base exigem autenticação; a tela de registro, usada por quem envia a mensagem, permanece aberta mas só enxerga o cardápio do dia — nunca a base de clientes e pedidos.

## 5. Tecnologias Utilizadas

* **Node.js + Express:** backend local que recebe as mensagens, aplica as regras de negócio e mantém a base de dados.
* **LM Studio:** execução local de um modelo de IA para classificar as mensagens, sem depender de serviços externos.
* **HTML, CSS e JavaScript:** front-end do painel do vendedor e da tela de registro de mensagens, sem framework.
* **Arquivo JSON local (`app/data/db.json`):** persistência da base de pedidos, clientes, tarefas, cardápio e logs, com escrita atômica.
* **Módulo `crypto` do Node:** sessão do vendedor em cookie assinado (HMAC), sem dependências extras.
* **Google Sheets + Apps Script (opcional):** espelhamento dos registros em uma planilha, para quem quiser um backup fora do computador local.
* **GitHub:** versionamento, documentação e histórico do projeto.

## 6. Resultado Esperado

Ao final do projeto, o vendedor consegue publicar o cardápio do dia, digitar a mensagem recebida, ter o pedido ou a tarefa classificado automaticamente (ou registrá-lo manualmente), acompanhar tudo em um painel único com indicadores, buscar e exportar os registros, e opcionalmente manter uma cópia em uma planilha do Google Sheets — tudo funcionando mesmo com o LM Studio desligado, e com a base protegida por senha.