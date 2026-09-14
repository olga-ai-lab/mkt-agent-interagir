import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExchangeRequest {
  provider: 'instagram' | 'facebook';
  access_token: string;
  user_id: string;
  workspace_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, access_token, user_id, workspace_id } = await req.json() as ExchangeRequest;

    if (!provider || !access_token || !user_id || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const META_APP_ID = Deno.env.get("META_APP_ID");
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

    if (!META_APP_ID || !META_APP_SECRET) {
      return new Response(
        JSON.stringify({ error: "Meta credentials not configured", missing_config: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange short-lived token for long-lived token
    const longLivedTokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    longLivedTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedTokenUrl.searchParams.set("client_id", META_APP_ID);
    longLivedTokenUrl.searchParams.set("client_secret", META_APP_SECRET);
    longLivedTokenUrl.searchParams.set("fb_exchange_token", access_token);

    const tokenResponse = await fetch(longLivedTokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      return new Response(
        JSON.stringify({ error: tokenData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const longLivedToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 5184000; // 60 days default
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch user profile
    const profileResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,picture&access_token=${longLivedToken}`
    );
    const profileData = await profileResponse.json();

    let connectionData: Record<string, unknown>;

    if (provider === 'instagram') {
      // For Instagram, we need to get pages and their linked Instagram accounts
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${longLivedToken}`
      );
      const pagesData = await pagesResponse.json();

      if (!pagesData.data || pagesData.data.length === 0) {
        return new Response(
          JSON.stringify({ 
            error: "Nenhuma página encontrada. Você precisa ter uma Página do Facebook com conta Instagram Business vinculada." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find first page with Instagram account
      const pageWithInstagram = pagesData.data.find(
        (page: { instagram_business_account?: unknown }) => page.instagram_business_account
      );

      if (!pageWithInstagram) {
        return new Response(
          JSON.stringify({ 
            error: "Nenhuma conta Instagram Business encontrada vinculada às suas páginas." 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const igAccount = pageWithInstagram.instagram_business_account;

      // Get page long-lived token
      const pageLongLivedToken = pageWithInstagram.access_token;

      connectionData = {
        provider: 'instagram',
        account_id: igAccount.id,
        account_name: igAccount.username,
        account_username: igAccount.username,
        profile_picture_url: igAccount.profile_picture_url,
        access_token: pageLongLivedToken, // Use page token for Instagram API
        token_expires_at: null, // Page tokens don't expire
        scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
        page_id: pageWithInstagram.id,
        page_name: pageWithInstagram.name,
      };
    } else {
      // For Facebook, get pages and use page token
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,picture&access_token=${longLivedToken}`
      );
      const pagesData = await pagesResponse.json();

      if (!pagesData.data || pagesData.data.length === 0) {
        return new Response(
          JSON.stringify({ error: "Nenhuma página encontrada." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const page = pagesData.data[0];

      connectionData = {
        provider: 'facebook',
        account_id: page.id,
        account_name: page.name,
        account_username: null,
        profile_picture_url: page.picture?.data?.url || null,
        access_token: page.access_token,
        token_expires_at: null, // Page tokens don't expire
        scopes: ['pages_manage_posts', 'pages_read_engagement'],
        page_id: page.id,
        page_name: page.name,
      };
    }

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const { data: connection, error: dbError } = await supabase
      .from("mkt_social_connections")
      .upsert({
        workspace_id,
        ...connectionData,
        is_active: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "workspace_id,provider,account_id",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({ error: "Erro ao salvar conexão" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        connection: {
          id: connection.id,
          provider: connection.provider,
          account_name: connection.account_name,
          account_username: connection.account_username,
          profile_picture_url: connection.profile_picture_url,
          page_name: connection.page_name,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("OAuth exchange error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
