# Auto.io

Central inteligente para transformar mensagens recebidas e anotações soltas em registros organizados: clientes, pedidos personalizados, tarefas de produção e logs.

O projeto nasceu como um estudo de automação de processos (AS-IS/TO-BE) e evoluiu para o MVP funcional em [`app/`](app/README.md): uma aplicação Node.js própria com IA local via LM Studio.

## Aplicação principal

O MVP executável está em [`app/`](app/README.md). Leia o README dele para instruções completas de instalação, configuração e uso.

- Registro de mensagem recebida por WhatsApp, Instagram, ligação ou atendimento presencial.
- IA local via LM Studio classifica a mensagem como pedido, tarefa ou conversa, com fallback por regras se a IA estiver indisponível.
- Painel do vendedor com pedidos, clientes, tarefas, itens/preços de referência e logs.
- Registro manual como alternativa segura à IA.
- Persistência local em `app/data/db.json` e exportação em CSV.
- Integração opcional com Google Sheets via Apps Script.

### Como rodar

```bash
cd app
npm install
copy .env.example .env
npm start
```

Depois acesse `http://localhost:3000`.

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| [`app/`](app/README.md) | MVP funcional da Auto.io (Node.js + front-end + IA local). É a entrega atual do projeto. |
| [`docs/`](docs/) | Documentação de processo do `app/` atual: escopo, AS-IS (atendimento manual de pedidos), TO-BE (fluxo com a Auto.io) e casos de teste. |
| [`workflow-auto-io/`](workflow-auto-io/) | Histórico: versões (v1 a v3) de um workflow n8n explorado antes do MVP. v1/v2 tratam da qualificação de leads da própria Auto.io por e-mail; v3 (`DocesAtendimentoBot`) foi o protótipo n8n do bot de atendimento que deu origem ao `app/`. |
| [`testes-n8n/`](testes-n8n/) | Histórico: exports de workflows n8n usados em testes pontuais (e-mail, WhatsApp, evento). |
| [`instalacao-local-n8n/`](instalacao-local-n8n/) | Histórico: anotações de instalação do n8n localmente (Ubuntu). |
| [`images/`](images/) | Imagens usadas pela documentação em `workflow-auto-io/`. |

> **Nota sobre o histórico do projeto:** os materiais em `workflow-auto-io/` (v1/v2), `testes-n8n/` e `instalacao-local-n8n/` vêm da fase exploratória do projeto, quando a automação era feita via n8n. O MVP atual em `app/` seguiu por um caminho diferente — uma aplicação Node.js própria com IA local, sem depender de n8n — e é o que os documentos em `docs/` descrevem hoje.

## Licença

Distribuído sob a licença MIT — veja [`LICENSE`](LICENSE).
