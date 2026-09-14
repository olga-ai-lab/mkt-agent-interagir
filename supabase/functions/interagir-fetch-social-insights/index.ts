import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Conexões cujo publish passa pelo SocialBu gravam este placeholder em
// access_token (nunca um token real da Meta) — mesma constante usada em
// mkt-social-publish. Chamar graph.facebook.com com essa string como
// access_token sempre falha; para essas contas as métricas vêm da API do
// SocialBu, autenticada com o token compartilhado (getSocialbuToken), não com
// o access_token da conexão.
const SOCIALBU_MANAGED_TOKEN = "socialbu-managed";

// Inline (sem import relativo) de propósito: replica getSocialbuToken() de
// mkt-social-publish, que é o padrão real de deploy usado por toda função
// mkt-* em produção — um único index.ts autocontido. Um _shared/socialbu.ts
// via import relativo existe no repo, mas é usado pela função legada
// `social-publish` (schema antigo, sem prefixo mkt_); manter os dois em sync
// manualmente seria mais frágil do que inlinar aqui.
const SOCIALBU_CONFIG_KEY = "socialbu_token";
const SOCIALBU_CONFIG_TABLES = ["mkt_system_config", "system_config"] as const;

async function isSocialbuTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const res = await fetch("https://socialbu.com/api/v1/accounts?per_page=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const contentType = res.headers.get("content-type") || "";
  return res.ok && contentType.includes("application/json");
}

// deno-lint-ignore no-explicit-any
async function getSocialbuToken(supabase: any): Promise<string> {
  async function readStoredToken(): Promise<string> {
    for (const table of SOCIALBU_CONFIG_TABLES) {
      const { data, error } = await supabase.from(table).select("value").eq("key", SOCIALBU_CONFIG_KEY).maybeSingle();
      if (!error && data?.value) return data.value;
    }
    return "";
  }

  const storedToken = await readStoredToken();
  if (await isSocialbuTokenValid(storedToken)) return storedToken;

  // Re-autenticação (credenciais) fica em mkt-social-publish — esta função só
  // lê métricas, não precisa reimplementar o fluxo de login. Se o token
  // guardado expirou, falha explicitamente em vez de tentar renová-lo.
  throw new Error("SocialBu token expired or missing; run mkt-social-publish or refresh mkt_system_config.socialbu_token");
}

interface MetricsData {
  impressions: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  plays: number;
  engagement: number;
}

interface SocialConnection {
  id: string;
  provider: string;
  account_id: string;
  access_token: string;
  token_expires_at: string | null;
  page_id: string | null;
  workspace_id: string;
}

type FetchOutcome =
  | { status: "ok"; metrics: MetricsData }
  | { status: "not_yet_available" } // SocialBu ainda não coletou insights para este post
  | { status: "publish_failed"; reason: string } // o post nunca chegou a ir ao ar
  | { status: "error"; reason: string };

// ============ SOCIALBU (Instagram/Facebook geridos pelo SocialBu) ============

// Formato do objeto `insights` da API do SocialBu para um post com sucesso
// NÃO FOI OBSERVADO AINDA: nenhum post desta conta publicou com sucesso até
// agora (os 17 registros existentes falharam por limite diário do Instagram ou
// duplicidade — ver PR). Por isso o parsing abaixo é deliberadamente
// defensivo: tenta várias chaves plausíveis (nomenclatura do Graph API, que é
// o que o SocialBu consome por baixo) e não inventa valor para o que não
// achar. Quando o primeiro post publicar de verdade, revisar `raw_insights`
// gravado em mkt_post_analytics para confirmar as chaves reais e simplificar
// esta função.
function parseSocialBuInsights(insights: Record<string, unknown>): MetricsData {
  const pick = (...keys: string[]): number => {
    for (const key of keys) {
      const value = insights[key];
      if (typeof value === "number") return value;
      if (Array.isArray(value) && typeof value[0] === "number") return value[0] as number;
    }
    return 0;
  };

  const impressions = pick("impressions", "impression_count", "post_impressions");
  const reach = pick("reach", "reach_count", "post_impressions_unique");
  const likes = pick("likes", "like_count", "likes_count");
  const comments = pick("comments", "comment_count", "comments_count");
  const shares = pick("shares", "share_count", "shares_count");
  const saves = pick("saves", "saved", "save_count");
  const plays = pick("plays", "video_views", "play_count");

  const totalEngagements = likes + comments + shares + saves;
  const engagement = reach > 0 ? (totalEngagements / reach) * 100 : 0;

  return {
    impressions, reach, likes, comments, shares, saves, plays,
    engagement: parseFloat(engagement.toFixed(2)),
  };
}

