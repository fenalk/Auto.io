# Análise do Workflow Auto-io_v1 (n8n)

O workflow completo do trabalho será dividido em 4 fases:
FASE 1: PRIMEIRO CONTATO, FASE 2: FORMULÁRIO PREENCHIDO, FASE 3: PROPOSTA E CONTRATO e FASE 4: ENTREGA FINAL

## Visão Geral - v1
FASE 1: PRIMEIRO CONTATO

Nessa versão, o fluxo inicia com Gmail Trigger (polling/minuto), seguido por Filter com 8 condições anti-spam. O Text Classifier (Groq GPT-OSS-20B) categoriza a intenção em QUERO_COMPRAR, DUVIDA, RECLAMACAO ou OUTRO. O AI Agent "Ana" utiliza modelo Groq com memória de 30 mensagens para gerar respostas personalizadas em HTML, seguindo regras de tom profissional, FAQ e formatação específica. O Switch gerencia rotas: sucesso envia e-mail e notifica Slack; falha aciona fallback manual. 


## Fluxo de Execução Fase 1

### 1️⃣ **Gatilho de E-mail (Gmail Trigger)**
- Monitora a caixa de entrada do Gmail
- Verifica novos e-mails a cada minuto
- Inicia o fluxo quando um novo e-mail chega

### 2️⃣ **Filtro de Qualificação**
- Filtra e-mails indesejados verificando:
  - ✅ Se o e-mail contém "@" (válido)
  - ❌ Não contém "unsubscribe"
  - ❌ Não contém "não responda"  
  - ❌ Não contém "newsletter"
  - ❌ Não contém "[SPAM]"
  - ❌ Não contém "mailer-daemon"
  - ❌ Não é do próprio e-mail da empresa

### 3️⃣ **Agente de IA (AI Agent)**
- Utiliza o modelo **Groq (gpt-oss-20b)** para processar o e-mail
- Possui **memória contextual** (Simple Memory) com janela de 30 mensagens
- Atua como a assistente virtual **"Ana"** com as seguintes características:
  - **Tom profissional e acolhedor**
  - **Abordagem consultiva**, não insistente
  - **Responde em HTML** estruturado
  - **Responde dúvidas sobre serviços** da Auto.io
  - **Conduz o cliente** para agendamento de reunião de diagnóstico

### 4️⃣ **Decisão de Resposta (Switch)**
- Verifica se o agente identificou a necessidade de **formulário** na resposta
- Encaminha para dois caminhos distintos:

#### **Caminho 1 - Com Formulário** (Branch "true")
- Envia e-mail com o **link do formulário de diagnóstico**
  - `<a href="https://forms.gle/6kkeNRK39FVBLqFX9">Preencher formulário de diagnóstico</a>`
- Formata resposta com:
  - Saudações personalizadas com nome do cliente
  - Lista de benefícios do formulário
  - Link clicável para acesso

#### **Caminho 2 - Sem Formulário** (Branch "false")
- Envia a resposta gerada diretamente pelo **Agente de IA** (Já formatada em HTML)

### 5️⃣ **Notificação no Slack**
- Envia mensagem para o canal **"potenciais-clientes-novos"**
- Inclui:
  - Nome do cliente
  - E-mail
  - Assunto
  - Conteúdo do e-mail
  - Classificação
  - Link direto para o e-mail no Gmail

---

### Imagem do Fluxo
![Workflow Auto.io](../../images/workflows/workflow-auto-io_v1.png)

## Fluxo de Resposta Final

```
E-mail recebido → Filtro → IA processa → 
  → Se precisa de formulário → Envia e-mail com link + Notifica Slack
  → Se não precisa → Envia resposta da IA + Notifica Slack
```



## Componentes Principais

| Componente | Tipo | Função |
|------------|------|--------|
| Gmail Trigger | Trigger | Monitora novos e-mails |
| Filter | Filtro | Qualifica e-mails recebidos |
| AI Agent | LangChain | Processa e gera resposta |
| Groq Chat Model | LLM | Modelo de linguagem GPT-oss-20b |
| Simple Memory | Memória | Mantém contexto da conversa |
| Switch | Roteador | Decide resposta com/sem formulário |
| Gmail (true/false) | Ação | Envia resposta por e-mail |
| Slack | Ação | Notifica equipe no Slack |

---

## Comportamento da IA (Assistente "Ana")

### Personalidade
- Consultora experiente da Auto.io
- Profissional e acolhedora
- Objetiva e clara
- Nunca insistente ou agressiva

### Regras Importantes
- ✅ Responde APENAS sobre serviços da Auto.io
- ❌ Não inventa preços, prazos ou condições
- ❌ Não fala mal de concorrentes
- ✅ Sempre prioriza entender o problema antes de propor soluções
- ✅ Responde em HTML válido (tags: `<b>`, `<br>`, `<ul>`, `<li>`, `<a>`)

### Quando usar formulário
- Cliente pergunta sobre serviços
- Cliente menciona otimização, automação ou IA
- Cliente pede recomendações
- Cliente deseja características específicas

### Serviços da Auto.io
- Mapeamento AS-IS e TO-BE
- Automação de processos
- Integração entre sistemas  
- Eliminação de gargalos
- IA para tomada de decisão



## Tecnologias Utilizadas
- **n8n** - Automação de workflows
- **Gmail API** - Leitura e envio de e-mails
- **Groq** - Modelo LLM (gpt-oss-20b)
- **LangChain** - Orquestração de IA
- **Slack API** - Notificações em tempo real
