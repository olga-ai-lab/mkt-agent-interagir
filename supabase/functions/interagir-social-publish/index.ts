import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSocialbuToken } from "../_shared/socialbu.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    .trim();
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.substring(0, limit - 3) + "...";
}

const CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63000,
  linkedin: 3000,
  twitter: 280,
};

const SOCIALBU_MANAGED_TOKEN = "socialbu-managed";

class SocialBuReconnectRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialBuReconnectRequiredError";
  }
}

async function parseJsonSafe(res: Response, label: string): Promise<{ data: unknown; raw: string }> {
  const raw = await res.text();
  try {
    return { data: JSON.parse(raw), raw };
  } catch {
    const contentType = res.headers.get("content-type") || "unknown";
    console.error(`SocialBu ${label} returned non-JSON (HTTP ${res.status}, content-type: ${contentType})`);
    throw new SocialBuReconnectRequiredError(
      `SocialBu account may need to be reconnected - ${label} returned an unexpected HTML response (HTTP ${res.status}). Please reconnect the account and try again.`
    );
  }
}

async function publishViaSocialBu(
  accountId: string,
  content: string,
  mediaUrls: string[],
  socialbuToken: string,
  supabaseUrl: string,
  workspaceId: string,
  provider: string,
): Promise<string> {
  const existingAttachments: string[] = [];

  for (const imageUrl of mediaUrls.slice(0, 9)) {
    const uploadRes = await fetch("https://socialbu.com/api/v1/upload_media_by_url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${socialbuToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: imageUrl }),
    });
    const { data: uploadData } = await parseJsonSafe(uploadRes, `upload_media_by_url[${imageUrl}]`);
    if (uploadRes.ok && (uploadData as Record<string, unknown>)?.upload_token) {
      existingAttachments.push((uploadData as Record<string, unknown>).upload_token as string);
    }
  }

  const sbPostBody: Record<string, unknown> = {
    accounts: [parseInt(accountId, 10)],
    publish_at: new Date().toISOString().replace("T", " ").substring(0, 19),
    content,
    postback_url: `${supabaseUrl}/functions/v1/interagir-socialbu-postback?workspace_id=${encodeURIComponent(workspaceId)}&provider=${encodeURIComponent(provider)}`,
  };
  if (existingAttachments.length > 0) {
    sbPostBody.existing_attachments = existingAttachments.map((t) => ({ upload_token: t }));
  }

  const sbPostRes = await fetch("https://socialbu.com/api/v1/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${socialbuToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sbPostBody),
  });
  const { data: sbPostData } = await parseJsonSafe(sbPostRes, `POST /posts (account=${accountId})`);

  if (!sbPostRes.ok) {
    const errorMsg = (sbPostData as Record<string, unknown>)?.message as string || JSON.stringify(sbPostData);
    throw new Error(errorMsg);
  }

  return String((sbPostData as Record<string, unknown>)?.id || (sbPostData as Record<string, unknown>)?.post_id || "");
}

function getLinkedInApiVersion(): string {
  return "202601";
}

async function publishViaLinkedIn(
  conn: Record<string, unknown>,
  content: string,
  mediaUrls: string[],
): Promise<string> {
  const isOrg = !!conn.page_id;
  const author = isOrg
    ? String(conn.page_id)
    : `urn:li:person:${conn.account_id}`;

  const liHeaders = {
    Authorization: `Bearer ${conn.access_token}`,
    "LinkedIn-Version": getLinkedInApiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  let imageUrn: string | null = null;

  if (mediaUrls.length > 0) {
    try {
      const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
        method: "POST",
        headers: liHeaders,
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
      });
      const initData = await initRes.json();
      const uploadUrl: string | undefined = initData.value?.uploadUrl;
      imageUrn = initData.value?.image ?? null;

      if (uploadUrl && imageUrn) {
        const imgRes = await fetch(mediaUrls[0]);
        const imgBuffer = await imgRes.arrayBuffer();
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { Authorization: `Bearer ${conn.access_token}` },
          body: imgBuffer,
        });
        console.log(`LinkedIn image uploaded, urn=${imageUrn}`);
      } else {
        imageUrn = null;
      }
    } catch (imgErr) {
      console.warn("LinkedIn image upload error:", imgErr);
      imageUrn = null;
    }
  }

  const postBody: Record<string, unknown> = {
    author,
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imageUrn) {
    postBody.content = { media: { id: imageUrn } };
  }

  console.log(`LinkedIn POST /rest/posts -> author=${author}`);
  const postRes = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify(postBody),
  });

  if (!postRes.ok) {
    const errText = await postRes.text();
    console.error(`LinkedIn POST /rest/posts <- HTTP ${postRes.status}:`, errText.substring(0, 400));
    throw new Error(`LinkedIn API error ${postRes.status}: ${errText.substring(0, 200)}`);
  }

  const postId = postRes.headers.get("x-restli-id") || postRes.headers.get("x-linkedin-id") || "";
  console.log(`LinkedIn POST /rest/posts <- HTTP ${postRes.status}, id=${postId}`);
  return postId;
}

