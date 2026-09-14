import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsletterCallbackRequest {
  campaign_id: string;
  run_id?: string;
  status: "sent" | "sent_with_errors" | "failed";
  metrics: {
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    failed_recipients?: Array<{ email: string; error: string }>;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const data: NewsletterCallbackRequest = await req.json();
    const { campaign_id, status, metrics } = data;

    console.log(`Received callback for campaign ${campaign_id}:`, { status, metrics });

    // Update campaign with final metrics
    const { error: updateError } = await supabase
      .from("mkt_newsletter_campaigns")
      .update({
        status: status,
        sent_count: metrics.sent_count,
        failed_count: metrics.failed_count,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    if (updateError) {
      throw new Error(`Error updating campaign: ${updateError.message}`);
    }

    console.log(`Campaign ${campaign_id} updated with final metrics`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campaign metrics updated",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in newsletter-callback:", errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
