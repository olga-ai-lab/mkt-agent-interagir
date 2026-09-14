import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Get the frontend URL for redirects
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://id-preview--fc4d0dae-9461-4c40-9538-3f52deea89b8.lovable.app";

    if (error) {
      console.error("OAuth error from provider:", error, errorDescription);
      return Response.redirect(
        `${frontendUrl}/app/settings?oauth_error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${frontendUrl}/app/settings?oauth_error=${encodeURIComponent("Missing code or state")}`
      );
    }

    // Decode state
    let stateData: { workspace_id: string; provider: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return Response.redirect(
        `${frontendUrl}/app/settings?oauth_error=${encodeURIComponent("Invalid state")}`
      );
    }

    const { workspace_id, provider } = stateData;

    // Verify state is not too old (15 minutes max)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      return Response.redirect(
        `${frontendUrl}/app/settings?oauth_error=${encodeURIComponent("OAuth session expired")}`
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    // Build callback URL
    const callbackUrl = `${supabaseUrl}/functions/v1/interagir-oauth-callback`;

    let connectionData: {
      account_id: string;
      account_name: string;
      account_username?: string;
      profile_picture_url?: string;
      access_token: string;
      refresh_token?: string;
      token_expires_at?: string;
      scopes: string[];
      page_id?: string;
      page_name?: string;
    };

    if (provider === "linkedin") {
      connectionData = await handleLinkedInCallback(code, callbackUrl);
    } else {
      // Instagram or Facebook
      connectionData = await handleMetaCallback(code, callbackUrl, provider);
    }

    // Save to database
    const { error: dbError } = await supabase
      .from("mkt_social_connections")
      .upsert({
        workspace_id,
        provider,
        ...connectionData,
        is_active: true,
        last_error: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "workspace_id,provider,account_id",
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return Response.redirect(
        `${frontendUrl}/app/settings?oauth_error=${encodeURIComponent("Failed to save connection")}`
      );
    }

    // Redirect back to settings with success
    return Response.redirect(
      `${frontendUrl}/app/settings?oauth_success=${provider}&account=${encodeURIComponent(connectionData.account_name || connectionData.account_id)}`
    );

  } catch (error) {
    console.error("OAuth callback error:", error);
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://id-preview--fc4d0dae-9461-4c40-9538-3f52deea89b8.lovable.app";
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.redirect(
      `${frontendUrl}/app/settings?oauth_error=${encodeURIComponent(message)}`
    );
  }
});

async function handleLinkedInCallback(code: string, redirectUri: string) {
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!;
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!;

  // Exchange code for access token
  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("LinkedIn token error:", errorText);
    throw new Error("Failed to exchange code for token");
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in; // seconds

  // Get user profile
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    throw new Error("Failed to fetch LinkedIn profile");
  }

  const profile = await profileResponse.json();

  return {
    account_id: profile.sub,
    account_name: profile.name,
    account_username: profile.email,
    profile_picture_url: profile.picture,
    access_token: accessToken,
    refresh_token: tokenData.refresh_token || null,
    token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scopes: ["openid", "profile", "email", "w_member_social"],
  };
}

async function handleMetaCallback(code: string, redirectUri: string, provider: string) {
  const appId = Deno.env.get("META_APP_ID")!;
  const appSecret = Deno.env.get("META_APP_SECRET")!;

  // Exchange code for short-lived token
  const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("code", code);

  const tokenResponse = await fetch(tokenUrl.toString());
  
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json();
    console.error("Meta token error:", errorData);
    throw new Error(errorData.error?.message || "Failed to exchange code");
  }

  const tokenData = await tokenResponse.json();
  let accessToken = tokenData.access_token;

  // Exchange for long-lived token (60 days)
  const longLivedUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", accessToken);

  const longLivedResponse = await fetch(longLivedUrl.toString());
  
  if (longLivedResponse.ok) {
    const longLivedData = await longLivedResponse.json();
    accessToken = longLivedData.access_token;
  }

  // Get user info
  const meResponse = await fetch(
    `https://graph.facebook.com/v18.0/me?fields=id,name,picture&access_token=${accessToken}`
  );
  const me = await meResponse.json();

  if (provider === "instagram") {
    // Get pages and Instagram accounts
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    // Find first page with Instagram account
    const pageWithIg = pagesData.data?.find((p: any) => p.instagram_business_account);
    
    if (!pageWithIg) {
      throw new Error("Nenhuma conta profissional do Instagram encontrada. Certifique-se de ter uma conta Business/Creator vinculada a uma Página do Facebook.");
    }

    const igAccount = pageWithIg.instagram_business_account;

    // Get page access token (long-lived)
    const pageTokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageWithIg.id}?fields=access_token&access_token=${accessToken}`
    );
    const pageTokenData = await pageTokenResponse.json();

    return {
      account_id: igAccount.id,
      account_name: igAccount.username,
      account_username: igAccount.username,
      profile_picture_url: igAccount.profile_picture_url,
      access_token: pageTokenData.access_token || accessToken,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_insights"],
      page_id: pageWithIg.id,
      page_name: pageWithIg.name,
    };
  } else {
    // Facebook page
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,picture,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    const page = pagesData.data?.[0];
    
    if (!page) {
      throw new Error("Nenhuma Página do Facebook encontrada. Você precisa ser administrador de pelo menos uma Página.");
    }

    return {
      account_id: page.id,
      account_name: page.name,
      profile_picture_url: page.picture?.data?.url,
      access_token: page.access_token,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      page_id: page.id,
      page_name: page.name,
    };
  }
}
