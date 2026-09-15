# MKT Agent Interagir

Agente Python do módulo **Livo Interagir**, derivado do `mkt-agent-livo` (fluxo
Livonius/Livo). Recebe conteúdo de três origens (RSS, arquivo, pauta editorial),
passa por Curador → Redator → Revisor → Designer, gera a imagem via `gpt-image-1`,
compõe o logo da marca (Edge Function) e entrega o post no content-crafter via
Edge Function como `IN_REVIEW_INTERNAL`.

Lê e escreve exclusivamente no schema `interagir` do projeto Supabase
compartilhado (`SUPABASE_SCHEMA=interagir`) — nunca no schema `public`, que é a
base de produção do Livonius.

## Arquitetura

```
Entrada (RSS livo/livonius | Arquivo | Pauta editorial)
        │
        ▼  (FastAPI, este repo — pipeline em background)
  Step 1 Curador   — OpenAI + skills (matriz_selecao, detector_fontes, pilares)
  │                  decide APROVADO/NÃO + marca (livo|livonius) + vertical
  Step 2 Redator   — OpenAI + skills (tom_marca, persona, mercado, dados, performance)
  │                  escreve o conteúdo (markdown/caption por plataforma)
  Step 3 Revisor   — OpenAI + skills (brand_compliance, anti_plagio) — gate de qualidade
  Step 4 Designer  — Claude + skill visual da marca → prompt para gpt-image-1
  Step 5 Imagem    — gpt-image-1 → upload raw → Edge Function mkt-composite-logo (logo)
  Step 6 Handoff   — POST Edge Function mkt-receive-n8n-upload → mkt_social_posts
        │
        ▼
  content-crafter (usuária revisa/aprova/publica)
```

As "skills" que no n8n eram carregadas como tools HTTP agora são lidas de
`mkt_agent_skills` e injetadas no system prompt de cada agente (padrão olga-mkt-agent).

## Origens de conteúdo (endpoints)

| Endpoint | Equivalente n8n | Descrição |
|---|---|---|
| `POST /generate/rss` | `rss_puro_livo` / `rss_puro_livonius` | Varre feed(s) RSS e gera posts |
| `POST /generate/pauta` | `agenda_pauta_manual` | Gera post para uma pauta específica |
| `POST /generate/pautas/scan` | `sheets_rss` | Processa pautas pendentes da agenda |
| `POST /generate/files` | Webhook Arquivo | Gera post a partir de arquivo(s) |
| `POST /automation/scan` | Route by Workflow | Roteia por `workflow_name` |
| `GET /healthz` | — | Health check |

Acompanhe o progresso em `mkt_post_generation_status`
(`curating → writing → reviewing → generating_image → creating_post → completed`;
falha: `failed` com `error_message`).

## Decisões de arquitetura

- **Providers preservados do n8n**: OpenAI (gpt-4o/gpt-5) para Curador/Redator/Revisor/
  Ranker e Claude para o Designer — para manter o comportamento aprovado. Tudo
  configurável por env (`OPENAI_*_MODEL`, `ANTHROPIC_DESIGNER_MODEL`).
- **Publicação e composição de logo continuam em Edge Function** (`mkt-composite-logo`
  e `mkt-receive-n8n-upload`), como solicitado. O agente só as chama.
- **Duas marcas**: o Curador decide `livo` vs `livonius`; Redator e Designer carregam a
  skill de tom/visual correspondente.
- **Revisor é gate**: reprova → geração termina como `failed` (não publica peça ruim),
  como no n8n (que não seguia para o Designer sem `REVISADO_OK`).
- **Dedup** por link em `mkt_marketing_blog_content` (igual ao n8n).

## Setup

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # preencher chaves
uvicorn src.main:app --reload --port 8000
```

## Exemplos

```bash
# RSS (ambas as marcas, até 3 posts)
curl -X POST localhost:8000/generate/rss -H 'Content-Type: application/json' \
  -d '{"marca":"both","max_items":3}'

# Pauta específica da agenda editorial
curl -X POST localhost:8000/generate/pauta -H 'Content-Type: application/json' \
  -d '{"pauta_id":30}'

# Arquivo (mesmo contrato do webhook do n8n)
curl -X POST localhost:8000/generate/files -H 'Content-Type: application/json' \
  -d '{"files":[{"signed_url":"https://...","file_type":"pdf"}],"titulo":"...","channels":"blog"}'
```

## Testes

```bash
pytest tests/ -q
```

## Tabelas Supabase usadas (projeto vywalfkdlbmuoyxfgjhc)

- `mkt_agent_skills` — skills (system prompts) por agente/marca
- `mkt_pautas` — agenda editorial (entrada)
- `mkt_marketing_blog_content` — índice de dedup + resultado da curadoria
- `mkt_post_analytics` — performance histórica (Redator/Designer)
- `mkt_social_posts` — saída (via Edge Function; lê `image_prompt` recentes p/ Designer)
- `mkt_post_generation_status` — tracking do frontend
