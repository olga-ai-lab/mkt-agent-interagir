# Patch n8n — preservar a logo original (sem carimbo) para o editor de fotos

## Problema

No fluxo `PROD_Marketing_Livonius — Fluxo principal`, o card do post precisa
gravar **duas** imagens:

- `media_urls` → imagem final **carimbada** (mostrada direto ao usuário);
- `base_media_urls` → imagem **crua, sem logo** (a mídia-base que o editor de
  "Composição de Marca" usa para o usuário mover/recolorir a logo).

O editor estava recebendo a imagem **já carimbada** como base e desenhava a logo
móvel por cima → apareciam **duas** logos e a barra não podia ser movida.

### Causas (corrigidas)

1. **Edge Function `mkt-composite-logo` apagava a imagem crua** (`storage.remove`
   do `{id}_raw.png`) logo após gerar a final. Sem a crua, não existia base.
   → Corrigido no código: a crua é mantida e a função passou a retornar também
   `base_public_url`. Ver `supabase/functions/mkt-composite-logo/index.ts`.

2. **Nó `Preparar Payload Final` montava as URLs dos nós errados** e deixava
   `base_file_url` vazio. Com `base_file_url` vazio, o `mkt-receive-n8n-upload`
   caía no fallback `base_media_urls = media_urls` (a carimbada).
   → Corrigido aqui: o nó passa a ler `public_url` e `base_public_url` da resposta
   da `Composite_Logo_EF`.

## O que trocar no n8n

Substitua **somente** o nó **`Preparar Payload Final`** (tipo
`n8n-nodes-base.code`) pelo JSON abaixo. Os nós `Composite_Logo_EF` e
`Publish_Edge_Function1` **não mudam** — o `Publish_Edge_Function1` já repassa
`file_url`/`file_urls`/`base_file_url`/`base_file_urls`.

> A mudança de comportamento da `Composite_Logo_EF` (passar a devolver
> `base_public_url` e não apagar a crua) vem do **deploy da Edge Function
> `mkt-composite-logo`**, não do node — só faça o deploy dessa função.

### Node corrigido: `Preparar Payload Final`

```json
{
  "parameters": {
    "jsCode": "// Lê as URLs direto da resposta da Edge Function mkt-composite-logo,\n// que agora retorna tanto a imagem carimbada (public_url) quanto a\n// imagem crua, sem logo (base_public_url). A crua vira base_media_urls\n// no banco e é o que o editor de Composição de Marca usa como mídia-base.\nconst composite = $('Composite_Logo_EF').item.json;\nconst rawId = $('DALLE_Image_Gen1').item.json.id;\nconst STORAGE_BASE =\n  'https://vywalfkdlbmuoyxfgjhc.supabase.co/storage/v1/object/public/mkt-article-images';\n\n// Fallback monta a URL a partir do id caso a Edge Function não retorne a chave.\nconst fileUrl = composite.public_url || (rawId ? `${STORAGE_BASE}/${rawId}.png` : '');\nconst baseUrl = composite.base_public_url || (rawId ? `${STORAGE_BASE}/${rawId}_raw.png` : '');\n\nreturn [\n  {\n    json: {\n      file_url: fileUrl,\n      file_urls: fileUrl ? [fileUrl] : [],\n      base_file_url: baseUrl,\n      base_file_urls: baseUrl ? [baseUrl] : []\n    }\n  }\n];"
  },
  "id": "1a8b2d85-1799-4372-8f4b-7c2933d82e83",
  "name": "Preparar Payload Final",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    14064,
    6848
  ]
}
```

### Como aplicar

- **Opção A (recolar o node):** no canvas do n8n, apague o node atual
  `Preparar Payload Final`, cole o JSON acima (Ctrl/Cmd+V cola node copiado), e
  reconecte: `Composite_Logo_EF → Preparar Payload Final → Extrair_Titulo_Resumo`.
  O `id` e a `position` foram mantidos para casar com as conexões existentes.
- **Opção B (editar só o código):** abra o node `Preparar Payload Final` e
  substitua todo o conteúdo do campo **JavaScript** pelo trecho do `jsCode` acima
  (a versão sem escape, legível):

```js
// Lê as URLs direto da resposta da Edge Function mkt-composite-logo,
// que agora retorna tanto a imagem carimbada (public_url) quanto a
// imagem crua, sem logo (base_public_url). A crua vira base_media_urls
// no banco e é o que o editor de Composição de Marca usa como mídia-base.
const composite = $('Composite_Logo_EF').item.json;
const rawId = $('DALLE_Image_Gen1').item.json.id;
const STORAGE_BASE =
  'https://vywalfkdlbmuoyxfgjhc.supabase.co/storage/v1/object/public/mkt-article-images';

// Fallback monta a URL a partir do id caso a Edge Function não retorne a chave.
const fileUrl = composite.public_url || (rawId ? `${STORAGE_BASE}/${rawId}.png` : '');
const baseUrl = composite.base_public_url || (rawId ? `${STORAGE_BASE}/${rawId}_raw.png` : '');

return [
  {
    json: {
      file_url: fileUrl,
      file_urls: fileUrl ? [fileUrl] : [],
      base_file_url: baseUrl,
      base_file_urls: baseUrl ? [baseUrl] : []
    }
  }
];
```

## Verificação

1. Deploy da Edge Function `mkt-composite-logo`.
2. Rode o fluxo. No bucket `mkt-article-images` devem **coexistir**
   `{id}_raw.png` (crua) e `{id}.png` (carimbada).
3. Em `mkt_social_posts`, a linha nova deve ter `media_urls` (carimbada) e
   `base_media_urls` (`..._raw.png`) **diferentes** entre si.
4. No app, abra o post → "Composição de Marca": a mídia-base é a imagem **sem
   logo** e aparece **só uma** logo (a overlay móvel), que pode ser movida e
   recolorida.
