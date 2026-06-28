# Escopo do Projeto — Auto.io

## 1. Contexto da Auto.io

A Auto.io é uma solução voltada para pequenas e médias empresas que possuem processos internos manuais, repetitivos, descentralizados e pouco padronizados. A proposta é mapear esses processos, identificar gargalos e transformá-los em fluxos digitais automatizados, utilizando automação e inteligência artificial para melhorar a eficiência operacional.

No Projeto Final, a Auto.io será implementada como uma prova de conceito funcional. O processo escolhido para implementação é o controle e acompanhamento de clientes, pois representa um problema comum em PMEs que ainda usam WhatsApp, papel e planilhas sem padrão para registrar informações.

## 2. Problema Identificado

Atualmente, muitas PMEs controlam seus clientes de forma informal. As informações ficam espalhadas em conversas de WhatsApp, anotações em papel, planilhas simples ou apenas na memória do responsável pelo atendimento.

Esse cenário gera perda de dados, duplicidade de registros, demora no retorno aos clientes, dificuldade de acompanhar oportunidades e ausência de histórico confiável, assim dificultando o crescimento das pequenas e médias empresas.

## 3. Gargalos do Processo Atual

Foram identificados oito gargalos principais:

1. Falta de cadastro padronizado de clientes.
2. Ausência de uma base centralizada de informações.
3. Uso de WhatsApp como principal meio de registro.
4. Dependência de anotações em papel ou memória do responsável.
5. Planilhas sem padrão e com baixa confiabilidade.
6. Duplicidade ou perda de registros.
7. Falta de controle sobre o status do atendimento.
8. Ausência de lembretes e métricas de acompanhamento.

## 4. Escopo Funcional do Projeto

O Auto.io terá seis funcionalidades principais:

### 4.1 Cadastro de Clientes

Criar um formulário para registrar dados básicos do cliente, como nome, telefone, e-mail, empresa, interesse, origem do contato e observações.

### 4.2 Validação e Padronização dos Dados

Padronizar informações recebidas, como remover símbolos do telefone e converter e-mails para letras minúsculas.

### 4.3 Verificação de Duplicidade

Verificar se o cliente já existe na base usando telefone ou e-mail como chave de identificação.

### 4.4 Cadastro ou Atualização Automática

Cadastrar um novo cliente quando ele ainda não existir ou atualizar o registro quando já estiver salvo.

### 4.5 Notificação ao Responsável

Enviar uma notificação automática ao responsável quando um cliente for cadastrado ou atualizado.

### 4.6 Acompanhamento e Indicadores

Registrar status do atendimento, próximo follow-up e indicadores básicos, como total de clientes, clientes pendentes e clientes convertidos.

## 5. Tecnologias Utilizadas

* **n8n:** plataforma principal para criação dos workflows de automação.
* **Google Sheets:** base inicial para centralizar os registros dos clientes.
* **Formulário do n8n:** entrada padronizada dos dados.
* **Gmail, Telegram ou Webhook:** envio de notificações ao responsável.
* **Docker:** execução local e padronizada do ambiente.
* **GitHub:** versionamento, issues, commits e documentação do projeto.

## 6. Resultado Esperado

Ao final do projeto, será possível preencher um formulário de cliente, executar o fluxo no n8n, salvar ou atualizar os dados em uma base centralizada, evitar duplicidade e notificar automaticamente o responsável pelo atendimento.
