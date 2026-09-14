import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MANUAL_WORKFLOW_NAME = "agenda_pauta_manual";
const STUCK_PROCESSING_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookUrl = Deno.env.get("N8N_AUTOMATION_WEBHOOK");

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ error: "N8N_AUTOMATION_WEBHOOK not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normaliza URL — tolera secret salvo sem 'h' inicial ("ttps://") ou sem esquema
    let normalizedWebhookUrl = webhookUrl.trim();
    if (normalizedWebhookUrl.startsWith("ttps://")) normalizedWebhookUrl = "h" + normalizedWebhookUrl;
    else if (normalizedWebhookUrl.startsWith("ttp://")) normalizedWebhookUrl = "h" + normalizedWebhookUrl;
    else if (!/^https?:\/\//i.test(normalizedWebhookUrl)) normalizedWebhookUrl = "https://" + normalizedWebhookUrl.replace(/^\/+/, "");

    const body = await req.json().catch(() => ({}));
    const pautaId = Number(body?.pauta_id);

    if (!Number.isFinite(pautaId) || pautaId <= 0) {
      return new Response(
        JSON.stringify({ error: "pauta_id inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'interagir' } });

    // mkt_pautas é a tabela base canônica; "pautas" é apenas uma view de compatibilidade.
    const { data: pauta, error: pautaError } = await supabase
      .from("mkt_pautas")
      .select("id, titulo, status, updated_at")
      .eq("id", pautaId)
      .single();

    if (pautaError || !pauta) {
      return new Response(
        JSON.stringify({ error: "Pauta não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // .trim() é essencial: importações por CSV geram status com "\r\n" no fim
    // (ex.: "pendente\r\n"), que sem trim cairiam indevidamente na guarda 409.
    const normalizedStatus = String(pauta.status || "").trim().toLowerCase();
    const isStuckProcessing =
      normalizedStatus === "processando" &&
      !!pauta.updated_at &&
      Date.now() - new Date(pauta.updated_at).getTime() > STUCK_PROCESSING_MS;

    // Só permite disparo manual para pautas pendentes/com erro, ou para uma pauta
    // "processando" que ficou presa (>15min) — nesse caso reenviamos.
    const canTrigger =
      normalizedStatus === "pendente" ||
      normalizedStatus === "erro" ||
      isStuckProcessing;

    if (!canTrigger) {
      return new Response(
        JSON.stringify({ error: "Apenas pautas pendentes ou com erro podem ser geradas manualmente" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const agentSecret = Deno.env.get("AGENT_SHARED_SECRET") ?? "";
    const webhookHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (agentSecret) webhookHeaders["x-agent-secret"] = agentSecret;

    const webhookResponse = await fetch(normalizedWebhookUrl, {
      method: "POST",
      headers: webhookHeaders,
      body: JSON.stringify({
        workflow_name: MANUAL_WORKFLOW_NAME,
        pauta_id: pautaId,
        display_name: pauta.titulo,
        source: isStuckProcessing ? "manual_resend" : "manual_button",
        previous_status: normalizedStatus,
      }),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      return new Response(
        JSON.stringify({ error: `Agente falhou: ${webhookResponse.status} ${webhookResponse.statusText} — ${errorText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await webhookResponse.text();

    const { error: updateError } = await supabase
      .from("mkt_pautas")
      .update({
        status: "processando",
        updated_at: new Date().toISOString(),
      })
      .eq("id", pautaId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Pauta disparada, mas não foi possível atualizar status: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        pauta_id: pautaId,
        status: "processando",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("trigger-agenda-pauta error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
