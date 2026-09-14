# Patch manual n8n - Origem de post + pauta + canais (validado com o JSON completo)

Este patch considera o JSON completo do fluxo com os 3 modos de criacao:

- `arquivo`
- `rss normal`
- `pauta editorial`

O objetivo final para o frontend funcionar corretamente na tela de `Posts` e:

1. todo post chegar com `origem` preenchido como `arquivo`, `rss` ou `agenda_editorial`
2. posts de pauta chegarem com `pauta_id`
3. posts de pauta chegarem com `channels`
4. posts de pauta poderem ser ligados ao `titulo` da pauta no app
5. posts de qualquer origem chegarem com `channels` coerentes para o card/tabela

---

## 1) O que ja foi atendido no fluxo

No JSON atual, estes pontos ja aparecem atendidos ou parcialmente atendidos:

- existe `Marcar Processando Supabase` (`2c1b3346-8722-44fa-8150-5c90d94ac20b`) com `status = processando`
- existe `Preparar para AI Ranker` (`5f797305-5096-47e5-bbdc-9594b5cfb959`) propagando:
  - `pauta_id`
  - `pauta_canais`
  - `pauta_marca`
  - `pauta_observacoes`
  - `pauta_data_prevista`
  - `pauta_vertical`
- existe `Separar Artigos Selecionados` (`fe3e804b-3887-4784-becb-10a7107ec401`) ja normalizando `channels`
- existe `Extrair Decisão Curador Pauta1` (`b5cfc260-a101-4763-b2e3-7fb700bf5a28`) ja retornando:
  - `origem: "agenda_editorial"`
  - `pauta_id`
  - `channels`
  - `observacoes`
  - `link_referencia`

Ou seja: a base da trilha de `pauta` foi colocada, mas ainda ha erros de ligacao e de consistencia entre nodes.

---

## 2) O que ainda esta quebrado no JSON atual

### A. `Publish_Edge_Function` referencia o node errado

Node:

- `Publish_Edge_Function` (`b5a0cfa7-92b1-4a24-8fd2-ae998cd28763`)

Problema:

- o `body` usa expressoes como:
  - `$('Extrair Decisão Curador Pauta').item.json.marca`
  - `$('Extrair Decisão Curador Pauta').item.json.origem`
- mas no JSON atual o node real se chama `Extrair Decisão Curador Pauta1`

Impacto:

- `company`, `origem`, `pauta_id`, `channels`, `observacoes`, `link_referencia` podem chegar vazios ou quebrar

Correcao recomendada:

- **nao depender do node da pauta diretamente**
- usar `Limit`, que e o ponto unificado dos 3 fluxos

Use este `body`:

```javascript
={{ JSON.stringify({
  file_url: $('Preparar Payload Final1').item.json.file_url,
  file_urls: $('Preparar Payload Final1').item.json.file_urls,
  content: $json.conteudo,
  title: $json.titulo,
  company: $('Limit').item.json.marca || 'livonius',
  excerpt: $json.resumo,
  origem: $('Limit').item.json.origem || 'rss',
  pauta_id: $('Limit').item.json.pauta_id ?? null,
  channels: $('Limit').item.json.channels || [],
  observacoes: $('Limit').item.json.observacoes || null,
  link_referencia: $('Limit').item.json.link_referencia || null
}) }}
```

### B. `Merge Fontes` ainda esta no meio do caminho

Node:

- `Merge Fontes` (`e57f6bb2-5ccd-418d-a779-6354ed1567bf`)

Situacao atual:

- ele ainda junta:
  - `Extrair_Decisao_Curador1` (arquivo)
  - `Extrair Decisão Curador Pauta1` (pauta)
  - `Wait_Pre_Redator` (rss normal)

Problema:

- isso so funciona se todos os ramos entregarem a mesma estrutura
- hoje isso nao acontece

Impacto:

- `Limit` pode receber dados incompletos dependendo da origem

Regra obrigatoria para manter esse merge:

- os 3 ramos precisam devolver os mesmos campos minimos:
  - `marca`
  - `vertical`
  - `plataforma`
  - `origem`
  - `channels`
  - `pauta_id`
  - `observacoes`
  - `link_referencia`

### C. `Extrair_Decisao_Curador` do RSS normal nao propaga origem/canais

Node:

- `Extrair_Decisao_Curador` (`deda1683-04c7-4e6e-9f21-284727a04c53`)

