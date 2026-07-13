# Auto.io

Aplicação que substitui o WhatsApp como **canal de pedido** de uma confeitaria artesanal. O cliente chega pelo link divulgado nas redes sociais, vê o cardápio do dia, escreve o pedido em texto livre — e uma IA local transforma esse texto em registro estruturado no painel da vendedora.

Roda inteiramente no computador dela: sem nuvem, sem mensalidade, sem dado de cliente saindo da máquina.

---

## Sumário

- [O que este app resolve](#o-que-este-app-resolve)
- [Como funciona](#como-funciona)
- [O que o app faz](#o-que-o-app-faz)
- [Instalação](#instalação)
- [Configuração (`.env`)](#configuração-env)
- [IA local com LM Studio](#ia-local-com-lm-studio)
- [As telas](#as-telas)
- [Cardápio do dia](#cardápio-do-dia)
- [Segurança](#segurança)
- [Integração com Google Sheets](#integração-com-google-sheets)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Modelo de dados (`db.json`)](#modelo-de-dados-dbjson)
- [Referência da API](#referência-da-api)
- [Exemplos de mensagem](#exemplos-de-mensagem)
- [Solução de problemas](#solução-de-problemas)
- [Limitações conhecidas](#limitações-conhecidas)

---

## O que este app resolve

O cliente descobre o trabalho da confeiteira no Instagram. Na hora de pedir, cai no WhatsApp — e ali o pedido vira texto solto, misturado com conversa pessoal, sem campo de produto, quantidade, data ou pagamento. A vendedora anota como dá: papel, print, memória. Pedido esquecido, valor cobrado errado e nenhuma visão do que já foi assumido para sábado.

A Auto.io separa o que o WhatsApp mistura:

| Papel | Antes | Depois |
| --- | --- | --- |
| Descoberta | Instagram | Instagram (não muda) |
| Pedido | WhatsApp, texto solto | **Link da Auto.io** |
| Registro | Papel, memória, print | Base local estruturada, com status |

O pedido **nasce dentro do sistema**. Ninguém copia nada de lugar nenhum.

A liberdade do texto é mantida de propósito: não se pede ao cliente que aprenda um formulário, pede-se que escreva como já escreveria. *"Quero 2 bolos de chocolate pra sábado, pago no pix"* — e o resto é com a IA.

## Como funciona

```text
Cliente vê o trabalho no Instagram
        ↓
Toca no link da Auto.io
        ↓
Vê o cardápio do dia (preço, pronto para retirar ou sob encomenda)
        ↓
Informa seus dados e escreve o pedido em texto livre
        ↓
Backend Node.js local (app/server.js)
        ↓
┌───────────────────────────────────────┐
│ LM Studio local (IA)                  │  ← timeout de 20s
│   ↓ desligado / lento / fora do formato│
│ Fallback por regras                   │
└───────────────────────────────────────┘
        ↓
Classificação: pedido | tarefa | conversa
        ↓
Grava em app/data/db.json (escrita atômica)
        ↓
Cliente recebe a confirmação · Painel da vendedora mostra o pedido estruturado
        ↓
Opcional: espelha em Google Sheets via Apps Script

[Canal alternativo] Pedido chegou por WhatsApp, telefone ou balcão
        ↓
Vendedora cola a mensagem no painel → mesmo motor, mesmo registro
```

**A IA nunca é ponto único de falha.** Se o LM Studio estiver desligado, travado, lento ou devolver um JSON inválido, o backend cai no fallback por regras e o pedido é registrado do mesmo jeito — marcado com `origem: fallback-regra`. E se o modelo devolver um tipo que não seja `pedido`, `tarefa` ou `conversa`, o backend normaliza ou cai no fallback, em vez de descartar o pedido em silêncio.

## O que o app faz

**Do lado do cliente (tela pública, acessada pelo link)**
- Vitrine do dia ao lado da conversa: o que está pronto, o preço, o que só sai por encomenda.
- Cadastro rápido (nome, telefone, endereço, observação). Quem já pediu antes é reconhecido pelo telefone — `(91) 99999-9999` e `91999999999` são o mesmo cliente.
- Pedido em texto livre, sem formulário. Tocar em um item da vitrine já começa a mensagem.
- Confirmação na tela, com valor estimado e o que a vendedora ainda vai confirmar.

**Do lado da vendedora (painel protegido por senha)**
- Indicadores de pedidos, tarefas, clientes e pendências.
- Caixa de mensagem para o pedido que chegou por outro canal, e formulário manual para registrar sem IA.
- Cardápio do dia: publicar, dar baixa, esgotar, encerrar o dia.
- Tabelas de pedidos, clientes, tarefas, cardápio e logs, com busca.
- Concluir, reabrir e excluir pedidos e tarefas.
- Exportação CSV com acentuação correta no Excel.
- Limpeza da base preservando cardápio e perfil.

**Integrações**
- IA local via LM Studio, recebendo o cliente identificado e o cardápio do dia como contexto.
- Google Sheets opcional via Apps Script, para pedidos, clientes, tarefas e logs.

## Instalação

Requer **Node.js 18 ou superior** (o app usa `fetch` nativo).

```bash
cd app
npm install
```

Crie o `.env` a partir do exemplo:

```bash
# Windows (CMD)
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Gere uma chave de sessão e cole no `.env` em `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Suba o servidor:

```bash
npm start
```

E abra <http://localhost:3000>.

> **Sobre o link do Instagram:** o app roda localmente, então o link é o `localhost`. Publicá-lo de verdade (hospedagem ou túnel) é etapa de infraestrutura, fora do escopo funcional deste MVP.

## Configuração (`.env`)

```env
# Servidor
PORT=3000
HOST=127.0.0.1

# IA local
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_MODEL=local-model
LMSTUDIO_TIMEOUT_MS=20000

# Acesso do vendedor
SELLER_PASSWORD=12345
SESSION_SECRET=

# Google Sheets (opcional)
SHEETS_WEBHOOK_URL=
SHEETS_TIMEOUT_MS=10000
```

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `3000` | Porta do app. |
| `HOST` | `127.0.0.1` | Interface de escuta. Mantém a base acessível só nesta máquina. Use `0.0.0.0` apenas se souber que quer expor na rede local. |
| `LMSTUDIO_BASE_URL` | `http://localhost:1234/v1` | Endpoint do servidor local do LM Studio. |
| `LMSTUDIO_MODEL` | `local-model` | Identificador do modelo. Se der erro de modelo, use o `id` exato de `GET /v1/models`. |
| `LMSTUDIO_TIMEOUT_MS` | `20000` | Tempo máximo de espera pela IA. Estourou, entra o fallback por regras. |
| `SELLER_PASSWORD` | `12345` | Senha do painel. **Troque antes de qualquer uso real.** |
| `SESSION_SECRET` | *(sorteada a cada start)* | Chave HMAC que assina o cookie de sessão. Se ficar vazia, você é deslogado a cada reinício do servidor. |
| `CORS_ORIGIN` | *(vazio)* | Origem extra autorizada. Só precisa se o front rodar em outra porta. |
| `SHEETS_WEBHOOK_URL` | *(vazio)* | URL `https` do Web App do Apps Script. Vazio: tudo fica só no computador. |
| `SHEETS_TIMEOUT_MS` | `10000` | Tempo máximo de espera pelo Google Sheets. |

`OWNER_PASSWORD` ainda funciona por compatibilidade, mas o nome recomendado é `SELLER_PASSWORD`.

## IA local com LM Studio

1. Baixe um modelo **instruct** (modelo base não segue o formato JSON e cai no fallback o tempo todo). Sugestões: Qwen2.5 7B Instruct ou Llama 3.1 8B Instruct em Q4_K_M (16 GB de RAM); Qwen2.5 3B Instruct (8 GB).
2. Aba **Developer** (ou "Local Server") → carregue o modelo → **Start Server**. Ele sobe em `http://localhost:1234`.
3. Confirme que respondeu:

   ```bash
   curl http://localhost:1234/v1/models
   ```

   Se a conexão falhar, o servidor do LM Studio não está ligado — abrir o app e carregar o modelo no chat **não** basta.
4. Copie o `id` retornado para `LMSTUDIO_MODEL` (se `local-model` não funcionar) e reinicie o `npm start`.

Na primeira mensagem o modelo pode levar mais de 20 segundos para carregar na memória. Se isso acontecer, aumente `LMSTUDIO_TIMEOUT_MS` ou deixe o modelo pré-carregado no LM Studio.

O prompt enviado ao modelo inclui o papel de quem digitou, o cliente identificado e o **cardápio do dia com disponibilidade**:

```text
- Brigadeiro (Doces): R$ 2.5 por unidade. 60 pronto(s) para retirada hoje.
- Bolo de chocolate (Bolos): R$ 45 por unidade. esgotado hoje, só sob encomenda.
```

É isso que permite calcular o valor estimado e avisar quando um item só sai por encomenda.

## As telas

**Tela inicial (pública)** — fala com o cliente: "Quero fazer um pedido". O acesso da vendedora fica discreto, num botão no canto superior direito.

**Tela de pedido (pública)** — a conversa à esquerda e a **vitrine do dia** à direita (no celular, a vitrine vem primeiro). Tocar em um item já começa a mensagem: *"Quero 1 Bolo de cenoura para retirar hoje."* Antes de escrever, o cliente informa nome, telefone e endereço.

**Painel do vendedor (protegido por senha)** — cinco blocos, na ordem do dia:

1. **Hoje** — indicadores.
2. **Entrada** — caixa de mensagem (para pedido vindo de outro canal) e formulário manual, lado a lado.
3. **Cardápio do dia** — o que está pronto para retirada.
4. **Registros** — abas de pedidos, clientes, tarefas, cardápio e logs, com busca e exportação.
5. **Ajustes** — Google Sheets e limpeza da base.

## Cardápio do dia

Cada item tem um campo `quantidade`: **unidades prontas para o cliente levar agora**. Isso dá três estados:

| Estado | No painel | Na vitrine do cliente |
| --- | --- | --- |
| **Pronto** — tem unidade disponível | borda verde, contador `−  12  +` | "12 disponíveis" |
| **Esgotado** — está no cardápio, mas acabou hoje | etiqueta amarela | "Sob encomenda" |
| **Fora do cardápio** — não é oferecido hoje | card esmaecido | não aparece |

Fluxo do dia a dia:

1. De manhã, a vendedora informa o que assou: digita a quantidade ou usa o `+`.
2. A cada venda no balcão, o `−1` dá baixa. Chegou a zero, o item vira "esgotado" — mas continua no cardápio e ainda pode ser encomendado.
3. No fim do expediente, **Encerrar o dia** zera todas as quantidades. O catálogo (nomes, preços, unidades) continua para amanhã.

Os modelos prontos (doceria, marmitaria, salgados) entram com **0 pronto** — eles são o catálogo de partida; a quantidade é sempre ela quem informa.

## Segurança

A tela de pedido é pública **por necessidade**: o cliente precisa alcançá-la pelo link. Isso torna a proteção do resto obrigatória.

- **Sessão real.** O login devolve um cookie `HttpOnly`, `SameSite=Strict`, assinado com HMAC (`SESSION_SECRET`), válido por 12 horas. Não dá para forjar sessão pelo navegador.
- **Rotas protegidas.** Tudo que lê ou altera a base (`/api/data`, exportações, exclusões, cardápio, ajustes, limpeza) exige sessão e devolve `401` sem ela.
- **Superfície pública mínima.** Só ficam abertas as rotas da tela do cliente: login, sessão, pendências, cardápio do dia, cadastro do cliente e envio de mensagem. O cardápio sai sem ids internos nem dados do negócio, e o envio de pedido não devolve a base para quem não está autenticado.
- **CORS restrito** à própria origem e **escuta em `127.0.0.1`** por padrão.
- **Webhook só aceita `https`**, o que evita apontar o envio de pedidos para um endereço arbitrário.
- **Senha comparada em tempo constante.** Ainda assim, `12345` é senha de demonstração: troque em `SELLER_PASSWORD`.

O `.env` **não deve ir para o Git** — versione apenas o `.env.example`. Trocar o `SESSION_SECRET` desloga todo mundo, o que é justamente o botão de emergência se você desconfiar que ele vazou.

## Integração com Google Sheets

Opcional. Serve para espelhar os registros numa planilha compartilhável.

1. Crie uma planilha no Google Sheets.
2. **Extensões → Apps Script**, apague o conteúdo padrão e cole `integrations/apps-script.gs`.
3. **Implantar → Nova implantação → Aplicativo da Web**. Executar como: você mesmo. Quem pode acessar: qualquer pessoa com o link.
4. Copie a URL gerada e cole no painel (**Ajustes → Google Sheets**) ou em `SHEETS_WEBHOOK_URL`.
5. Clique em **Testar envio** e confira a aba Logs da planilha.

O script cria sozinho as abas **Pedidos**, **Clientes**, **Tarefas** e **Logs**, e atualiza o status quando você conclui ou reabre um registro no painel.

> A URL do Web App é um endpoint público de escrita: quem tiver o link pode gravar na sua planilha. Não publique essa URL.

Se o Sheets estiver fora do ar ou lento, o envio falha em silêncio no log (`erro_sheets`) e **o pedido continua salvo localmente** — a planilha é espelho, nunca a fonte da verdade.

## Estrutura do projeto

```text
app/
├── server.js              # backend Express: rotas, IA, fallback, persistência
├── package.json
├── .env.example
├── data/
│   └── db.json            # base local (criada no primeiro start)
├── public/
│   ├── index.html         # telas: inicial, cadastro, pedido do cliente, painel
│   ├── script.js          # front-end (sem framework)
│   └── styles.css         # design tokens e layout
└── integrations/
    └── apps-script.gs     # Google Sheets (opcional)
```

Só três dependências: `express`, `cors` e `dotenv`. Sem banco, sem build, sem framework de front.

## Modelo de dados (`db.json`)

```jsonc
{
  "vendedor": { "nome": "", "negocio": "", "telefone": "", "endereco": "", "categoria": "", "horario": "", "observacoes": "" },
  "clientes": [
    { "id": "CLI-...", "nome": "Maria", "telefone": "91999999999", "endereco": "", "observacoes": "", "criadoEm": "...", "atualizadoEm": "..." }
  ],
  "cardapio": [
    { "id": "ITEM-...", "nome": "Bolo de cenoura", "categoria": "Bolos", "preco": 45, "unidade": "unidade",
      "quantidade": 3,           // prontos para retirada agora
      "descricao": "", "disponivel": true, "origem": "personalizado", "atualizadoEm": "..." }
  ],
  "pedidos": [
    { "id": "PED-...", "dataHora": "...", "cliente": "Maria", "telefone": "", "produto": "Bolo de chocolate",
      "quantidade": "2", "dataEntrega": "Sábado", "horarioEntrega": "", "pagamento": "Pix",
      "endereco": "A confirmar", "observacoes": "...", "status": "Pendente",
      "origem": "lm-studio-local",  // ou "fallback-regra" ou "manual"
      "clienteId": "CLI-...", "itemCardapioId": "ITEM-...", "precoUnitario": 45,
      "valorEstimado": 90, "precisaConfirmar": false }
  ],
  "tarefas": [
    { "id": "TAR-...", "dataHora": "...", "tarefa": "Comprar açúcar", "prazo": "Amanhã",
      "prioridade": "Normal", "status": "Pendente", "origem": "ia" }
  ],
  "logs": [ { "dataHora": "...", "tipo": "pedido", "mensagem": "...", "origem": "server" } ]
}
```

Notas:

- **Escrita atômica** (arquivo temporário + `rename`): um crash no meio da gravação não corrompe a base.
- `db.json` corrompido é preservado como `db.json.corrompido-<timestamp>` e a base é recriada, em vez de derrubar o app.
- Os logs são limitados às 500 entradas mais recentes.
- `status` é sempre `Pendente` ou `Concluído`.
- `precisaConfirmar: true` sinaliza pedido com dado faltando (produto, quantidade ou preço não casaram com o cardápio).

## Referência da API

**Públicas** (usadas pela tela do cliente, sem login):

| Rota | O que faz |
| --- | --- |
| `GET /api/cardapio-do-dia` | Cardápio visível ao cliente: nome, categoria, descrição, preço, unidade, quantidade e `pronto`. |
| `POST /api/clientes` | Cadastra ou atualiza o cliente (dedup por telefone). |
| `POST /api/message` | Interpreta o pedido (IA ou fallback) e grava pedido/tarefa/conversa. |
| `POST /api/login` | Valida a senha e devolve o cookie de sessão. `401` se errada. |
| `POST /api/logout` | Encerra a sessão. |
| `GET /api/session` | Diz se o cookie atual é válido. |
| `GET /api/pendentes` | Só o número de pendências (para o selo do acesso do vendedor). |

**Protegidas** (exigem sessão do vendedor; devolvem `401` sem ela):

| Rota | O que faz |
| --- | --- |
| `GET /api/data` | Base completa. |
| `GET /api/health` | Diagnóstico do LM Studio (ligado, URL, modelo). |
| `GET /api/templates` | Modelos de cardápio disponíveis. |
| `GET` / `POST /api/settings` | Lê e grava a URL do Google Sheets (só `https`). |
| `POST /api/sheets-test` | Envia um registro de teste à planilha. |
| `POST /api/vendedor` | Salva o perfil do negócio *(sem tela ainda — veja Limitações)*. |
| `POST /api/cardapio` | Adiciona item ao cardápio (com quantidade pronta). |
| `PATCH /api/cardapio/:id` | Atualiza item: preço, unidade, quantidade, disponibilidade. |
| `POST /api/cardapio/templates` | Adiciona um modelo pronto (`doceria`, `marmitaria`, `salgados`). |
| `POST /api/cardapio/encerrar-dia` | Zera as quantidades prontas, mantendo o catálogo. |
| `POST /api/manual-order` | Registra pedido pelo formulário. |
| `POST /api/manual-task` | Registra tarefa direto *(sem tela ainda — veja Limitações)*. |
| `PATCH /api/pedidos\|tarefas/:id/status` | Conclui ou reabre. |
| `DELETE /api/pedidos\|tarefas\|clientes\|cardapio/:id` | Exclui um registro. |
| `POST /api/clear` | Limpa pedidos, clientes, tarefas e logs (mantém cardápio e perfil). |
| `GET /api/export/pedidos\|tarefas\|clientes\|cardapio\|logs` | Exporta CSV (`;` como separador, BOM para o Excel). |

## Exemplos de mensagem

Pedido do cliente, pelo link:

```text
Oi, boa tarde! Queria encomendar 2 bolos de chocolate pra sábado, retirada de tarde, pago no pix.
```

Pedido que chegou por outro canal e a vendedora colou no painel:

```text
Cliente Mariana pediu 2 bolos de chocolate para sexta às 15h, retirada no local, pagamento no pix.
```

Tarefa de produção:

```text
Lembra de comprar açúcar e leite condensado amanhã cedo.
```

Com o cardápio do dia preenchido, um pedido de "100 brigadeiros" casa com o item cadastrado e o painel já mostra **R$ 250,00** como valor estimado.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| Log `erro_ia — fetch failed` | Servidor do LM Studio desligado | Aba Developer → Start Server. Confirme com `curl http://localhost:1234/v1/models`. |
| Log `erro_ia — LM Studio 404: model not found` | `LMSTUDIO_MODEL` errado | Use o `id` exato de `GET /v1/models`. |
| Log `erro_ia — Tempo limite excedido` | Modelo carregando ou máquina lenta | Aumente `LMSTUDIO_TIMEOUT_MS` ou pré-carregue o modelo. |
| Log `erro_ia — O modelo não retornou JSON válido` | Modelo base ou muito pequeno | Troque por um modelo *instruct*. |
| "Aviso: SESSION_SECRET não definido" | `.env` sem a chave | Gere uma chave e preencha `SESSION_SECRET`. |
| Login não entra | Senha diferente da do `.env` | Confira `SELLER_PASSWORD` e reinicie o `npm start`. |
| `401` nas chamadas do painel | Sessão expirada (12h) ou servidor reiniciado sem `SESSION_SECRET` | Entre de novo. |
| Vitrine do cliente vazia | Nenhum item no cardápio ou todos fora do cardápio | Publique itens no bloco Cardápio do dia. |
| Google Sheets não recebe nada | URL errada, não implantada ou sem permissão | Abra a URL no navegador: deve responder `{"ok":true,"servico":"Auto.io"}`. Reimplante como Aplicativo da Web com acesso "qualquer pessoa com o link". |
| CSV com acentos quebrados | Excel ignorando UTF-8 | O export já vai com BOM; abra pelo Excel normalmente. |

## Limitações conhecidas

- **O link não está publicado.** O app roda em `localhost`; o cenário do Instagram é demonstrado nesse ambiente. Publicar exige hospedagem ou túnel.
- **A tela do cliente é aberta.** Qualquer pessoa com o link pode enviar pedido — não há verificação de identidade, confirmação por código nem limite de envio.
- **Sem integração automática com WhatsApp/Instagram.** O canal antigo continua manual: a vendedora cola a mensagem no painel.
- **Sem agenda nem limite de produção.** A regra levantada na entrevista (máximo 3 produções por dia, de quarta a domingo) ainda não é aplicada como trava.
- **`POST /api/vendedor` e `POST /api/manual-task` não têm tela.** Existem na API, mas o painel ainda não expõe formulário de perfil do negócio nem de tarefa manual.
- **A vitrine do cliente não atualiza sozinha.** Recarrega ao abrir a tela e a cada pedido enviado; se a tela ficar parada e o estoque mudar, a informação envelhece.
- **O Apps Script não grava todos os campos.** A aba Tarefas não tem coluna de prioridade, e a de Pedidos não traz horário de entrega, preço unitário nem valor estimado. A aba Clientes sempre acrescenta uma linha, então pode acumular duplicatas.
- **`dataHora` é guardado como texto no formato brasileiro**, o que dificulta ordenar e filtrar por data.
- **Um vendedor por vez.** Não há múltiplos usuários nem controle de permissões.