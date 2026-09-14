import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSocialbuToken } from "../_shared/socialbu.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, workspace_id } = await req.json();

    if (!provider || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing provider or workspace_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["linkedin", "facebook", "instagram", "twitter"].includes(provider)) {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const socialbuToken = await getSocialbuToken();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const sbRes = await fetch("https://socialbu.com/api/v1/accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${socialbuToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: provider,
        postback_url: `${supabaseUrl}/functions/v1/interagir-socialbu-postback?workspace_id=${workspace_id}`,
      }),
    });

    const sbRawText = await sbRes.text();
    console.log("SocialBu response status:", sbRes.status, "body:", sbRawText.substring(0, 300));

    let sbData: any;
    try { sbData = JSON.parse(sbRawText); } catch { sbData = { raw: sbRawText }; }

    if (!sbRes.ok || !sbData.connect_url) {
      throw new Error(`SocialBu ${sbRes.status}: ${sbRawText.substring(0, 200)}`);
    }

    return new Response(
      JSON.stringify({ auth_url: sbData.connect_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("OAuth init error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