Hoje retorna:

- `marca`
- `vertical`
- `curador_output`
- `plataforma`

Problema:

- nao retorna `origem`
- nao retorna `channels`
- nao retorna `pauta_id`
- nao retorna `observacoes`
- nao retorna `link_referencia`

Correcao recomendada:

```javascript
const output = $('Curador_AI_Agent').item.json.output || '';

let marca = 'livo';
let vertical = 'geral';
let marcaExplicita = false;

const marcaMatch = output.match(/Marca:\\s*(livonius|livo)/i);
if (marcaMatch) {
  marca = marcaMatch[1].toLowerCase();
  marcaExplicita = true;
}

const verticalMatch = output.match(/Vertical:\\s*([^|*\\n]+)/i);
if (verticalMatch) {
  vertical = verticalMatch[1].trim().toLowerCase();
}

const textoCompleto = (vertical + ' ' + output).toLowerCase();
const ehRCO = textoCompleto.includes('rco') || textoCompleto.includes('responsabilidade civil');
const ehCasco =
  textoCompleto.includes('casco') &&
  (textoCompleto.includes('onibus') || textoCompleto.includes('ônibus'));

if (!marcaExplicita) {
  marca = ehRCO || ehCasco ? 'livonius' : 'livo';
}

const plataforma = $('Normalizar_Input').item.json.plataforma || 'blog';
const channels = [plataforma].filter((v) =>
  ['instagram', 'facebook', 'linkedin', 'blog'].includes(v)
);

return [{
  json: {
    marca,
    vertical,
    curador_output: output,
    plataforma,
    origem: 'rss',
    channels,
    pauta_id: null,
    observacoes: null,
    link_referencia: $('Normalizar_Input').item.json.fonte_url || null
  }
}];
```

### D. `Extrair_Decisao_Curador1` do fluxo de arquivo nao propaga origem/canais

Node:

- `Extrair_Decisao_Curador1` (`1791220e-5f9f-437c-878b-803073ab9382`)

Hoje retorna:

- `marca`
- `vertical`
- `curador_output`
- `plataforma: 'blog'`

Problema:

- nao retorna `origem`
- nao retorna `channels`
- nao retorna `pauta_id`
- nao retorna `observacoes`
- nao retorna `link_referencia`

Correcao recomendada:

```javascript
const output = $input.first()?.json?.output ?? '';

let marca = 'livo';
let vertical = 'geral';

const marcaMatch = output.match(/Marca:\\s*(livonius|livo)/i);
if (marcaMatch) {
  marca = marcaMatch[1].toLowerCase();
}

const verticalMatch = output.match(/Vertical:\\s*([^|*\\n]+)/i);
if (verticalMatch) {
  vertical = verticalMatch[1].trim().toLowerCase();
}

const textoCompleto = (vertical + ' ' + output).toLowerCase();
const ehRCO =
  textoCompleto.includes('rco') ||
  textoCompleto.includes('responsabilidade civil');

const ehCasco =
  textoCompleto.includes('casco') &&
  (textoCompleto.includes('onibus') || textoCompleto.includes('ônibus'));

if (ehRCO || ehCasco) {
  marca = 'livonius';
}

return [{
  json: {
    marca,
    vertical,
    curador_output: output,
    plataforma: 'blog',
    origem: 'arquivo',
    channels: ['blog'],
    pauta_id: null,
    observacoes: $('Webhook Arquivo').item.json.body.observacoes || null,
    link_referencia: null
  }
}];
```

### E. `Aprovado Pauta?1` esta com o branch errado

Node:

- `Aprovado Pauta?1` (`6ac86512-ba3a-4d63-8228-e627aa558c4f`)

Problema atual no JSON:

- um dos branches envia ao mesmo tempo para:
  - `Não Aprovado - Próximo1`
  - `Extrair Decisão Curador Pauta1`

Isso nao faz sentido logico.

Comportamento correto:

- branch **nao aprovado** -> somente `Não Aprovado - Próximo1`
- branch **aprovado** -> `Salvar Link Supabase1`

Depois de `Salvar Link Supabase1`, ai sim seguir para:

- `Marcar Processando Supabase`
- `Extrair Decisão Curador Pauta1`

### F. `Merge2` ainda esta sobrando

Node:

- `Merge2` (`b9055a5c-6b82-4804-ad22-3b569b7c6a8a`)

