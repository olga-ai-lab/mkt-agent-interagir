import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSocialbuToken } from "../_shared/socialbu.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function inferProvider(accountType: string): string {
  if (accountType.startsWith("linkedin")) return "linkedin";
  if (accountType.startsWith("facebook")) return "facebook";
  if (accountType.startsWith("instagram")) return "instagram";
  if (accountType.startsWith("twitter")) return "twitter";
  return accountType.split(".")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id");

    if (!workspace_id) {
      return new Response("missing workspace_id", { status: 400 });
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) {}

    const { account_action, account_id, account_type, account_name } = body;

    console.log("socialbu-postback:", { account_action, account_id, account_type, account_name, workspace_id });

    if (!["added", "updated"].includes(account_action)) {
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    , { db: { schema: 'interagir' } });

    const resolvedProvider = inferProvider(account_type || "");

    let profilePictureUrl: string | null = null;
    let pageId: string | null = null;
    let pageName: string | null = null;

    try {
      const token = await getSocialbuToken();
      const detailRes = await fetch(
        `https://socialbu.com/api/v1/accounts/${account_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (detailRes.ok) {
        const detail = await detailRes.json();
        profilePictureUrl = detail.image || null;
        if (account_type?.includes(".org") || account_type?.includes(".page")) {
          pageId = detail.account_id || String(account_id);
          pageName = account_name;
        }
      }
    } catch (e) {
      console.warn("could not fetch account details for", account_id, e);
    }

    const { error } = await supabase.from("mkt_social_connections").upsert({
      workspace_id,
      provider: resolvedProvider,
      account_id: String(account_id),
      account_name: account_name || null,
      profile_picture_url: profilePictureUrl,
      access_token: "socialbu-managed",
      is_active: true,
      page_id: pageId,
      page_name: pageName,
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,provider,account_id" });

    if (error) {
      console.error("socialbu-postback: upsert error:", error);
    } else {
      console.log("socialbu-postback: upsert success for", resolvedProvider, account_name);
    }

  } catch (e) {
    console.error("socialbu-postback: unexpected error:", e);
  }

  return new Response("OK", { status: 200 });
});