async function fetchSocialBuPostInsights(
  socialbuPostId: string,
  socialbuToken: string,
): Promise<FetchOutcome> {
  try {
    const res = await fetch(`https://socialbu.com/api/v1/posts/${socialbuPostId}`, {
      headers: { Authorization: `Bearer ${socialbuToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return { status: "error", reason: `SocialBu HTTP ${res.status}: ${text.slice(0, 300)}` };
    }

    const post = await res.json();

    if (post.published !== true) {
      // O post nunca foi ao ar (limite diário do Instagram, duplicidade,
      // rejeição etc.) — não é falha de coleta de métrica, é ausência de post.
      const reason = post.error?.message || "post não publicado no destino";
      return { status: "publish_failed", reason };
    }

    if (!post.insights || typeof post.insights !== "object") {
      // SocialBu pode levar um tempo para coletar insights após a publicação.
      return { status: "not_yet_available" };
    }

    return { status: "ok", metrics: parseSocialBuInsights(post.insights) };
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.message : String(error) };
  }
}

// ============ INSTAGRAM/FACEBOOK VIA GRAPH API (conexão com token real da Meta) ============
//
// Mantido para conexões que NÃO são geridas pelo SocialBu (access_token é um
// token real da Meta, não o placeholder). Nenhuma conexão ativa hoje está
// nesse caso, mas o código publish-direto (social-publish/index.ts) ainda
// suporta esse caminho, então a leitura de métricas também precisa suportar.

async function fetchInstagramInsightsGraph(mediaId: string, accessToken: string): Promise<FetchOutcome> {
  try {
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}?fields=like_count,comments_count,timestamp,media_type&access_token=${accessToken}`
    );
    if (!mediaResponse.ok) {
      return { status: "error", reason: `Instagram media fetch: ${await mediaResponse.text()}` };
    }
    const mediaData = await mediaResponse.json();

    let insightsMetrics = "impressions,reach,saved";
    if (mediaData.media_type === "VIDEO" || mediaData.media_type === "REELS") insightsMetrics += ",plays";
    if (mediaData.media_type === "REELS") insightsMetrics += ",shares";

    const insightsResponse = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=${insightsMetrics}&access_token=${accessToken}`
    );

    let impressions = 0, reach = 0, saves = 0, plays = 0, shares = 0;
    if (insightsResponse.ok) {
      const insightsData = await insightsResponse.json();
      for (const metric of insightsData.data || []) {
        const value = metric.values?.[0]?.value || 0;
        if (metric.name === "impressions") impressions = value;
        else if (metric.name === "reach") reach = value;
        else if (metric.name === "saved") saves = value;
        else if (metric.name === "plays") plays = value;
        else if (metric.name === "shares") shares = value;
      }
    }

    const likes = mediaData.like_count || 0;
    const comments = mediaData.comments_count || 0;
    const totalEngagements = likes + comments + shares + saves;
    const engagement = reach > 0 ? (totalEngagements / reach) * 100 : 0;

    return {
      status: "ok",
      metrics: { impressions, reach, likes, comments, shares, saves, plays, engagement: parseFloat(engagement.toFixed(2)) },
    };
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchFacebookInsightsGraph(postId: string, accessToken: string): Promise<FetchOutcome> {
  try {
    const postResponse = await fetch(
      `https://graph.facebook.com/v19.0/${postId}?fields=shares,reactions.summary(total_count),comments.summary(total_count)&access_token=${accessToken}`
    );
    if (!postResponse.ok) {
      return { status: "error", reason: `Facebook post fetch: ${await postResponse.text()}` };
    }
    const postData = await postResponse.json();

    const insightsResponse = await fetch(
      `https://graph.facebook.com/v19.0/${postId}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users&access_token=${accessToken}`
    );

    let impressions = 0, reach = 0;
    if (insightsResponse.ok) {
      const insightsData = await insightsResponse.json();
      for (const metric of insightsData.data || []) {
        const value = metric.values?.[0]?.value || 0;
        if (metric.name === "post_impressions") impressions = value;
        else if (metric.name === "post_impressions_unique") reach = value;
      }
    }

    const likes = postData.reactions?.summary?.total_count || 0;
    const comments = postData.comments?.summary?.total_count || 0;
    const shares = postData.shares?.count || 0;
    const totalEngagements = likes + comments + shares;
    const engagement = reach > 0 ? (totalEngagements / reach) * 100 : 0;

    return {
      status: "ok",
      metrics: { impressions, reach, likes, comments, shares, saves: 0, plays: 0, engagement: parseFloat(engagement.toFixed(2)) },
    };
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.message : String(error) };
  }
}