Problema:

- `Designer_AI_Agent1` entra duas vezes no mesmo merge

Correcao:

- remover `Merge2`
- ligar `Designer_AI_Agent1` direto em `DALLE_Image_Gen`

### G. Ha nodes duplicados/obsoletos no JSON

Exemplos:

- `Separar Artigos Selecionados1` (`55c3005a-e85b-4042-afff-a7932ad29da0`) referencia `Preparar para AI Ranker1`, que nem aparece no fluxo ativo
- existe mistura entre nomes antigos e nomes novos de nodes da pauta

Recomendacao:

- desabilitar ou excluir nodes antigos para evitar expressao apontando para node errado

---

## 3) Formato minimo que precisa chegar ao `Limit`

Para a mecanica funcionar bem no projeto, os 3 fluxos devem chegar ao `Limit` com este contrato:

```json
{
  "marca": "livo",
  "vertical": "saude",
  "plataforma": "linkedin",
  "origem": "rss",
  "channels": ["linkedin"],
  "pauta_id": null,
  "observacoes": null,
  "link_referencia": "https://..."
}
```

Para `pauta`:

```json
{
  "marca": "livonius",
  "vertical": "rco",
  "plataforma": "linkedin",
  "origem": "agenda_editorial",
  "channels": ["instagram", "linkedin"],
  "pauta_id": 10,
  "observacoes": "usar gancho mais consultivo",
  "link_referencia": "https://..."
}
```

Para `arquivo`:

```json
{
  "marca": "livo",
  "vertical": "geral",
  "plataforma": "blog",
  "origem": "arquivo",
  "channels": ["blog"],
  "pauta_id": null,
  "observacoes": "contexto adicional do upload",
  "link_referencia": null
}
```

---

## 4) Como o frontend vai usar isso

Com o projeto atual, o app espera:

- `origem = "arquivo"` para mostrar badge `Arquivo`
- `origem = "rss"` para mostrar badge `RSS`
- `origem = "agenda_editorial"` para mostrar badge `Pauta`
- `pauta_id` para buscar e exibir o titulo da pauta no card/tabela
- `channels` para mostrar os canais ja selecionados no card/tabela e no editor

Se `origem` vier vazia ou errada, o frontend nao consegue distinguir corretamente as 3 origens.

---

## 5) Checklist final de validacao

### Posts via arquivo

1. subir um arquivo de teste
2. confirmar no request da edge function:
   - `origem = "arquivo"`
   - `channels = ["blog"]`
3. confirmar em `social_posts`:
   - `origem = arquivo`
   - `pauta_id = null`

### Posts via RSS normal

1. executar automacao RSS
2. confirmar no request da edge function:
   - `origem = "rss"`
   - `channels = ["blog"]` ou o canal da plataforma definida
3. confirmar em `social_posts`:
   - `origem = rss`
   - `pauta_id = null`

### Posts via pauta

1. criar uma pauta com canais definidos
2. executar a criacao por pauta
3. confirmar no request da edge function:
   - `origem = "agenda_editorial"`
   - `pauta_id` preenchido
   - `channels` preenchido
4. confirmar em `social_posts`:
   - `origem = agenda_editorial`
   - `pauta_id` preenchido
   - `channels` igual aos canais da pauta
5. confirmar em `pautas`:
   - `status = processando` no n8n
   - `status = gerado` na edge function

---

## 6) Observacoes de seguranca e consistencia

- o JSON compartilhado contem chaves/token em texto plano; rotacionar credenciais depois
- ainda existe mistura de dois projetos Supabase nas tools:
  - `uvwqhpesqbufjpytveti`
  - `bwsfmojkvnjcrpgvidej`
- idealmente consolidar tudo no projeto correto para evitar skill/prompt vindo de ambiente diferente

---

## 7) Nodes prontos para copiar no n8n

