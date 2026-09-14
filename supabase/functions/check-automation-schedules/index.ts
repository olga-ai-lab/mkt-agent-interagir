import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'interagir' } });
    const now = new Date();

    // Get all active schedules
    const { data: schedules, error } = await supabase
      .from("mkt_automation_schedules")
      .select("*")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching schedules:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const triggered: string[] = [];

    for (const schedule of schedules || []) {
      const nextRun = schedule.next_run_at ? new Date(schedule.next_run_at) : new Date(0);

      if (now < nextRun) continue;

      // Calculate next run time
      let intervalMs: number;
      switch (schedule.interval_unit) {
        case "minutes": intervalMs = schedule.interval_value * 60 * 1000; break;
        case "hours": intervalMs = schedule.interval_value * 60 * 60 * 1000; break;
        case "days": intervalMs = schedule.interval_value * 24 * 60 * 60 * 1000; break;
        default: intervalMs = 60 * 60 * 1000;
      }

      const newNextRun = new Date(now.getTime() + intervalMs);

      // Update schedule in DB
      const { error: updateError } = await supabase
        .from("mkt_automation_schedules")
        .update({
          last_run_at: now.toISOString(),
          next_run_at: newNextRun.toISOString(),
          runs_this_week: (schedule.runs_this_week || 0) + 1,
        })
        .eq("id", schedule.id);

      if (updateError) {
        console.error(`Error updating schedule ${schedule.id}:`, updateError);
        continue;
      }

      // Fire webhook to n8n
      try {
        const resp = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow_name: schedule.workflow_name,
            display_name: schedule.display_name,
            schedule_id: schedule.id,
          }),
        });

        if (!resp.ok) {
          const body = await resp.text();
          console.error(`Webhook failed for ${schedule.workflow_name}: ${resp.status} ${body}`);
        } else {
          await resp.text();
          triggered.push(schedule.workflow_name);
          console.log(`Triggered: ${schedule.workflow_name}`);
        }
      } catch (webhookErr) {
        console.error(`Webhook error for ${schedule.workflow_name}:`, webhookErr);
      }
    }

    return new Response(
      JSON.stringify({
        checked_at: now.toISOString(),
        total_active: schedules?.length || 0,
        triggered,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