// ============ LINKEDIN INSIGHTS (fora do escopo Meta, publish direto) ============

async function fetchLinkedInInsights(postUrn: string, accessToken: string): Promise<FetchOutcome> {
  try {
    const socialActionsResponse = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`,
      { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
    );

    let likes = 0, comments = 0, shares = 0;
    if (socialActionsResponse.ok) {
      const socialData = await socialActionsResponse.json();
      likes = socialData.likesSummary?.totalLikes || 0;
      comments = socialData.commentsSummary?.totalFirstLevelComments || 0;
      shares = socialData.sharesSummary?.totalShares || 0;
    }

    let impressions = 0, reach = 0;
    try {
      const statsResponse = await fetch(
        `https://api.linkedin.com/v2/shares/${encodeURIComponent(postUrn)}?fields=totalShareStatistics`,
        { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } }
      );
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        impressions = statsData.totalShareStatistics?.impressionCount || 0;
        reach = statsData.totalShareStatistics?.uniqueImpressionsCount || 0;
      }
    } catch {
      // estatísticas de share exigem permissão adicional; segue sem elas
    }

    const totalEngagements = likes + comments + shares;
    const engagement = reach > 0 ? (totalEngagements / reach) * 100 : 0;

    return {
      status: "ok",
      metrics: { impressions, reach, likes, comments, shares, saves: 0, plays: 0, engagement: parseFloat(engagement.toFixed(2)) },
    };
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.message : String(error) };
  }
}

// ============ UPSERT ANALYTICS ============

// deno-lint-ignore no-explicit-any
async function upsertAnalytics(supabase: any, postId: string, channel: string, metrics: MetricsData): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("mkt_post_analytics")
    .upsert(
      {
        post_id: postId,
        channel,
        recorded_date: today,
        recorded_at: new Date().toISOString(),
        impressions: metrics.impressions,
        reach: metrics.reach,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        plays: metrics.plays,
        engagements: metrics.likes + metrics.comments + metrics.shares + metrics.saves,
        engagement_rate: parseFloat((metrics.engagement / 100).toFixed(4)),
      },
      { onConflict: "post_id,channel,recorded_date" }
    );

  if (error) {
    console.error(`Error upserting analytics for post ${postId}:`, error);
    return false;
  }
  return true;
}

