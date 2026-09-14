import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getSocialbuToken(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, { db: { schema: 'interagir' } });

  let currentToken = "";
  try {
    const { data } = await supabase
      .from("mkt_system_config")
      .select("value")
      .eq("key", "socialbu_token")
      .single();
    currentToken = data?.value || "";
  } catch (_) {}

  if (!currentToken) {
    currentToken = Deno.env.get("SOCIALBU_API_TOKEN") || "";
  }

  if (currentToken) {
    const testRes = await fetch(
      "https://socialbu.com/api/v1/accounts?per_page=1",
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );
    const contentType = testRes.headers.get("content-type") || "";
    if (testRes.ok && contentType.includes("application/json")) {
      return currentToken;
    }
  }

  const email = Deno.env.get("SOCIALBU_EMAIL")!;
  const password = Deno.env.get("SOCIALBU_PASSWORD")!;

  const authRes = await fetch("https://socialbu.com/api/v1/auth/get_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const authData = await authRes.json();
  const newToken = authData.authToken || authData.token;

  if (!newToken) {
    throw new Error(`SocialBu re-auth failed: ${JSON.stringify(authData)}`);
  }

  await supabase.from("mkt_system_config").upsert({
    key: "socialbu_token",
    value: newToken,
    updated_at: new Date().toISOString(),
  });

  return newToken;
}
