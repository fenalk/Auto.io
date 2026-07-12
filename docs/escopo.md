# Escopo do Projeto — Auto.io

## 1. Contexto da Auto.io

A Auto.io é uma solução voltada para pequenos negócios com processos internos manuais, repetitivos, descentralizados e pouco padronizados. A proposta é mapear esses processos, identificar gargalos e transformá-los em fluxos organizados, utilizando IA local para melhorar a eficiência operacional.

O processo escolhido para a implementação é o atendimento de pedidos personalizados de confeitarias e marmitarias, um problema comum entre microempreendedoras que ainda recebem encomendas por WhatsApp, ligação, Instagram ou atendimento presencial, sem nenhum registro estruturado.

## 2. Problema Identificado

Vendedoras do ramo alimentício recebem pedidos por múltiplos canais informais, geralmente misturados com conversas pessoais. As informações ficam espalhadas em conversas de WhatsApp, anotações em papel ou apenas na memória da responsável pelo atendimento.

Esse cenário gera pedidos esquecidos, falta de padronização de preços e prazos, dificuldade em confirmar dados do cliente e ausência de qualquer histórico confiável de vendas e tarefas de produção.

## 3. Gargalos do Processo Atual

Foram identificados sete gargalos principais:

1. Pedidos registrados de forma informal, sem padrão de campos (produto, quantidade, data, pagamento).
2. Ausência de uma base centralizada de pedidos, clientes e tarefas.
3. Uso do WhatsApp como único canal e como registro, misturando atendimento com armazenamento de dados.
4. Dependência da memória ou de anotações em papel para lembrar preços e itens comuns.
5. Falta de controle sobre o status de cada pedido e tarefa (pendente ou concluído).
6. Ausência de um fallback quando não há tempo ou ferramenta para registrar um pedido complexo.
7. Nenhum histórico exportável para acompanhar vendas ao longo do tempo.

## 4. Escopo Funcional do Projeto

O Auto.io tem seis funcionalidades principais:

### 4.1 Registro de Mensagem Recebida

Tela para digitar a mensagem recebida por WhatsApp, ligação, Instagram ou atendimento presencial, com cadastro rápido de quem enviou (nome, telefone, endereço, observação).

### 4.2 Classificação por IA Local

Uma IA local, via LM Studio, interpreta a mensagem e classifica como pedido, tarefa ou conversa, extraindo produto, quantidade, data de entrega, pagamento e observações.

### 4.3 Fallback por Regras

Quando o LM Studio está desligado ou responde de forma inválida, um classificador por regras simples assume a análise, garantindo que o registro nunca pare de funcionar.

### 4.4 Registro Manual

Formulário de registro manual como alternativa direta à IA, para quando o vendedor prefere digitar os dados do pedido sem depender da classificação automática.

### 4.5 Itens e Preços de Referência

Cadastro de itens recorrentes (com templates prontos para doceria, marmitaria e salgados) para lembrar produtos e preços comuns, sem limitar pedidos sob medida.

### 4.6 Painel de Acompanhamento

Painel com indicadores, pedidos, clientes, tarefas, itens/preços e logs, com busca, exportação em CSV e opção de concluir, reabrir ou excluir registros.

## 5. Tecnologias Utilizadas

* **Node.js + Express:** backend local que recebe as mensagens e mantém a base de dados.
* **LM Studio:** execução local de um modelo de IA para classificar as mensagens, sem depender de serviços externos.
* **HTML, CSS e JavaScript:** front-end do painel do vendedor e da tela de registro de mensagens.
* **Arquivo JSON local (`app/data/db.json`):** persistência da base de pedidos, clientes, tarefas, itens e logs.
* **Google Sheets + Apps Script (opcional):** espelhamento dos registros em uma planilha, para quem quiser um backup fora do computador local.
* **GitHub:** versionamento, documentação e histórico do projeto.

## 6. Resultado Esperado

Ao final do projeto, o vendedor consegue digitar a mensagem recebida, ter o pedido ou a tarefa classificado automaticamente (ou registrá-lo manualmente), acompanhar tudo em um painel único com indicadores, buscar e exportar os registros, e opcionalmente manter uma cópia em uma planilha do Google Sheets.
