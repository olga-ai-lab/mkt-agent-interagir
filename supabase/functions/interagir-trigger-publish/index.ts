import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Webhooks padrão do n8n (fallback)
const DEFAULT_WEBHOOKS: Record<string, string> = {
  instagram: "",
  linkedin: "",
};

interface PublishRequest {
  post_id: string;
  channels: ("instagram" | "linkedin" | "facebook" | "blog")[];
  connection_ids?: string[];
  scheduled_at?: string;
}

interface WebhookPayload {
  post_id: string;
  title: string;
  content: string;
  media_urls: string[];
  channel: string;
  scheduled_at?: string;
  workspace_name?: string;
}

interface IntegrationConfig {
  webhook_url?: string;
}

interface SocialConnection {
  id: string;
  provider: string;
  account_id: string;
  access_token: string;
  token_expires_at: string | null;
  page_id: string | null;
}

// ============ LINKEDIN DIRECT PUBLISHING ============

async function publishDirectToLinkedIn(
  connection: SocialConnection,
  post: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const accessToken = connection.access_token;
  const personId = connection.account_id;
  const author = `urn:li:person:${personId}`;
  
  const text = post.content || post.excerpt || "";
  const mediaUrls: string[] = post.media_urls || [];
  
  console.log(`Publishing to LinkedIn as ${author}...`);
  
  try {
    let shareContent: any;
    
    if (mediaUrls.length > 0) {
      // Upload image and create share with media
      const imageUrl = mediaUrls[0];
      
      // Step 1: Register upload
      const registerResponse = await fetch(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
              owner: author,
              serviceRelationships: [
                {
                  relationshipType: "OWNER",
                  identifier: "urn:li:userGeneratedContent",
                },
              ],
            },
          }),
        }
      );
      
      if (!registerResponse.ok) {
        const errorText = await registerResponse.text();
        console.error("LinkedIn register upload error:", errorText);
        throw new Error(`Failed to register upload: ${errorText}`);
      }
      
      const registerData = await registerResponse.json();
      const uploadUrl = registerData.value?.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;
      const asset = registerData.value?.asset;
      
      if (!uploadUrl || !asset) {
        throw new Error("Failed to get upload URL from LinkedIn");
      }
      
      // Step 2: Download image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageUrl}`);
      }
      const imageBlob = await imageResponse.blob();
      const imageBuffer = await imageBlob.arrayBuffer();
      
      // Step 3: Upload image to LinkedIn
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
        },
        body: imageBuffer,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("LinkedIn image upload error:", errorText);
        throw new Error(`Failed to upload image: ${errorText}`);
      }
      
      console.log("Image uploaded successfully, asset:", asset);
      
      // Create share with media
      shareContent = {
        shareCommentary: {
          text: text,
        },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            description: {
              text: post.title || "",
            },
            media: asset,
            title: {
              text: post.title || "",
            },
          },
        ],
      };
    } else {
      // Text-only share
      shareContent = {
        shareCommentary: {
          text: text,
        },
        shareMediaCategory: "NONE",
      };
    }
    
    // Create the UGC post
    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": shareContent,
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });
    
    if (!postResponse.ok) {
      const errorText = await postResponse.text();
      console.error("LinkedIn post error:", errorText);
      throw new Error(`Failed to create post: ${errorText}`);
    }
    
    const postData = await postResponse.json();
    const postId = postData.id;
    
    console.log("LinkedIn post created successfully:", postId);
    
    return { success: true, postId };
  } catch (error) {
    console.error("LinkedIn direct publish error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// ============ INSTAGRAM DIRECT PUBLISHING ============

async function publishDirectToInstagram(
  connection: SocialConnection,
  post: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const accessToken = connection.access_token;
  const igAccountId = connection.account_id;
  
  const caption = post.content || post.excerpt || "";
  const mediaUrls: string[] = post.media_urls || [];
  
  if (mediaUrls.length === 0) {
    return { success: false, error: "Instagram requires at least one image" };
  }
  
  console.log(`Publishing to Instagram account ${igAccountId}...`);
  
  try {
    let containerId: string;
    
    if (mediaUrls.length === 1) {
      // Single image post
      const containerResponse = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: mediaUrls[0],
            caption: caption,
            access_token: accessToken,
          }),
        }
      );
      
      if (!containerResponse.ok) {
        const errorText = await containerResponse.text();
        throw new Error(`Failed to create media container: ${errorText}`);
      }
      
      const containerData = await containerResponse.json();
      containerId = containerData.id;
    } else {
      // Carousel post
      const childIds: string[] = [];
      
      for (const url of mediaUrls) {
        const childResponse = await fetch(
          `https://graph.facebook.com/v18.0/${igAccountId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: url,
              is_carousel_item: true,
              access_token: accessToken,
            }),
          }
        );
        
        if (!childResponse.ok) {
          const errorText = await childResponse.text();
          throw new Error(`Failed to create carousel item: ${errorText}`);
        }
        
        const childData = await childResponse.json();
        childIds.push(childData.id);
      }
      
      const carouselResponse = await fetch(
        `https://graph.facebook.com/v18.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            caption: caption,
            children: childIds.join(","),
            access_token: accessToken,
          }),
        }
      );
      
      if (!carouselResponse.ok) {
        const errorText = await carouselResponse.text();
        throw new Error(`Failed to create carousel: ${errorText}`);
      }
      
      const carouselData = await carouselResponse.json();
      containerId = carouselData.id;
    }
    
    // Wait for container to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Publish the container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );
    
    if (!publishResponse.ok) {
      const errorText = await publishResponse.text();
      throw new Error(`Failed to publish: ${errorText}`);
    }
    
    const publishData = await publishResponse.json();
    console.log("Instagram post published:", publishData.id);
    
    return { success: true, postId: publishData.id };
  } catch (error) {
    console.error("Instagram direct publish error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// ============ FACEBOOK DIRECT PUBLISHING ============

async function publishDirectToFacebook(
  connection: SocialConnection,
  post: any
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const accessToken = connection.access_token;
  const pageId = connection.page_id || connection.account_id;
  
  const message = post.content || post.excerpt || "";
  const mediaUrls: string[] = post.media_urls || [];
  
  console.log(`Publishing to Facebook page ${pageId}...`);
  
  try {
    let response: Response;
    
    if (mediaUrls.length === 0) {
      // Text-only post
      response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message,
            access_token: accessToken,
          }),
        }
      );
    } else if (mediaUrls.length === 1) {
      // Single photo post
      response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: mediaUrls[0],
            caption: message,
            access_token: accessToken,
          }),
        }
      );
    } else {
      // Multiple photos - upload each then create post
      const photoIds: string[] = [];
      
      for (const url of mediaUrls) {
        const uploadResponse = await fetch(
          `https://graph.facebook.com/v18.0/${pageId}/photos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: url,
              published: false,
              access_token: accessToken,
            }),
          }
        );
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          throw new Error(`Failed to upload photo: ${errorText}`);
        }
        
        const uploadData = await uploadResponse.json();
        photoIds.push(uploadData.id);
      }
      
      // Create post with attached photos
      const attachedMedia = photoIds.map((id) => ({ media_fbid: id }));
      
      response = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message,
            attached_media: attachedMedia,
            access_token: accessToken,
          }),
        }
      );
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to publish: ${errorText}`);
    }
    
    const data = await response.json();
    console.log("Facebook post published:", data.id || data.post_id);
    
    return { success: true, postId: data.id || data.post_id };
  } catch (error) {
    console.error("Facebook direct publish error:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

// ============ HELPER FUNCTIONS ============

function isTokenExpired(connection: SocialConnection): boolean {
  if (!connection.token_expires_at) return false;
  const expiresAt = new Date(connection.token_expires_at);
  return expiresAt < new Date();
}

async function getActiveConnection(
  supabase: any,
  workspaceId: string,
  provider: string
): Promise<SocialConnection | null> {
  const { data, error } = await supabase
    .from("mkt_social_connections")
    .select("id, provider, account_id, access_token, token_expires_at, page_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1)
    .single();
  
  if (error || !data) {
    console.log(`No active connection found for ${provider}`);
    return null;
  }
  
  return data as SocialConnection;
}

async function updateConnectionStatus(
  supabase: any,
  connectionId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const update: any = {
    last_used_at: new Date().toISOString(),
  };
  
  if (success) {
    update.last_error = null;
  } else if (error) {
    update.last_error = error;
  }
  
  await supabase
    .from("mkt_social_connections")
    .update(update)
    .eq("id", connectionId);
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Verify the JWT using anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, { db: { schema: 'interagir' }, 
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await anonClient.auth.getUser();

    if (userError || !user) {
      console.error("JWT validation failed:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);
    
    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    const { post_id, channels: rawChannels, connection_ids, scheduled_at }: PublishRequest = await req.json();
    const channels = (rawChannels || []) as ("instagram" | "linkedin" | "facebook" | "blog")[];

    if (!post_id || (!channels.length && !connection_ids?.length)) {
      return new Response(
        JSON.stringify({ error: "post_id and channels are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch post data
    const { data: post, error: postError } = await supabase
      .from("mkt_social_posts")
      .select(`
        id,
        title,
        content,
        excerpt,
        media_urls,
        scheduled_at,
        status,
        workspace_id,
        company,
        tags,
        seo_description,
        seo_keywords,
        mkt_workspaces (
          name
        )
      `)
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      console.error("Error fetching post:", postError);
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch integrations for dynamic webhooks
    const { data: integrations } = await supabase
      .from("mkt_integrations")
      .select("type, config, is_active")
      .eq("workspace_id", post.workspace_id)
      .eq("is_active", true);

    // Build webhook URLs map from integrations or use defaults
    const webhookUrls: Record<string, string> = { ...DEFAULT_WEBHOOKS };
    
    if (integrations) {
      for (const integration of integrations) {
        const config = integration.config as IntegrationConfig;
        if (config?.webhook_url) {
          // Map integration type to channel
          const channelMap: Record<string, string> = {
            n8n: "instagram", // Generic n8n can be used for any
            instagram: "instagram",
            linkedin: "linkedin",
          };
          const channel = channelMap[integration.type];
          if (channel) {
            webhookUrls[channel] = config.webhook_url;
          }
        }
      }
    }

    console.log("Available webhook URLs:", webhookUrls);

    const results: Record<string, { success: boolean; postId?: string; error?: string; method?: string }> = {};

    // Fetch connections by ID and build provider map + effective channels
    const connectionMap: Record<string, SocialConnection> = {};
    let effectiveChannels = [...channels] as ("instagram" | "linkedin" | "facebook" | "blog")[];

    if (connection_ids?.length) {
      const { data: connRows } = await supabase
        .from("mkt_social_connections")
        .select("id, provider, account_id, access_token, token_expires_at, page_id")
        .in("id", connection_ids)
        .eq("is_active", true);

      if (connRows) {
        for (const conn of connRows as SocialConnection[]) {
          connectionMap[conn.provider] = conn;
          if (!effectiveChannels.includes(conn.provider as any)) {
            effectiveChannels.push(conn.provider as any);
          }
        }
      }
    }

    // Se tem agendamento, NÃO disparar webhooks agora
    if (scheduled_at) {
      console.log(`Post scheduled for ${scheduled_at}. Will be triggered later.`);
      
      for (const channel of effectiveChannels) {
        results[channel] = { success: true };
      }

      const { error: updateError } = await supabase
        .from("mkt_social_posts")
        .update({
          status: "SCHEDULED",
          channels: effectiveChannels,
          scheduled_at: scheduled_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Error updating post:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to schedule post" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Log activity
      await supabase.from("mkt_activity_log").insert({
        workspace_id: post.workspace_id,
        user_id: user.id,
        action: "scheduled",
        entity_type: "post",
        entity_id: post_id,
        entity_title: post.title,
        details: { scheduled_at, channels: effectiveChannels },
      });

      return new Response(
        JSON.stringify({
          success: true,
          results,
          status: "SCHEDULED",
          scheduled_at: scheduled_at,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // ============ PUBLICAÇÃO IMEDIATA ============
    console.log("Publishing immediately to channels:", effectiveChannels);

    for (const channel of effectiveChannels) {
      // Social channels - try direct first, fallback to webhook
      if (channel === "instagram" || channel === "linkedin" || channel === "facebook") {

        // ===== ZAPIER WEBHOOK (LinkedIn Company Page) =====
        if (channel === "linkedin") {
          const { data: zapierConn } = await supabase
            .from("mkt_social_connections")
            .select("zapier_webhook_url, zapier_channel")
            .eq("workspace_id", post.workspace_id)
            .eq("provider", "linkedin")
            .eq("is_active", true)
            .single();

          if (zapierConn?.zapier_webhook_url) {
            console.log("Publishing LinkedIn via Zapier webhook");
            const zapierPayload = {
              content: `${post.title}\n\n${post.content || ""}`,
              media_url: post.media_urls?.[0] || null,
              post_id: post.id,
              workspace_id: post.workspace_id,
            };

            try {
              const zapierRes = await fetch(zapierConn.zapier_webhook_url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(zapierPayload),
              });

              if (zapierRes.ok) {
                results["linkedin"] = { success: true, method: "zapier" };
                console.log("LinkedIn Zapier webhook succeeded");
              } else {
                const errText = await zapierRes.text();
                results["linkedin"] = { success: false, error: errText, method: "zapier" };
                console.error("LinkedIn Zapier webhook failed:", errText);
              }
            } catch (zapierError) {
              const errMsg = zapierError instanceof Error ? zapierError.message : "Unknown error";
              results["linkedin"] = { success: false, error: errMsg, method: "zapier" };
              console.error("LinkedIn Zapier webhook error:", zapierError);
            }
            continue;
          }
        }

        // Try to get active connection - prefer explicit connection from connection_ids
        const connection = connectionMap[channel] ?? await getActiveConnection(supabase, post.workspace_id, channel);

        // ===== SOCIALBU-MANAGED CONNECTION =====
        const isSocialBuManaged = connection?.access_token === "socialbu-managed";

        if (isSocialBuManaged) {
          const { data: publishResult } = await supabase.functions.invoke("interagir-social-publish", {
            body: {
              post_id: post_id,
              workspace_id: post.workspace_id,
              connection_ids: [connection.id],
              channels: [channel],
              scheduled_at: scheduled_at || null,
            },
            headers: { Authorization: authHeader },
          });

          if (publishResult?.success) {
            results[channel] = {
              success: true,
              postId: publishResult.results?.[channel]?.external_id,
              method: "socialbu",
            };
            console.log(`${channel} published via SocialBu`);
          } else {
            results[channel] = {
              success: false,
              error: publishResult?.error || "SocialBu publish failed",
              method: "socialbu",
            };
            console.error(`SocialBu publish failed for ${channel}:`, publishResult?.error);
          }
          continue;
        }

        if (connection && !isTokenExpired(connection)) {
          // ===== DIRECT API PUBLISHING =====
          console.log(`Using direct API for ${channel}`);
          
          let publishResult: { success: boolean; postId?: string; error?: string };
          
          if (channel === "linkedin") {
            publishResult = await publishDirectToLinkedIn(connection, post);
          } else if (channel === "instagram") {
            publishResult = await publishDirectToInstagram(connection, post);
          } else if (channel === "facebook") {
            publishResult = await publishDirectToFacebook(connection, post);
          } else {
            publishResult = { success: false, error: "Unknown channel" };
          }
          
          // Update connection status
          await updateConnectionStatus(supabase, connection.id, publishResult.success, publishResult.error);
          
          if (publishResult.success) {
            results[channel] = { 
              success: true, 
              postId: publishResult.postId,
              method: "direct_api" 
            };
            
            // Update post with platform-specific ID
            if (channel === "linkedin" && publishResult.postId) {
              await supabase
                .from("mkt_social_posts")
                .update({ linkedin_post_urn: publishResult.postId })
                .eq("id", post_id);
            } else if (channel === "instagram" && publishResult.postId) {
              await supabase
                .from("mkt_social_posts")
                .update({ instagram_media_id: publishResult.postId })
                .eq("id", post_id);
            } else if (channel === "facebook" && publishResult.postId) {
              await supabase
                .from("mkt_social_posts")
                .update({ facebook_post_id: publishResult.postId })
                .eq("id", post_id);
            }
            
            console.log(`${channel} published successfully via direct API`);
            continue;
          } else {
            console.warn(`Direct API failed for ${channel}, trying webhook fallback: ${publishResult.error}`);
          }
        } else {
          console.log(`No valid connection for ${channel}, using webhook`);
        }
        
        // ===== FALLBACK: WEBHOOK N8N =====
        const webhookUrl = webhookUrls[channel];
        if (!webhookUrl) {
          results[channel] = {
            success: false,
            error: `Webhook fallback desativado para canal ${channel}`,
            method: "webhook",
          };
          console.log(`Webhook fallback desativado para canal ${channel}`);
          continue;
        }

        try {
          const payload: WebhookPayload = {
            post_id: post.id,
            title: post.title,
            content: post.content || "",
            media_urls: post.media_urls || [],
            channel,
            workspace_name: (post.workspaces as any)?.name,
          };

          console.log(`Triggering webhook for ${channel}:`, webhookUrl);

          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            results[channel] = { success: true, method: "webhook" };
            console.log(`Webhook for ${channel} succeeded`);
          } else {
            const errorText = await response.text();
            results[channel] = { success: false, error: errorText, method: "webhook" };
            console.error(`Webhook for ${channel} failed:`, errorText);
          }
        } catch (webhookError) {
          console.error(`Error calling webhook for ${channel}:`, webhookError);
          results[channel] = { 
            success: false, 
            error: webhookError instanceof Error ? webhookError.message : "Unknown error",
            method: "webhook"
          };
        }
      } else if (channel === "blog") {
        // Blog publishing
        try {
          const { error: articleError } = await supabase
            .from("mkt_articles")
            .insert({
              title: post.title,
              content: post.content || "",
              excerpt: post.excerpt || "",
              slug: post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
              cover_image_url: post.media_urls?.[0] || null,
              status: "published",
              published_at: new Date().toISOString(),
              brand: post.company || "livonius",
              tags: post.tags || [],
              meta_description: post.seo_description || post.excerpt || "",
              keywords: post.seo_keywords || [],
            });

          if (articleError) {
            console.error("Error creating article:", articleError);
            results[channel] = { success: false, error: articleError.message };
          } else {
            results[channel] = { success: true, method: "database" };
            console.log("Blog article created successfully");
          }
        } catch (blogError) {
          console.error("Error publishing to blog:", blogError);
          results[channel] = { 
            success: false, 
            error: blogError instanceof Error ? blogError.message : "Unknown error" 
          };
        }
      }
    }

    const anySuccess = Object.values(results).some((r) => r.success);

    // Only mark as PUBLISHED if at least one channel succeeded. Previously the
    // status was set unconditionally — posts that failed on every channel still
    // showed as "Publicado" in the UI even though nothing was actually published.
    if (anySuccess) {
      const { error: updateError } = await supabase
        .from("mkt_social_posts")
        .update({
          status: "PUBLISHED",
          channels: effectiveChannels,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Error updating post:", updateError);
      }
    } else {
      // Keep the channels selection persisted so the next retry uses the same
      // targets, but leave status/published_at untouched so the post stays in
      // its previous review state instead of being misreported as PUBLISHED.
      const { error: updateError } = await supabase
        .from("mkt_social_posts")
        .update({
          channels: effectiveChannels,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post_id);

      if (updateError) {
        console.error("Error updating post:", updateError);
      }
    }

    await supabase.from("mkt_activity_log").insert({
      workspace_id: post.workspace_id,
      user_id: user.id,
      action: anySuccess ? "published" : "publish_failed",
      entity_type: "post",
      entity_id: post_id,
      entity_title: post.title,
      details: { channels: effectiveChannels, results },
    });

    return new Response(
      JSON.stringify({
        success: anySuccess,
        results,
        status: anySuccess ? "PUBLISHED" : "PUBLISH_FAILED",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in trigger-publish:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
