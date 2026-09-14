import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendNewsletterRequest {
  campaign_id: string;
  subject: string;
  content: string;
  segments: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const { campaign_id, subject, content, segments }: SendNewsletterRequest = await req.json();

    console.log(`Processing newsletter campaign ${campaign_id}`);

    // Fetch active subscribers, filtered by segments if specified
    let query = supabase
      .from("mkt_newsletter_subscribers")
      .select("id, email, name")
      .eq("is_active", true);

    const { data: subscribers, error: subscribersError } = await query;

    if (subscribersError) {
      throw new Error(`Error fetching subscribers: ${subscribersError.message}`);
    }

    // Filter by segments if specified
    let filteredSubscribers = subscribers || [];
    if (segments && segments.length > 0) {
      const { data: allSubscribers, error: allSubError } = await supabase
        .from("mkt_newsletter_subscribers")
        .select("id, email, name, segments")
        .eq("is_active", true);

      if (allSubError) {
        throw new Error(`Error fetching subscribers: ${allSubError.message}`);
      }

      filteredSubscribers = (allSubscribers || []).filter((sub) => {
        const subSegments = sub.segments || [];
        return segments.some((seg) => subSegments.includes(seg));
      });
    }

    const recipientCount = filteredSubscribers.length;

    if (recipientCount === 0) {
      // Update campaign status to sent with 0 recipients
      await supabase
        .from("mkt_newsletter_campaigns")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          recipient_count: 0,
          sent_count: 0,
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "No subscribers found for the selected segments",
          recipient_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign status to sending
    await supabase
      .from("mkt_newsletter_campaigns")
      .update({
        status: "sending",
        recipient_count: recipientCount,
      })
      .eq("id", campaign_id);

    // Fetch n8n webhook URL from integrations table
    const { data: integrations, error: intError } = await supabase
      .from("mkt_integrations")
      .select("config")
      .eq("type", "n8n")
      .eq("is_active", true)
      .limit(1);

    if (intError) {
      throw new Error(`Error fetching integrations: ${intError.message}`);
    }

    const n8nConfig = integrations?.[0]?.config as Record<string, string> | undefined;
    const webhookUrl = n8nConfig?.newsletter_webhook;

    if (!webhookUrl) {
      await supabase
        .from("mkt_newsletter_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Newsletter webhook URL not configured",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare recipients for n8n
    const recipients = filteredSubscribers.map((sub) => ({
      email: sub.email,
      name: sub.name || "",
    }));

    // Prepare callback URL for n8n to report results
    const callbackUrl = `${supabaseUrl}/functions/v1/mkt-newsletter-callback`;

    // Send to n8n webhook
    const payload = {
      campaign_id,
      subject,
      content,
      recipients,
      callback_url: callbackUrl,
      metadata: {
        sent_at: new Date().toISOString(),
        total_recipients: recipientCount,
      },
    };

    console.log(`Sending to n8n webhook: ${webhookUrl}`);
    console.log(`Recipients: ${recipientCount}`);

    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`n8n webhook error: ${errorText}`);

      await supabase
        .from("mkt_newsletter_campaigns")
        .update({ status: "failed" })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `n8n webhook failed: ${n8nResponse.status}`,
          details: errorText?.slice(0, 2000) || null,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If n8n doesn't send a callback, mark as sent after successful webhook call
    // The callback function will update with final metrics if n8n calls it
    await supabase
      .from("mkt_newsletter_campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: recipientCount, // Assume all sent unless callback updates
      })
      .eq("id", campaign_id);

    console.log(`Newsletter campaign ${campaign_id} sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Newsletter sent to n8n for processing",
        recipient_count: recipientCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-newsletter:", errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
