# Deploy no Railway + Integração com o Front-end

## 1. Deploy no Railway

O repositório já tem `Dockerfile` + `railway.json` (healthcheck em `/healthz`). O
Railway detecta o Dockerfile automaticamente e injeta `$PORT`.

### Passo a passo
1. **New Project → Deploy from GitHub repo** → selecione `olga-ai-lab/mkt-agent-livo`.
2. Em **Settings → Source**, aponte a branch (`claude/livonius-mkt-agent-plan-gyq18e`
   ou `main` depois do merge). O build usa o `Dockerfile` (via `railway.json`).
3. Em **Variables**, adicione as variáveis de ambiente (ver seção 2).
4. **Deploy**. Quando ficar verde, o Railway expõe uma URL pública
   (`https://mkt-agent-livo-production.up.railway.app`).
5. Em **Settings → Networking → Generate Domain** (se ainda não houver).
6. Teste: `curl https://<sua-url>/healthz` → `{"ok":true,...}`.

### Variáveis de ambiente (Railway → Variables)
Obrigatórias:
```
SUPABASE_URL=https://vywalfkdlbmuoyxfgjhc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role do projeto Livonius>
SUPABASE_ANON_KEY=<anon key — usada no header da Edge Function de publicação>
OPENAI_API_KEY=<chave OpenAI (a mesma "OpenAI LIVO" usada no n8n)>
ANTHROPIC_API_KEY=<chave Anthropic (Designer)>
AGENT_SHARED_SECRET=<gere um secret; o front/EF envia no header X-Agent-Secret>
```
Opcionais (têm default no código):
```
OPENAI_CURADOR_MODEL=gpt-4o
OPENAI_CURADOR_PERMISSIVE_MODEL=gpt-5
OPENAI_REDATOR_MODEL=gpt-5
OPENAI_REVISOR_MODEL=gpt-4o
OPENAI_RANKER_MODEL=gpt-4o
OPENAI_TEXT_MODEL=gpt-4.1
OPENAI_IMAGE_MODEL=gpt-image-1
ANTHROPIC_DESIGNER_MODEL=claude-sonnet-4-5
RSS_FEED_LIVO=https://rss.app/feeds/_KEXK5NbJ9zcBgT8r.xml
RSS_FEED_LIVONIUS=https://rss.app/feeds/_rKuKzclkfkdj7dUs.xml
RSS_FEED_PAUTA=https://rss.app/feeds/_R1o40aZsXDfzML7D.xml
AUTOMATION_MAX_ITEMS=5
LANGFUSE_PUBLIC_KEY=      # opcional (observabilidade)
LANGFUSE_SECRET_KEY=      # opcional
```

> `COMPOSITE_LOGO_EF` e `RECEIVE_UPLOAD_EF` assumem o padrão do `SUPABASE_URL`
> (`/functions/v1/mkt-composite-logo` e `/functions/v1/mkt-receive-n8n-upload`).
> Só defina se as EFs mudarem de nome.

### Resources
- 1 réplica, 512MB–1GB RAM basta (1–3 posts/dia). A pipeline roda em background
  dentro do processo, então não precisa de worker separado.

---

## 2. Integração com o Front-end (o que falta)

O agente NÃO exige mudança visual no front-end — ele reaproveita as mesmas
tabelas e a mesma Edge Function de publicação. O que muda é **para onde os
gatilhos apontam**: hoje vão para o webhook do n8n; passam a apontar para o Railway.

### Onde os 3 gatilhos são disparados hoje (Edge Functions)
| Gatilho (EF atual) | Ação no front | Novo destino no agente |
|---|---|---|
| `mkt-trigger-agenda-pauta` | botão "gerar" numa pauta | `POST /generate/pauta` (body `{pauta_id}`) ou `/automation/scan` (`workflow_name=agenda_pauta_manual`, `pauta_id`) |
| `mkt-check-automation-schedules` | cron de geração automática | `POST /automation/scan` (body `{workflow_name}`: `rss_puro_livo` / `rss_puro_livonius` / `sheets_rss`) |
| upload de arquivo (webhook `arquivo-conteudo-livonius`) | tela de upload | `POST /generate/files` (mesmo body: `files[]`, `titulo`, `observacoes`, `generation_id`) |

**Duas formas de repointar (escolha uma):**

- **A) Trocar a URL de destino dentro dessas Edge Functions** (recomendado, zero
  mudança no front): onde elas fazem `fetch(N8N_WEBHOOK_URL, ...)`, troque para
  `fetch(AGENT_URL + "/automation/scan", ...)` mantendo o mesmo body, e adicione o
  header `X-Agent-Secret`. A URL pode vir de `mkt_system_config` ou de um secret da EF.

- **B) Apontar direto do front-end** para a URL do Railway (se o front chama os
  webhooks sem passar por EF).

### Checklist de integração
- [ ] Definir `AGENT_URL` (URL pública do Railway) onde os gatilhos são montados
      (secret da EF, `mkt_system_config`, ou env do front).
- [ ] Repointar os 3 gatilhos (tabela acima) para os endpoints do agente, enviando
      `X-Agent-Secret: <AGENT_SHARED_SECRET>`.
- [ ] Confirmar o **contrato de status**: o front acompanha `mkt_post_generation_status`
      via Realtime. O n8n emitia `reading → extracting → generating → completed`.
      O agente emite mais granular: `curating → writing → reviewing →
      generating_image → creating_post → completed` (falha: `failed`). Se a UI só
      reconhece o conjunto antigo, alinhamos os rótulos (o terminal `completed`/`failed`
      é idêntico, então o mínimo já funciona).
- [ ] Confirmar que a EF `mkt-receive-n8n-upload` continua sendo a de destino
      (existe também uma `receive-n8n-upload` sem prefixo — o agente aponta para a `mkt-`).
- [ ] Teste E2E: disparar uma pauta real e ver o card aparecer em revisão no content-crafter.
- [ ] Desligar/parar o workflow n8n antigo só depois do E2E aprovado.

### Automação (cron)
No n8n havia um schedule chamando o webhook de automação. Duas opções:
- Manter a EF `mkt-check-automation-schedules` (que lê `mkt_automation_schedules`) e
  fazê-la chamar `POST /automation/scan` do agente; **ou**
- Criar um Cron no próprio Railway (ou um `pg_cron`/Scheduled Function no Supabase)
  batendo em `/automation/scan` com o `workflow_name` desejado.
