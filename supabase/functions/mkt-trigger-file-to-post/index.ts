// Repassa o pedido de "Criar post a partir de arquivo" (FileToPostUploader.tsx)
// pro workflow n8n correspondente. Existia antes como um fetch DIRETO do
// navegador pro webhook do n8n (ver git blame) — igual a todo outro disparo de
// n8n deste projeto (trigger-agenda-pauta, mkt-trigger-agenda-pauta etc.), essa
// chamada precisa passar por uma edge function: o fetch do navegador está
// sujeito a CORS, e o n8n Cloud não retorna os headers Access-Control-Allow-*
// necessários pra um POST cross-origin com Content-Type: application/json (o
// preflight OPTIONS falha antes mesmo do webhook ser chamado). Do servidor
// (Deno), CORS não se aplica.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_WEBHOOK_URL = "https://olga-flow.app.n8n.cloud/webhook/arquivo-conteudo-livonius";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("N8N_ARQUIVO_WEBHOOK_URL") || DEFAULT_WEBHOOK_URL;
    const payload = await req.json().catch(() => null);

    if (!payload || !Array.isArray(payload.files) || payload.files.length === 0) {
      return new Response(
        JSON.stringify({ error: "files é obrigatório e não pode estar vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      return new Response(
        JSON.stringify({ error: `Agente falhou: ${webhookResponse.status} ${webhookResponse.statusText} — ${errorText.slice(0, 300)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mkt-trigger-file-to-post error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
