# Auto.io

Este app implementa a proposta central da Auto.io: transformar mensagens recebidas pelo vendedor em pedidos personalizados, tarefas, clientes, itens/preços de referência e logs organizados.

## Foco do produto

A Auto.io é uma central inteligente de organização operacional para microempreendedoras do ramo alimentício. O sistema permite que o vendedor registre mensagens recebidas por qualquer canal, como WhatsApp, ligação, Instagram ou atendimento presencial, e utilize IA local para transformar essas mensagens em pedidos, tarefas e registros estruturados.

Muitas confeiteiras e marmiteiras não vendem apenas produtos prontos. Elas recebem mensagens soltas, pedidos sob medida e lembretes no meio da rotina. A Auto.io transforma essas conversas em registros organizados, ajudando a evitar pedidos esquecidos, tarefas perdidas e controle manual em papel ou planilha.

Como o app ainda não integra diretamente com WhatsApp, Instagram ou outros canais, a mensagem recebida é digitada manualmente na tela de registro. Os itens recorrentes são opcionais e servem para o vendedor lembrar produtos e preços comuns. Eles não limitam o atendimento personalizado: pedidos sob medida continuam sendo registrados por mensagem e observações.

## Fluxo do app

```text
Vendedor informa os dados de quem enviou a mensagem
        ↓
Mensagem livre é digitada ou colada no sistema
        ↓
Front Auto.io
        ↓
Backend Node.js local
        ↓
LM Studio local ou fallback por regras
        ↓
IA classifica como pedido, tarefa ou conversa
        ↓
Sistema salva em data/db.json
        ↓
Painel atualiza indicadores, clientes, itens/preços de referência, pedidos, tarefas e logs
        ↓
Opcional: Google Sheets via Apps Script
```

Se o LM Studio estiver desligado ou retornar uma resposta inválida, o backend usa fallback por regras simples e o registro continua funcionando normalmente.

## Implementação

- Registro de mensagem recebida por WhatsApp, ligação, Instagram ou atendimento presencial.
- Cadastro rápido do remetente da mensagem com nome, telefone, endereço e observação.
- Acesso do vendedor por senha configurável em `.env`.
- Perfil do vendedor com dados do negócio.
- Itens/preços de referência com templates prontos e item personalizado.
- IA local via LM Studio usando remetente e itens/preços de referência como contexto.
- Fallback por regra quando a IA falha.
- Painel com pedidos, clientes, tarefas, itens/preços de referência, logs e indicadores.
- Registro manual de pedidos como alternativa operacional à IA.
- Busca nas tabelas do painel.
- Concluir, reabrir e excluir pedidos/tarefas.
- Exportação CSV pelo backend.
- Limpeza segura da base de dados.
- Integração opcional com Google Sheets via Apps Script para pedidos, clientes, tarefas e logs.

## Como rodar

```bash
cd app
npm install
copy .env.example .env
npm start
```

Abra:

```text
http://localhost:3000
```

## Configuração

Edite `app/.env`:

```env
PORT=3000
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=local-model
SELLER_PASSWORD=12345
SHEETS_WEBHOOK_URL=
```

`OWNER_PASSWORD` ainda funciona por compatibilidade, mas o nome recomendado agora é `SELLER_PASSWORD`.

Para usar IA local, abra o LM Studio, carregue um modelo instruct e inicie o servidor local em `http://localhost:1234`.

Para usar Google Sheets, cole o conteúdo de `integrations/apps-script.gs` no Apps Script da planilha, implante como Aplicativo da Web e informe a URL no painel do vendedor ou em `SHEETS_WEBHOOK_URL`.

## Exemplos de mensagem

Pedido personalizado:

```text
Oi, queria encomendar um cento de brigadeiros para sábado, pagamento por pix.
```

Pedido digitado pelo vendedor:

```text
Cliente Mariana pediu 2 bolos de chocolate para sexta às 15h, retirada no local, pagamento no pix.
```

Tarefa de produção:

```text
Lembra de comprar açúcar e leite condensado amanhã cedo.
```
