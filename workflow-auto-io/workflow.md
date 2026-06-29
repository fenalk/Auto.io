# Workflow Auto.io_v1

## Fluxo Principal
### Objetivo: 
- Qualificar clientes automaticamente antes do atendimento humano (vai ter humano?)
- Oferecer atendimento consultivo com resposta personalizadas
- Direcionar clientes interessados para reuniões de diagnóstico
- Coleta de informações via formulário quando necessário
- Alerta a equipe comercial sobre novos clientes qualificados

### 1. Gatilho de Entrada (Gmail Trigger)
- Monitora a caixa de entrada em busca de novos e-mails
- Verifica a cada minuto novos e-mails recebidos

### 2.  Filtro de Qualificação (Filter)
- E-mails com endereço válido (@)
- [x] Remove mensagens com: unsubscribe, newsletter, span, mailer-daemon
- [x] Ignora e-mails enviados pelo próprio grupo (auto.io.grupo@gmail.com)
- [x] Filtro e-mails com links susteiros (https://)

### 3. Classificador de Intenção (Text Classifier)
Categoriza o e-mail em 4 categorias usando IA:
- **QUERO_COMPRAR** - Cliente quer contratar serviço
- **DUVIDA** - Cliente tem perguntas sobre os serviços
- **RECLAMAÇÕES** - Cliente insatisfeito
- **OUTRO** - Não se encaixa nas categorias anteriores

### 4. AI Agent
O coração do sistema - Ana, assistente virtual com:
-  Personalidade: Consultora experiente, profissional e acolhedora
- Objetivo: Entender necessidades, esclarecer dúvidas e conduzir para reunião de diagnóstico
- Memória: Mantém contexto da conversa (30 mensagens)
- Modelo: Groq Chat (openai/gpt-oss-20b)

### 5. switch de Decisão
Define o fluxo baseado na resposta da IA:

- Rota para "Formulário" se o cliente precisar preencher diagnóstico
- Rota para "Não Formulários" em outros casos
- Rota para "Falha da IA" se houver erro na resposta

### 6. Envio de Resposta
- Caminho principal: Envia resposta gerada pela IA como HTML formatado
- Fallback: Se a IA falhar, envia mensagem padrão informando a instabilidade do sistema.

## 7. Notificação no Slack
Envia alerta para o canal #potenciais-clientes-novos com:

- Nome e e-mail do cliente
- Assunto e conteúdo do e-mail
- Classificação da intenção
- Link direto para o e-mail no Gmail
- Ação recomendada


## Tecnologias Utilizadas


| Componente | Tecnologia |
| :---: | :---: |
| Automação | n8n (workflow automation) | 
| E-mail | Gmail API (OAuth2) |
| IA | Groq (modelo openai/gpt-oss-20b) |
| Memória | Buffer Window (30 mensagens de contexto) |
| Notificações | Slack API | 
| Classificação | Text Classifier | 