### A. `Extrair_Decisao_Curador` (RSS normal)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const output = $('Curador_AI_Agent').item.json.output || '';\n\nlet marca = 'livo';\nlet vertical = 'geral';\nlet marcaExplicita = false;\n\nconst marcaMatch = output.match(/Marca:\\s*(livonius|livo)/i);\nif (marcaMatch) {\n  marca = marcaMatch[1].toLowerCase();\n  marcaExplicita = true;\n}\n\nconst verticalMatch = output.match(/Vertical:\\s*([^|*\\n]+)/i);\nif (verticalMatch) {\n  vertical = verticalMatch[1].trim().toLowerCase();\n}\n\nconst textoCompleto = (vertical + ' ' + output).toLowerCase();\nconst ehRCO = textoCompleto.includes('rco') || textoCompleto.includes('responsabilidade civil');\nconst ehCasco = textoCompleto.includes('casco') && (textoCompleto.includes('onibus') || textoCompleto.includes('ônibus'));\n\nif (!marcaExplicita) {\n  marca = ehRCO || ehCasco ? 'livonius' : 'livo';\n}\n\nconst plataforma = $('Normalizar_Input').item.json.plataforma || 'blog';\nconst channels = [plataforma].filter((v) => ['instagram', 'facebook', 'linkedin', 'blog'].includes(v));\n\nreturn [{\n  json: {\n    marca,\n    vertical,\n    curador_output: output,\n    plataforma,\n    origem: 'rss',\n    channels,\n    pauta_id: null,\n    observacoes: null,\n    link_referencia: $('Normalizar_Input').item.json.fonte_url || null\n  }\n}];"
      },
      "id": "deda1683-04c7-4e6e-9f21-284727a04c53",
      "name": "Extrair_Decisao_Curador",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2256,
        -960
      ]
    }
  ],
  "connections": {
    "Extrair_Decisao_Curador": {
      "main": [
        []
      ]
    }
  },
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "060caa1820985675af627b30b6a9d696903d9399efbd10abbbebf749260037a0"
  }
}
```

### B. `Extrair_Decisao_Curador1` (Arquivo)

```json
{
  "nodes": [
    {
      "parameters": {
        "jsCode": "const output = $input.first()?.json?.output ?? '';\n\nlet marca = 'livo';\nlet vertical = 'geral';\n\nconst marcaMatch = output.match(/Marca:\\s*(livonius|livo)/i);\nif (marcaMatch) {\n  marca = marcaMatch[1].toLowerCase();\n}\n\nconst verticalMatch = output.match(/Vertical:\\s*([^|*\\n]+)/i);\nif (verticalMatch) {\n  vertical = verticalMatch[1].trim().toLowerCase();\n}\n\nconst textoCompleto = (vertical + ' ' + output).toLowerCase();\nconst ehRCO = textoCompleto.includes('rco') || textoCompleto.includes('responsabilidade civil');\nconst ehCasco = textoCompleto.includes('casco') && (textoCompleto.includes('onibus') || textoCompleto.includes('ônibus'));\n\nif (ehRCO || ehCasco) {\n  marca = 'livonius';\n}\n\nreturn [{\n  json: {\n    marca,\n    vertical,\n    curador_output: output,\n    plataforma: 'blog',\n    origem: 'arquivo',\n    channels: ['blog'],\n    pauta_id: null,\n    observacoes: $('Webhook Arquivo').item.json.body.observacoes || null,\n    link_referencia: null\n  }\n}];"
      },
      "id": "1791220e-5f9f-437c-878b-803073ab9382",
      "name": "Extrair_Decisao_Curador1",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2352,
        -2288
      ]
    }
  ],
  "connections": {
    "Extrair_Decisao_Curador1": {
      "main": [
        []
      ]
    }
  },
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "060caa1820985675af627b30b6a9d696903d9399efbd10abbbebf749260037a0"
  }
}
```

### C. `Publish_Edge_Function`

```json
{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "https://uvwqhpesqbufjpytveti.supabase.co/functions/v1/receive-n8n-upload",
        "sendHeaders": true,
        "specifyHeaders": "json",
        "jsonHeaders": "{\n  \"Content-Type\": \"application/json\",\n  \"Authorization\": \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2d3FocGVzcWJ1ZmpweXR2ZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTA3NDUsImV4cCI6MjA4NTM4Njc0NX0.a-DByTpXt1PmSgTcTt8gjS9fzhnqgIaEsHWAjzQkItw\"\n}",
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "application/json",
        "body": "={{ JSON.stringify({\n  file_url: $('Preparar Payload Final1').item.json.file_url,\n  file_urls: $('Preparar Payload Final1').item.json.file_urls,\n  content: $json.conteudo,\n  title: $json.titulo,\n  company: $('Limit').item.json.marca || 'livonius',\n  excerpt: $json.resumo,\n  origem: $('Limit').item.json.origem || 'rss',\n  pauta_id: $('Limit').item.json.pauta_id ?? null,\n  channels: $('Limit').item.json.channels || [],\n  observacoes: $('Limit').item.json.observacoes || null,\n  link_referencia: $('Limit').item.json.link_referencia || null\n}) }}",
        "options": {}
      },
      "id": "b5a0cfa7-92b1-4a24-8fd2-ae998cd28763",
      "name": "Publish_Edge_Function",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.3,
      "position": [
        6096,
        -1552
      ]
    }
  ],
  "connections": {
    "Publish_Edge_Function": {
      "main": [
        []
      ]
    }
  },
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "060caa1820985675af627b30b6a9d696903d9399efbd10abbbebf749260037a0"
  }
}
```

### D. Ajuste logico de conexao em `Aprovado Pauta?1`

O node `Aprovado Pauta?1` nao precisa de `jsCode`, mas a conexao correta deve ficar assim:

- branch `nao aprovado` -> `Não Aprovado - Próximo1`
- branch `aprovado` -> `Salvar Link Supabase1`

Depois:

- `Salvar Link Supabase1` -> `Marcar Processando Supabase`
- `Marcar Processando Supabase` -> `Extrair Decisão Curador Pauta1`

### E. Ajuste estrutural recomendado

- remover `Merge2`
- ligar `Designer_AI_Agent1` direto em `DALLE_Image_Gen`

Se quiser manter `Merge Fontes`, mantenha somente se os 3 ramos entregarem o mesmo contrato:

- `marca`
- `vertical`
- `plataforma`
- `origem`
- `channels`
- `pauta_id`
- `observacoes`
- `link_referencia`

---

## 8) Geração manual de uma pauta específica

### Recomendação

Use **um trigger dedicado para pauta individual**, em vez de reaproveitar o fluxo do agendador.

Motivo:

- o fluxo automático atual começa buscando `todas` as pautas pendentes
- para um clique manual no app, precisamos garantir que apenas a pauta clicada seja processada

### Payload recomendado enviado pelo app

O app agora dispara a Supabase Function `trigger-agenda-pauta`, que encaminha para o n8n:

```json
{
  "workflow_name": "agenda_pauta_manual",
  "pauta_id": 123,
  "display_name": "Título da pauta",
  "source": "manual_button"
}
```

### Ajuste necessário no webhook `automation-trigger`

No node `Route by Workflow`, adicionar uma nova regra:

- `workflow_name = agenda_pauta_manual`

Saída sugerida:

- `Pauta Manual`

### Fluxo recomendado para `Pauta Manual`

1. criar um node novo `Pauta Específica do Supabase`
2. buscar a pauta por `id`
3. seguir para o mesmo bloco já existente de:
   - `Tem Pauta?1`
   - `RSS para Pauta`
   - `Agregar RSS1`
   - `Preparar para AI Ranker`
   - `AI Ranker Pauta1`
   - `Separar Artigos Selecionados`

### Node recomendado: `Pauta Específica do Supabase`

```json
{
  "nodes": [
    {
      "parameters": {
        "operation": "getAll",
        "tableId": "pautas",
        "matchType": "allFilters",
        "filters": {
          "conditions": [
            {
              "keyName": "id",
              "condition": "eq",
              "keyValue": "={{ $json.body.pauta_id }}"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.supabase",
      "typeVersion": 1,
      "position": [
        80,
        -1760
      ],
      "id": "manual-pauta-supabase",
      "name": "Pauta Específica do Supabase",
      "credentials": {
        "supabaseApi": {
          "id": "im23v8XDPEZ7l2re",
          "name": "MKT Livonius"
        }
      }
    }
  ],
  "connections": {
    "Pauta Específica do Supabase": {
      "main": [
        []
      ]
    }
  },
  "pinData": {},
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "060caa1820985675af627b30b6a9d696903d9399efbd10abbbebf749260037a0"
  }
}
```

### Conexões recomendadas

- `Webhook Automation Trigger` -> `Route by Workflow`
- `Route by Workflow` saída `Pauta Manual` -> `Pauta Específica do Supabase`
- `Pauta Específica do Supabase` -> `Tem Pauta?1`

### Importante

Para essa rota manual, **não** use o node `Pauta do Supabase` que filtra por `status = pendente`, porque a função do app já pode ter colocado a pauta em `processando`.
