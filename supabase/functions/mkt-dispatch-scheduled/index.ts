import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'interagir' } });

  try {
    // Find campaigns that are scheduled and past their scheduled_at time
    const { data: campaigns, error } = await supabase
      .from("mkt_newsletter_campaigns")
      .select("id, subject, content, segments")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (error) throw new Error(`Erro ao buscar campanhas: ${error.message}`);

    if (!campaigns || campaigns.length === 0) {
      console.log("mkt-dispatch-scheduled: nenhuma campanha pendente");
      return new Response(
        JSON.stringify({ dispatched: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`mkt-dispatch-scheduled: ${campaigns.length} campanha(s) para disparar`);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const campaign of campaigns) {
      // Mark as sending immediately to prevent double-dispatch on next cron tick
      await supabase
        .from("mkt_newsletter_campaigns")
        .update({ status: "sending" })
        .eq("id", campaign.id)
        .eq("status", "scheduled"); // guard against race condition

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/mkt-send-newsletter`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            campaign_id: campaign.id,
            subject: campaign.subject,
            content: campaign.content,
            segments: campaign.segments ?? [],
          }),
        });

        const body = await resp.json().catch(() => ({}));
        const success = resp.ok && body.success !== false;

        results.push({ id: campaign.id, success, error: success ? undefined : body.error });
        console.log(`mkt-dispatch-scheduled: campanha ${campaign.id} → ${success ? "ok" : "erro: " + body.error}`);
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        console.error(`mkt-dispatch-scheduled: falha ao chamar mkt-send-newsletter para ${campaign.id}:`, msg);
        // Revert status so it can be retried next tick
        await supabase
          .from("mkt_newsletter_campaigns")
          .update({ status: "scheduled" })
          .eq("id", campaign.id);
        results.push({ id: campaign.id, success: false, error: msg });
      }
    }

    return new Response(
      JSON.stringify({ dispatched: campaigns.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("mkt-dispatch-scheduled:fatal", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