async function publishViaFacebook(
  conn: Record<string, unknown>,
  content: string,
  mediaUrls: string[],
): Promise<string> {
  const pageId = String(conn.page_id || conn.account_id);
  const accessToken = String(conn.access_token);

  if (mediaUrls.length > 0) {
    console.log(`Facebook POST /${pageId}/photos`);
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: mediaUrls[0], caption: content, access_token: accessToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Facebook API error ${res.status}`);
    console.log(`Facebook /${pageId}/photos <- HTTP ${res.status}, id=${data.id}`);
    return String(data.id || "");
  }

  console.log(`Facebook POST /${pageId}/feed`);
  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: content, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Facebook API error ${res.status}`);
  console.log(`Facebook /${pageId}/feed <- HTTP ${res.status}, id=${data.id}`);
  return String(data.id || "");
}

async function publishViaInstagram(
  conn: Record<string, unknown>,
  content: string,
  mediaUrls: string[],
): Promise<string> {
  if (mediaUrls.length === 0) {
    throw new Error("Instagram requer pelo menos uma imagem");
  }

  const igAccountId = String(conn.account_id);
  const accessToken = String(conn.access_token);

  console.log(`Instagram POST /${igAccountId}/media`);
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: mediaUrls[0], caption: content, access_token: accessToken }),
  });
  const containerData = await containerRes.json();

  if (!containerRes.ok || !containerData.id) {
    const msg = containerData.error?.message || `Instagram media container error ${containerRes.status}`;
    console.error(`Instagram /${igAccountId}/media <- HTTP ${containerRes.status}:`, containerData);
    throw new Error(msg);
  }
  console.log(`Instagram /${igAccountId}/media <- HTTP ${containerRes.status}, creation_id=${containerData.id}`);

  const maxPollAttempts = 15;
  for (let i = 0; i < maxPollAttempts; i++) {
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${containerData.id}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    const statusCode: string = statusData.status_code || "UNKNOWN";
    console.log(`Instagram container ${containerData.id} status=${statusCode} (attempt ${i + 1}/${maxPollAttempts})`);
    if (statusCode === "FINISHED") break;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new Error(`Instagram container processing failed: ${statusCode}`);
    }
    if (i < maxPollAttempts - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }
  }

  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerData.id, access_token: accessToken }),
  });
  const publishData = await publishRes.json();

  if (!publishRes.ok) {
    const msg = publishData.error?.message || `Instagram publish error ${publishRes.status}`;
    console.error(`Instagram /${igAccountId}/media_publish <- HTTP ${publishRes.status}:`, publishData);
    throw new Error(msg);
  }
  console.log(`Instagram /${igAccountId}/media_publish <- HTTP ${publishRes.status}, id=${publishData.id}`);
  return String(publishData.id || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { post_id, channels, workspace_id, connection_ids } = await req.json();

    if (!post_id || !workspace_id || (!channels?.length && !connection_ids?.length)) {
      return new Response(
        JSON.stringify({ error: "post_id, workspace_id, and channels or connection_ids are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const { data: post, error: postError } = await supabase
      .from("mkt_social_posts")
      .select("id, title, content, excerpt, media_urls")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, { success: boolean; error?: string; external_id?: string; account_name?: string }> = {};

    type PublishTask = { key: string; channel: string; conn: Record<string, any> | null };
    const tasks: PublishTask[] = [];

    if (connection_ids && (connection_ids as string[]).length > 0) {
      for (const connId of connection_ids as string[]) {
        const { data: conn } = await supabase
          .from("mkt_social_connections")
          .select("*")
          .eq("id", connId)
          .eq("is_active", true)
          .single();
        if (!conn) {
          results[connId] = { success: false, error: "Connection not found" };
        } else {
          tasks.push({ key: connId, channel: conn.provider, conn });
        }
      }
    } else {
      for (const channel of channels as string[]) {
        const { data: conn } = await supabase
          .from("mkt_social_connections")
          .select("*")
          .eq("workspace_id", workspace_id)
          .eq("provider", channel)
          .eq("is_active", true)
          .single();
        tasks.push({ key: channel, channel, conn: conn ?? null });
      }
    }

    // SocialBu token is needed for Twitter AND for any provider whose connection
    // is SocialBu-managed (access_token === "socialbu-managed").
    const needsSocialbu = tasks.some(
      ({ channel, conn }) =>
        channel === "twitter" || conn?.access_token === SOCIALBU_MANAGED_TOKEN,
    );
    const socialbuToken = needsSocialbu ? await getSocialbuToken() : "";

    for (const { key, channel, conn } of tasks) {
      if (!conn) {
        results[key] = { success: false, error: `No active ${channel} connection found` };
        continue;
      }

      // FIX: connections created via SocialBu OAuth have access_token = "socialbu-managed"
      // (a placeholder, NOT a real provider token). Previously, publishViaSocialBu was
      // only called for Twitter — Instagram/Facebook/LinkedIn paths used the placeholder
      // as a literal Bearer token against the provider APIs, which Facebook rejected
      // with "Invalid OAuth access token - Cannot parse access token".
      // Now any SocialBu-managed connection is routed through SocialBu's API.
      const isSocialBuManaged = conn.access_token === SOCIALBU_MANAGED_TOKEN;

      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        results[key] = { success: false, error: "Token expired. Please reconnect.", account_name: conn.account_name };
        await supabase
          .from("mkt_social_connections")
          .update({ is_active: false, last_error: "Token expired. Please reconnect." })
          .eq("id", conn.id);
        continue;
      }

      const cleanContent = stripMarkdown(post.content || "");
      const limit = CHAR_LIMITS[channel] || 3000;
      const mediaUrls: string[] = post.media_urls?.[0] ? (post.media_urls as string[]) : [];

      try {
        let externalId = "";

        if (isSocialBuManaged) {
          // Route any SocialBu-managed connection through SocialBu's publishing API.
          // For Instagram/Facebook/LinkedIn/Twitter we always need title+content for
          // LinkedIn but for others we just use cleanContent.
          const sbContent = channel === "linkedin"
            ? truncate(`${post.title}\n\n${cleanContent}`, limit)
            : truncate(cleanContent, limit);

          externalId = await publishViaSocialBu(
            conn.account_id,
            sbContent,
            mediaUrls,
            socialbuToken,
            supabaseUrl,
            workspace_id,
            channel,
          );

          if (externalId) {
            const columnByChannel: Record<string, string> = {
              linkedin: "linkedin_post_urn",
              facebook: "facebook_post_id",
              instagram: "instagram_media_id",
            };
            const col = columnByChannel[channel];
            if (col) {
              await supabase.from("mkt_social_posts").update({ [col]: externalId }).eq("id", post_id);
            }
          }
          await supabase.from("mkt_social_connections").update({ last_used_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
          results[key] = { success: true, external_id: externalId, account_name: conn.account_name };

        } else if (channel === "linkedin") {
          const liContent = truncate(`${post.title}\n\n${cleanContent}`, limit);
          externalId = await publishViaLinkedIn(conn, liContent, mediaUrls);
          if (externalId) {
            await supabase.from("mkt_social_posts").update({ linkedin_post_urn: externalId }).eq("id", post_id);
          }
          await supabase.from("mkt_social_connections").update({ last_used_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
          results[key] = { success: true, external_id: externalId, account_name: conn.account_name };

        } else if (channel === "facebook") {
          const fbContent = truncate(cleanContent, limit);
          externalId = await publishViaFacebook(conn, fbContent, mediaUrls);
          if (externalId) {
            await supabase.from("mkt_social_posts").update({ facebook_post_id: externalId }).eq("id", post_id);
          }
          await supabase.from("mkt_social_connections").update({ last_used_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
          results[key] = { success: true, external_id: externalId, account_name: conn.account_name };

        } else if (channel === "instagram") {
          const igContent = truncate(cleanContent, limit);
          externalId = await publishViaInstagram(conn, igContent, mediaUrls);
          await supabase.from("mkt_social_posts").update({ instagram_media_id: externalId }).eq("id", post_id);
          await supabase.from("mkt_social_connections").update({ last_used_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
          results[key] = { success: true, external_id: externalId, account_name: conn.account_name };

        } else if (channel === "twitter") {
          const twContent = truncate(cleanContent, limit);
          externalId = await publishViaSocialBu(
            conn.account_id,
            twContent,
            mediaUrls,
            socialbuToken,
            supabaseUrl,
            workspace_id,
            channel
          );
          await supabase.from("mkt_social_connections").update({ last_used_at: new Date().toISOString(), last_error: null }).eq("id", conn.id);
          results[key] = { success: true, external_id: externalId, account_name: conn.account_name };

        } else {
          results[key] = { success: false, error: `Unsupported channel: ${channel}` };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Error publishing to ${channel} (${key}): ${errorMsg}`);
        results[key] = { success: false, error: errorMsg, account_name: conn.account_name };
        const connectionUpdate: Record<string, unknown> = { last_error: errorMsg };
        if (channel === "instagram" && err instanceof SocialBuReconnectRequiredError) {
          connectionUpdate.is_active = false;
        }
        await supabase.from("mkt_social_connections").update(connectionUpdate).eq("id", conn.id);
      }
    }

    const anySuccess = Object.values(results).some((r) => r.success);

    return new Response(
      JSON.stringify({ success: anySuccess, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in mkt-social-publish:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
