import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SocialConnection {
  id: string;
  workspace_id: string;
  provider: string;
  account_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  page_id: string | null;
}

interface RefreshResult {
  id: string;
  provider: string;
  success: boolean;
  error?: string;
  new_expires_at?: string;
}

async function refreshMetaToken(connection: SocialConnection): Promise<{ access_token: string; expires_at: string | null }> {
  const META_APP_ID = Deno.env.get("META_APP_ID");
  const META_APP_SECRET = Deno.env.get("META_APP_SECRET");

  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error("Meta credentials not configured");
  }

  // For page tokens, we need to refresh the user token first, then get new page token
  // However, page tokens that are obtained from a long-lived user token don't expire
  // So we primarily need to check if this is a user token or page token

  // Try to exchange current token for a new long-lived token
  const url = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", META_APP_ID);
  url.searchParams.set("client_secret", META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", connection.access_token);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Failed to refresh Meta token");
  }

  const expiresIn = data.expires_in || 5184000; // 60 days default
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // If this is for a page, get the new page token
  if (connection.page_id) {
    const pageTokenUrl = `https://graph.facebook.com/v18.0/${connection.page_id}?fields=access_token&access_token=${data.access_token}`;
    const pageResponse = await fetch(pageTokenUrl);
    const pageData = await pageResponse.json();

    if (pageData.error) {
      throw new Error(pageData.error.message || "Failed to get page token");
    }

    return {
      access_token: pageData.access_token,
      expires_at: null, // Page tokens don't expire
    };
  }

  return {
    access_token: data.access_token,
    expires_at: expiresAt,
  };
}

async function refreshLinkedInToken(connection: SocialConnection): Promise<{ access_token: string; expires_at: string }> {
  const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID");
  const LINKEDIN_CLIENT_SECRET = Deno.env.get("LINKEDIN_CLIENT_SECRET");

  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
    throw new Error("LinkedIn credentials not configured");
  }

  if (!connection.refresh_token) {
    throw new Error("No refresh token available for LinkedIn connection");
  }

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
    }).toString(),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error || "Failed to refresh LinkedIn token");
  }

  const expiresIn = data.expires_in || 5184000; // 60 days default
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  return {
    access_token: data.access_token,
    expires_at: expiresAt,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    // Get connections that expire within the next 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: expiringConnections, error: fetchError } = await supabase
      .from("mkt_social_connections")
      .select("*")
      .eq("is_active", true)
      .not("token_expires_at", "is", null)
      .lt("token_expires_at", sevenDaysFromNow);

    if (fetchError) {
      console.error("Error fetching connections:", fetchError);
      throw fetchError;
    }

    const results: RefreshResult[] = [];

    for (const connection of expiringConnections || []) {
      // Skip SocialBu-managed connections — SocialBu handles token refresh
      if (connection.access_token === "socialbu-managed" || connection.access_token === null) {
        continue;
      }

      try {
        let newTokenData: { access_token: string; expires_at: string | null };

        if (connection.provider === "linkedin") {
          newTokenData = await refreshLinkedInToken(connection);
        } else {
          // Instagram and Facebook use Meta API
          newTokenData = await refreshMetaToken(connection);
        }

        // Update the connection with new token
        const { error: updateError } = await supabase
          .from("mkt_social_connections")
          .update({
            access_token: newTokenData.access_token,
            token_expires_at: newTokenData.expires_at,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          id: connection.id,
          provider: connection.provider,
          success: true,
          new_expires_at: newTokenData.expires_at || undefined,
        });

        console.log(`Successfully refreshed token for ${connection.provider} connection ${connection.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        
        // Update connection with error
        await supabase
          .from("mkt_social_connections")
          .update({
            last_error: `Token refresh failed: ${errorMessage}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        results.push({
          id: connection.id,
          provider: connection.provider,
          success: false,
          error: errorMessage,
        });

        console.error(`Failed to refresh token for ${connection.provider} connection ${connection.id}:`, errorMessage);
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
        message: results.length === 0 
          ? "No tokens expiring within 7 days" 
          : `Processed ${results.length} connection(s)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OAuth refresh error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
