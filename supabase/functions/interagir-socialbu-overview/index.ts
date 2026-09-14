// Painel "Analyze Overview" do SocialBu, reproduzido dentro do nosso Analytics.
//
// A API pública do SocialBu (/api/v1/...) não tem endpoint de analytics — só
// descobrimos isso depois de tentar vários caminhos plausíveis e todos darem
// 404. O painel real é servido por uma família de endpoints documentada sob a
// tag "Insights" no OpenAPI deles (https://socialbu.com/openapi.yaml),
// confirmada endpoint a endpoint contra o token de produção antes de escrever
// este código — nenhum campo abaixo é suposição.
//
// Diferença importante em relação a mkt-fetch-social-insights: aquela função
// busca métrica POR POST usando facebook_post_id/instagram_media_id do NOSSO
// banco (que hoje é sempre null). Esta aqui não depende disso — os endpoints
// /insights/* operam no nível da CONTA no SocialBu e enxergam o histórico real
// de posts sincronizado diretamente da rede social, independente do que o
// nosso mkt_social_posts tem gravado.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function fetchNewSocialbuToken(): Promise<string> {
  const email = Deno.env.get("SOCIALBU_EMAIL");
  const password = Deno.env.get("SOCIALBU_PASSWORD");
  if (!email || !password) {
    throw new Error("SOCIALBU_EMAIL/SOCIALBU_PASSWORD not configured for re-auth");
  }
  const authRes = await fetch("https://socialbu.com/api/v1/auth/get_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const authData = await authRes.json().catch(() => ({}));
  const newToken: string = authData.authToken || authData.token || "";
  if (!authRes.ok || !newToken) {
    const message = typeof authData.message === "string" ? authData.message : "Unexpected SocialBu auth response";
    throw new Error(`SocialBu re-auth failed: ${message}`);
  }
  console.log("SocialBu: token refreshed via credentials");
  return newToken;
}