function isTokenExpired(connection: SocialConnection): boolean {
  if (!connection.token_expires_at) return false;
  const expiresAt = new Date(connection.token_expires_at);
  const buffer = new Date();
  buffer.setHours(buffer.getHours() + 1);
  return expiresAt < buffer;
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    let workspaceId: string | null = null;
    let daysBack = 30;
    try {
      const body = await req.json();
      workspaceId = body.workspace_id || null;
      daysBack = body.days_back || 30;
    } catch {
      // sem body, usa defaults
    }

    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysBack);

    let query = supabase
      .from("mkt_social_posts")
      .select("id, workspace_id, instagram_media_id, facebook_post_id, linkedin_post_urn, channels")
      .eq("status", "PUBLISHED")
      .gte("published_at", dateThreshold.toISOString());
    if (workspaceId) query = query.eq("workspace_id", workspaceId);

    const { data: posts, error: postsError } = await query;
    if (postsError) {
      return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No posts to analyze", processed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceIds = [...new Set(posts.map((p) => p.workspace_id))];
    const { data: connections } = await supabase
      .from("mkt_social_connections")
      .select("id, workspace_id, provider, account_id, access_token, token_expires_at, page_id")
      .in("workspace_id", workspaceIds)
      .eq("is_active", true);

    const connectionMap = new Map<string, SocialConnection>();
    for (const conn of connections || []) {
      connectionMap.set(`${conn.workspace_id}_${conn.provider}`, conn as SocialConnection);
    }

    // Token único do SocialBu — reutilizado para toda conexão gerida por ele
    // nesta execução, em vez de um access_token por conexão (que para essas
    // contas nunca existiu: é sempre o placeholder SOCIALBU_MANAGED_TOKEN).
    const needsSocialbuToken = (connections || []).some((c) => c.access_token === SOCIALBU_MANAGED_TOKEN);
    const socialbuToken = needsSocialbuToken ? await getSocialbuToken(supabase) : "";

    const results = {
      processed: 0, success: 0, failed: 0, skipped: 0,
      details: [] as { postId: string; channel: string; status: string; reason?: string }[],
    };

    const handleOutcome = async (postId: string, channel: string, outcome: FetchOutcome) => {
      if (outcome.status === "ok") {
        results.processed++;
        const saved = await upsertAnalytics(supabase, postId, channel, outcome.metrics);
        if (saved) {
          results.success++;
          results.details.push({ postId, channel, status: "success" });
        } else {
          results.failed++;
          results.details.push({ postId, channel, status: "upsert_failed" });
        }
      } else if (outcome.status === "not_yet_available") {
        results.skipped++;
        results.details.push({ postId, channel, status: "not_yet_available" });
      } else if (outcome.status === "publish_failed") {
        results.skipped++;
        results.details.push({ postId, channel, status: "publish_failed", reason: outcome.reason });
      } else {
        results.failed++;
        results.details.push({ postId, channel, status: "fetch_failed", reason: outcome.reason });
      }
    };

    for (const post of posts) {
      if (post.instagram_media_id) {
        const connection = connectionMap.get(`${post.workspace_id}_instagram`);
        if (!connection) {
          results.skipped++;
          results.details.push({ postId: post.id, channel: "instagram", status: "no_connection" });
        } else if (connection.access_token === SOCIALBU_MANAGED_TOKEN) {
          await handleOutcome(post.id, "instagram", await fetchSocialBuPostInsights(post.instagram_media_id, socialbuToken));
        } else if (!isTokenExpired(connection)) {
          await handleOutcome(post.id, "instagram", await fetchInstagramInsightsGraph(post.instagram_media_id, connection.access_token));
        } else {
          results.skipped++;
          results.details.push({ postId: post.id, channel: "instagram", status: "token_expired" });
        }
      }

      if (post.facebook_post_id) {
        const connection = connectionMap.get(`${post.workspace_id}_facebook`);
        if (!connection) {
          results.skipped++;
          results.details.push({ postId: post.id, channel: "facebook", status: "no_connection" });
        } else if (connection.access_token === SOCIALBU_MANAGED_TOKEN) {
          await handleOutcome(post.id, "facebook", await fetchSocialBuPostInsights(post.facebook_post_id, socialbuToken));
        } else if (!isTokenExpired(connection)) {
          await handleOutcome(post.id, "facebook", await fetchFacebookInsightsGraph(post.facebook_post_id, connection.access_token));
        } else {
          results.skipped++;
          results.details.push({ postId: post.id, channel: "facebook", status: "token_expired" });
        }
      }

      if (post.linkedin_post_urn) {
        const connection = connectionMap.get(`${post.workspace_id}_linkedin`);
        if (connection && !isTokenExpired(connection)) {
          await handleOutcome(post.id, "linkedin", await fetchLinkedInInsights(post.linkedin_post_urn, connection.access_token));
        } else {
          results.skipped++;
          results.details.push({ postId: post.id, channel: "linkedin", status: connection ? "token_expired" : "no_connection" });
        }
      }
    }

    console.log("Insights collection complete:", results);

    return new Response(JSON.stringify(results), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fetch-social-insights:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
