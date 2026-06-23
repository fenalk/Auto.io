### Fluxo Automatizado Proposto

O novo pipeline de atendimento via n8n será estruturado nas seguintes etapas:

1. **Entrada de Dados (Ingestão):** O cliente realiza o registro inicial através de um formulário padronizado.
2. **Processamento (Webhook):** O n8n recebe o payload do formulário instantaneamente.
3. **Sanitização de Dados:** O sistema executa a limpeza e padronização automática dos campos de telefone e e-mail.
4. **Validação e Upsert:** 
   * É feita a verificação de duplicidade na base de dados.
   * Se for um cliente novo, o cadastro é criado (Insert).
   * Se for um cliente existente, o histórico e os dados são atualizados (Update).
5. **Gestão de Atendimento:** O status do cliente é classificado e a data do próximo follow-up é agendada automaticamente.
6. **Notificação e Monitoramento:** O responsável pelo atendimento recebe um alerta estruturado, enquanto as métricas e indicadores do painel (KPIs) são atualizados em tempo real.