// Antes desta correção, esta função só lia e VALIDAVA o token, sem nunca
// tentar renová-lo — diferente de mkt-social-publish, que já tinha essa
// lógica de re-auth via SOCIALBU_EMAIL/SOCIALBU_PASSWORD. Quando o token
// salvo expirou de verdade (confirmado: a própria API do SocialBu passou a
// responder 401 "Bearer token required" para esse token), o Analytics parava
// de carregar com "SocialBu token expired or missing" em vez de se
// autorrecuperar. Portado o mesmo mecanismo de renovação usado em
// mkt-social-publish (e no _shared/socialbu.ts do projeto content-crafter).
// deno-lint-ignore no-explicit-any
async function getSocialbuToken(supabase: any): Promise<string> {
  async function readStoredToken(): Promise<string> {
    for (const table of SOCIALBU_CONFIG_TABLES) {
      const { data, error } = await supabase.from(table).select("value").eq("key", SOCIALBU_CONFIG_KEY).maybeSingle();
      if (!error && data?.value) return data.value;
    }
    return "";
  }

  async function persistToken(token: string): Promise<void> {
    for (const table of SOCIALBU_CONFIG_TABLES) {
      const { error } = await supabase.from(table).upsert(
        { key: SOCIALBU_CONFIG_KEY, value: token, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (!error) return;
    }
    throw new Error("Unable to persist SocialBu token to any config table");
  }

  const storedToken = await readStoredToken();
  if (await isSocialbuTokenValid(storedToken)) return storedToken;

  const envToken = Deno.env.get("SOCIALBU_API_TOKEN") ?? "";
  if (envToken && envToken !== storedToken && (await isSocialbuTokenValid(envToken))) {
    await persistToken(envToken);
    return envToken;
  }

  const newToken = await fetchNewSocialbuToken();
  await persistToken(newToken);
  return newToken;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface SbAccount {
  id: number;
  name: string;
  _type: string;
}

interface SbInsightItem {
  type: string;
  value: number;
  label: string;
}

interface SbPost {
  id: number;
  content: string;
  account_id: number;
  account_type: string;
  type: string;
  permalink: string | null;
  published_at: string | null;
  insights: SbInsightItem[] | null;
  attachments?: { url: string }[];
}

// Tipos que contam como "engajamento", exatamente como documentado em
// /insights/accounts/engagement/rate — não é uma lista inventada.
const ENGAGEMENT_TYPES = new Set([
  "likes", "comments", "reactions", "shares", "replies", "retweets", "quote_tweets",
  "reblogs", "favourites", "total_interactions", "saved", "reposts", "quotes",
  "pin_clicks", "bookmarks",
]);

function sumEngagement(insights: SbInsightItem[] | null | undefined): number {
  if (!insights) return 0;
  return insights.filter((i) => ENGAGEMENT_TYPES.has(i.type)).reduce((sum, i) => sum + (i.value || 0), 0);
}

function insightValue(insights: SbInsightItem[] | null | undefined, type: string): number {
  return insights?.find((i) => i.type === type)?.value ?? 0;
}

async function sbGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://socialbu.com/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SocialBu ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function accountsQueryParam(accountIds: number[] | null): string {
  if (!accountIds || accountIds.length === 0) return "";
  return accountIds.map((id) => `&accounts[]=${id}`).join("");
}

const TOP_POSTS_METRICS = "likes,comments,reactions,shares,saved,reach,total_interactions,engagement_rate";

// /insights/accounts/engagement/trend IGNORA o parâmetro accounts[] — confirmado
// chamando a API real com e sem o filtro para a mesma conta: resposta idêntica
// nos dois casos (mesmo quando /insights/posts/counts, com o MESMO parâmetro,
// filtra corretamente). Por isso, quando há um filtro de rede ativo, não dá
// para usar esse endpoint: os engajamentos diários e o total são recalculados
// a partir dos posts já filtrados por conta via /insights/posts/top_posts
// (que respeita accounts[]). Limitação herdada: top_posts devolve no máximo
// os 10 posts de maior engajamento do período — o mesmo cap do "Top Posts
// (10)" do próprio painel do SocialBu — então, para uma rede com mais de 10
// posts publicados no período, o total de engajamento filtrado por rede pode
// ficar subestimado (não há endpoint documentado que evite essa limitação).
async function fetchPeriodStats(token: string, start: string, end: string, accountIds: number[] | null) {
  const accountsQs = accountsQueryParam(accountIds);
  const countsRes = await sbGet(`/insights/posts/counts?start=${start}&end=${end}${accountsQs}`, token);
  // deno-lint-ignore no-explicit-any
  const counts = ((countsRes as any)?.data ?? []) as { date: string; count: number }[];
  const byDate = new Map<string, { date: string; posts: number; engagements: number }>();
  for (const c of counts) byDate.set(c.date, { date: c.date, posts: c.count, engagements: 0 });

  let totalEngagements = 0;
  if (accountIds) {
    const postsRes = await sbGet(
      `/insights/posts/top_posts?start=${start}&end=${end}&metrics=${encodeURIComponent(TOP_POSTS_METRICS)}${accountsQs}`,
      token,
    );
    // deno-lint-ignore no-explicit-any
    const posts = (((postsRes as any)?.data ?? []) as SbPost[]);
    for (const p of posts) {
      const eng = sumEngagement(p.insights);
      totalEngagements += eng;
      const date = (p.published_at || "").slice(0, 10);
      if (!date) continue;
      const row = byDate.get(date) ?? { date, posts: 0, engagements: 0 };
      row.engagements += eng;
      byDate.set(date, row);
    }
  } else {
    const trendRes = await sbGet(`/insights/accounts/engagement/trend?start=${start}&end=${end}`, token);
    // deno-lint-ignore no-explicit-any
    const trend = ((trendRes as any)?.data ?? []) as { date: string; engagements: number }[];
    for (const t of trend) {
      const row = byDate.get(t.date) ?? { date: t.date, posts: 0, engagements: 0 };
      row.engagements = t.engagements;
      byDate.set(t.date, row);
    }
    totalEngagements = trend.reduce((s, t) => s + t.engagements, 0);
  }

  const daily = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totalPosts = daily.reduce((s, d) => s + d.posts, 0);
  return { daily, totalPosts, totalEngagements };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    let daysBack = 30;
    let network: string | null = null;
    try {
      const body = await req.json();
      daysBack = Number(body?.days_back) || 30;
      network = typeof body?.network === "string" && body.network ? body.network : null;
    } catch {
      // sem body, usa default
    }

    const token = await getSocialbuToken(supabase);

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - daysBack + 1);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - daysBack + 1);

    const accountsRaw = await sbGet(`/accounts?per_page=100`, token);
    const allAccounts = (accountsRaw as SbAccount[]) || [];
    // account._type vem do SocialBu como "Instagram Business", "Facebook Page",
    // "LinkedIn Profile"/"LinkedIn Organization" etc — o filtro de rede da UI
    // (channelFilter: "instagram"/"facebook"/"linkedin") casa por substring.
    const accounts = network
      ? allAccounts.filter((a) => a._type?.toLowerCase().includes(network!.toLowerCase()))
      : allAccounts;
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    const accountIds = network ? accounts.map((a) => a.id) : null;

    const [current, previous, followersRaw, topPostsRaw] = await Promise.all([
      fetchPeriodStats(token, fmtDate(start), fmtDate(end), accountIds),
      fetchPeriodStats(token, fmtDate(prevStart), fmtDate(prevEnd), accountIds),
      sbGet(`/insights/accounts/followers`, token),
      // Pede um conjunto amplo de métricas conhecidas (união do que cada rede
      // suporta, por isso é seguro pedir tudo — a API ignora o que não existe
      // pra aquela rede) para não perder o topo do ranking por falta de campo.
      // A API já limita a resposta aos 10 posts de maior engajamento do
      // período (mesmo "Top Posts (10)" exibido no painel do SocialBu).
      sbGet(
        `/insights/posts/top_posts?start=${fmtDate(start)}&end=${fmtDate(end)}&metrics=${encodeURIComponent(TOP_POSTS_METRICS)}${accountsQueryParam(accountIds)}`,
        token,
      ),
    ]);

    // /insights/accounts/followers não filtra por conta na API — quando há um
    // filtro de rede ativo, somamos apenas as contas daquela rede a partir de
    // followers_by_account em vez de usar o total_followers agregado.
    // deno-lint-ignore no-explicit-any
    const followersData = (followersRaw as any)?.data;
    const audience = network
      ? (followersData?.followers_by_account ?? [])
          // deno-lint-ignore no-explicit-any
          .filter((f: any) => accountById.has(f.account_id))
          // deno-lint-ignore no-explicit-any
          .reduce((sum: number, f: any) => sum + (f.followers || 0), 0)
      : followersData?.total_followers ?? null;
    // deno-lint-ignore no-explicit-any
    const posts = (((topPostsRaw as any)?.data ?? []) as SbPost[]).filter(
      (p) => !network || accountById.has(p.account_id),
    );

    // Top post: maior engajamento absoluto (soma dos tipos de ENGAGEMENT_TYPES).
    const topPost = posts.length
      ? posts.reduce((best, p) => (sumEngagement(p.insights) > sumEngagement(best.insights) ? p : best))
      : null;

    // Top network / top account: agrupa os posts do período por rede e por
    // conta, somando o engajamento de cada post.
    const byNetwork = new Map<string, number>();
    const byAccount = new Map<number, number>();
    for (const p of posts) {
      const eng = sumEngagement(p.insights);
      byNetwork.set(p.account_type, (byNetwork.get(p.account_type) || 0) + eng);
      byAccount.set(p.account_id, (byAccount.get(p.account_id) || 0) + eng);
    }
    const topNetworkEntry = [...byNetwork.entries()].sort((a, b) => b[1] - a[1])[0];
    const topAccountEntry = [...byAccount.entries()].sort((a, b) => b[1] - a[1])[0];

    // Publishing Behavior: mesma quebra por formato (image/text/video) exibida
    // no painel "Content" do SocialBu, calculada sobre os mesmos posts já
    // buscados acima (sujeita ao mesmo cap de 10 posts do top_posts).
    const byFormat = new Map<string, { posts: number; engagements: number }>();
    for (const p of posts) {
      const fmt = p.type || "other";
      const row = byFormat.get(fmt) ?? { posts: 0, engagements: 0 };
      row.posts += 1;
      row.engagements += sumEngagement(p.insights);
      byFormat.set(fmt, row);
    }
    const publishingBehavior = [...byFormat.entries()]
      .map(([format, v]) => ({ format, posts: v.posts, engagements: v.engagements, engagementsPerPost: v.posts > 0 ? v.engagements / v.posts : 0 }))
      .sort((a, b) => b.posts - a.posts);

    const topPosts = [...posts]
      .sort((a, b) => sumEngagement(b.insights) - sumEngagement(a.insights))
      .map((p) => ({
        id: p.id,
        content: p.content,
        permalink: p.permalink,
        account_name: accountById.get(p.account_id)?.name ?? null,
        account_type: p.account_type,
        thumbnail: p.attachments?.[0]?.url ?? null,
        published_at: p.published_at,
        engagement_rate: insightValue(p.insights, "engagement_rate"),
        reach: insightValue(p.insights, "reach"),
        likes: insightValue(p.insights, "likes"),
        comments: insightValue(p.insights, "comments"),
        engagements: sumEngagement(p.insights),
      }));

    const result = {
      period: { start: fmtDate(start), end: fmtDate(end), days: daysBack },
      totals: {
        posts: current.totalPosts,
        engagements: current.totalEngagements,
        engagementPerPost: current.totalPosts > 0 ? current.totalEngagements / current.totalPosts : 0,
        audience,
      },
      previous: {
        posts: previous.totalPosts,
        engagements: previous.totalEngagements,
        engagementPerPost: previous.totalPosts > 0 ? previous.totalEngagements / previous.totalPosts : 0,
      },
      daily: current.daily,
      topPost: topPost
        ? {
            id: topPost.id,
            content: topPost.content,
            permalink: topPost.permalink,
            account_name: accountById.get(topPost.account_id)?.name ?? null,
            account_type: topPost.account_type,
            thumbnail: topPost.attachments?.[0]?.url ?? null,
            published_at: topPost.published_at,
            engagement_rate: insightValue(topPost.insights, "engagement_rate"),
            reach: insightValue(topPost.insights, "reach"),
            likes: insightValue(topPost.insights, "likes"),
            comments: insightValue(topPost.insights, "comments"),
          }
        : null,
      topNetwork: topNetworkEntry ? { network: topNetworkEntry[0], engagements: topNetworkEntry[1] } : null,
      topAccount: topAccountEntry
        ? { account_id: topAccountEntry[0], name: accountById.get(topAccountEntry[0])?.name ?? null, engagements: topAccountEntry[1] }
        : null,
      topPosts,
      publishingBehavior,
      // "Conta que mais cresceu" (fastest growing account) do painel do
      // SocialBu NÃO é reproduzível com a API documentada: /insights/accounts/
      // followers/growth só devolve o crescimento total agregado, sem quebra
      // por conta. Omitido de propósito em vez de inventar um número.
    };

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in mkt-socialbu-overview:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
