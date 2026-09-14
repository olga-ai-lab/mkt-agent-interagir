import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-n8n-secret",
};

type NormalizedChannel = "instagram" | "facebook" | "linkedin" | "blog";

interface N8nUploadPayload {
  file_url?: string;
  file_urls?: string[];
  base_file_url?: string;
  base_file_urls?: string[];
  raw_file_url?: string;
  raw_file_urls?: string[];
  title: string;
  content?: string;
  excerpt?: string;
  workspace_id?: string;
  company?: string;
  tags?: string[];
  dry_run?: boolean;
  generation_id?: string;
  origem?: string;
  pauta_id?: number | string | null;
  channels?: string[] | string;
  canais?: string[] | string;
  observacoes?: string;
  link_referencia?: string;
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function normalizePautaId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.trunc(parsed);
}

function normalizeChannels(input: unknown): NormalizedChannel[] {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const mapChannel = (value: string): NormalizedChannel | null => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    if (["instagram", "insta", "ig"].includes(normalized)) return "instagram";
    if (["facebook", "fb"].includes(normalized)) return "facebook";
    if (normalized === "linkedin") return "linkedin";
    if (["blog", "site", "artigo"].includes(normalized)) return "blog";
    return null;
  };

  const seen = new Set<NormalizedChannel>();
  const channels: NormalizedChannel[] = [];

  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") continue;
    const mapped = mapChannel(rawValue);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    channels.push(mapped);
  }

  return channels;
}

function hasNewsletterChannel(input: unknown): boolean {
  const rawValues = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  return rawValues.some((value) => {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "newsletter" ||
      normalized.includes("newsletter") ||
      normalized.includes("news") ||
      normalized.includes("email") ||
      normalized.includes("informe") ||
      normalized.includes("circular")
    );
  });
}

function buildNewsletterDraftHtml(payload: N8nUploadPayload, imageUrl: string): string {
  const safeTitle = payload.title || "Informe";
  const safeExcerpt = payload.excerpt || "";
  const safeContent = payload.content || "";
  const observacoes = payload.observacoes || "";
  const linkReferencia = payload.link_referencia || "";

  return `
<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
  <h1 style="font-size: 28px; margin: 0 0 12px;">${safeTitle}</h1>
  ${safeExcerpt ? `<p style="font-size: 16px; color: #4b5563; margin: 0 0 16px;">${safeExcerpt}</p>` : ""}
  ${imageUrl ? `<img src="${imageUrl}" alt="${safeTitle}" style="width: 100%; border-radius: 8px; margin: 0 0 18px;" />` : ""}
  ${safeContent ? `<div style="white-space: pre-line; font-size: 15px; line-height: 1.6;">${safeContent}</div>` : ""}
  ${observacoes ? `<p style="margin-top: 18px; font-size: 14px; color: #6b7280;"><strong>Observações:</strong> ${observacoes}</p>` : ""}
  ${linkReferencia ? `<p style="margin-top: 10px; font-size: 14px;"><a href="${linkReferencia}" target="_blank" rel="noopener noreferrer">Link de referência</a></p>` : ""}
</div>`.trim();
}

function normalizeCompany(company?: string | null): "livo" | "livonius" {
  const normalized = (company || "").trim().toLowerCase();
  if (normalized === "livo") return "livo";
  if (normalized === "livonius") return "livonius";
  return "livonius";
}

async function generateContentTags(title: string, content: string): Promise<string[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    console.log("LOVABLE_API_KEY not configured, skipping AI tag generation");
    return [];
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Voce e um especialista em categorizacao de conteudo de marketing e seguros.
Gere de 3 a 5 tags descritivas em portugues para o conteudo fornecido.
Regras:
- Tags curtas (1-3 palavras cada)
- Sem hashtags ou simbolos especiais
- Relevantes ao tema/assunto do post
- Foco em seguros, gestao, marketing ou o tema especifico do conteudo
- Responda APENAS com as tags separadas por virgula, sem explicacoes`,
          },
          {
            role: "user",
            content: `Titulo: ${title}\n\nConteudo: ${(content || "").substring(0, 500)}`,
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status);
      return [];
    }

    const data = await response.json();
    const tagsText = data.choices?.[0]?.message?.content || "";

    const tags = tagsText
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0 && t.length < 30);

    console.log("AI generated tags:", tags);
    return tags;
  } catch (error) {
    console.error("Error generating tags with AI:", error);
    return [];
  }
}

serve(async (req) => {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[${requestId}] Incoming request: ${req.method} ${req.url}`);

  if (req.method === "OPTIONS") {
    console.log(`[${requestId}] CORS preflight - responding OK`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type");
    const hasN8nSecret = !!req.headers.get("x-n8n-secret");
    console.log(`[${requestId}] Headers - Content-Type: ${contentType}, Has-N8n-Secret: ${hasN8nSecret}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'interagir' } });

    let payload: N8nUploadPayload;
    try {
      payload = await req.json();
    } catch (parseError) {
      console.error(`[${requestId}] JSON parse error:`, parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON body",
          error_code: "INVALID_JSON",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawImageUrls: string[] =
      Array.isArray(payload.file_urls) && payload.file_urls.length > 0
        ? payload.file_urls
        : payload.file_url
          ? [payload.file_url]
          : [];

    const rawBaseImageUrls: string[] =
      Array.isArray(payload.base_file_urls) && payload.base_file_urls.length > 0
        ? payload.base_file_urls
        : payload.base_file_url
          ? [payload.base_file_url]
          : Array.isArray(payload.raw_file_urls) && payload.raw_file_urls.length > 0
            ? payload.raw_file_urls
            : payload.raw_file_url
              ? [payload.raw_file_url]
              : [];

    const imageUrls = [...new Set(rawImageUrls.filter((u) => u && u.trim() !== ""))];
    const baseImageUrls = [...new Set(rawBaseImageUrls.filter((u) => u && u.trim() !== ""))];
    const thumbnailUrl = imageUrls[0] || baseImageUrls[0] || "";

    const pautaId = normalizePautaId(payload.pauta_id);
    const parsedChannels = normalizeChannels(payload.channels ?? payload.canais);
    const includeNewsletter = hasNewsletterChannel(payload.channels ?? payload.canais);
    const company = normalizeCompany(payload.company);
    // origem precisa respeitar a check constraint mkt_social_posts_origem_check.
    // O agente pode enviar o source_type cru (ex.: "pauta"), que não está no
    // vocabulário permitido — normalizamos para um valor válido aqui.
    const ALLOWED_ORIGEM = ["agenda_editorial", "rss", "manual", "arquivo", "n8n"];
    let origem = payload.origem || (pautaId ? "agenda_editorial" : "n8n");
    if (!ALLOWED_ORIGEM.includes(origem)) origem = pautaId ? "agenda_editorial" : "n8n";

    console.log(
      `[${requestId}] Payload received - title: "${payload.title}", images: ${imageUrls.length}, base_images: ${baseImageUrls.length}, thumbnail: "${thumbnailUrl.substring(0, 60)}...", workspace_id: ${payload.workspace_id || "default"}, company: ${company}, origem: ${origem}, pauta_id: ${pautaId ?? "null"}, channels: ${JSON.stringify(parsedChannels)}`,
    );

    if (imageUrls.length === 0 || !payload.title) {
      console.log(`[${requestId}] Validation failed - missing required fields`);
      if (payload.generation_id) {
        await updateGenerationStatus(supabase, payload.generation_id, "failed", {
          error_message: "Validation failed: file_url/file_urls and title are required",
        });
      }
      return new Response(
        JSON.stringify({
          error: "file_url (or file_urls) and title are required",
          error_code: "MISSING_FIELDS",
          request_id: requestId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.dry_run) {
      console.log(`[${requestId}] Dry run mode - validation passed, skipping insert`);
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          message: "Validation passed - no data inserted",
          images_detected: imageUrls.length,
          request_id: requestId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const workspaceId = payload.workspace_id || "00000000-0000-0000-0000-000000000001";

    const { data: workspace, error: workspaceError } = await supabase
      .from("mkt_workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error(`[${requestId}] Workspace not found:`, workspaceError);
      if (payload.generation_id) {
        await updateGenerationStatus(supabase, payload.generation_id, "failed", {
          error_message: `Workspace not found: ${workspaceId}`,
        });
      }
      return new Response(
        JSON.stringify({
          error: "Workspace not found",
          error_code: "WORKSPACE_NOT_FOUND",
          request_id: requestId,
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[${requestId}] Workspace found: ${workspace.name} (${workspace.id})`);

    const n8nTags = (payload.tags || [])
      .map((tag: string) => tag.replace(/\s*MGA$/i, "").trim())
      .filter((t: string) => t.length > 0);

    console.log(`[${requestId}] Generating AI tags...`);
    const aiTags = await generateContentTags(payload.title, payload.content || payload.excerpt || "");

    const seenTags = new Set<string>();
    const finalTags: string[] = [];

    for (const tag of [...n8nTags, ...aiTags]) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!seenTags.has(normalizedTag) && normalizedTag.length > 0) {
        seenTags.add(normalizedTag);
        finalTags.push(tag.trim());
      }
    }

    const limitedTags = finalTags.slice(0, 8);
    console.log(`[${requestId}] Final tags: ${JSON.stringify(limitedTags)}`);

    const { data: post, error: postError } = await supabase
      .from("mkt_social_posts")
      .insert({
        workspace_id: workspaceId,
        title: payload.title,
        content: payload.content || "",
        excerpt: payload.excerpt || "",
        media_urls: imageUrls,
        base_media_urls: baseImageUrls.length > 0 ? baseImageUrls : imageUrls,
        rendered_media_urls: imageUrls,
        og_image_url: thumbnailUrl,
        image_urls: imageUrls,
        thumbnail_url: thumbnailUrl,
        status: "IN_REVIEW_INTERNAL",
        channels: parsedChannels,
        company,
        origem,
        pauta_id: pautaId,
        tags: limitedTags,
      })
      .select()
      .single();

    if (postError) {
      console.error(`[${requestId}] Error creating post:`, postError);
      if (payload.generation_id) {
        await updateGenerationStatus(supabase, payload.generation_id, "failed", {
          error_message: `Error creating post: ${postError.message}`,
        });
      }
      return new Response(
        JSON.stringify({
          error: "Failed to create post",
          error_code: "INSERT_FAILED",
          details: postError.message,
          request_id: requestId,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (payload.generation_id) {
      await updateGenerationStatus(supabase, payload.generation_id, "completed", { post_id: post.id });
    }

    if (includeNewsletter) {
      const draftSubject = `[Informe] ${payload.title}`;
      const draftHtml = buildNewsletterDraftHtml(payload, thumbnailUrl);

      const { data: campaign, error: campaignError } = await supabase
        .from("mkt_newsletter_campaigns")
        .insert({
          workspace_id: workspaceId,
          subject: draftSubject,
          content: draftHtml,
          segments: [],
          status: "draft",
        })
        .select("id")
        .single();

      if (campaignError) {
        console.error(`[${requestId}] Failed to create newsletter draft campaign (non-blocking):`, campaignError);
      } else {
        console.log(`[${requestId}] Newsletter draft campaign created: ${campaign.id}`);
      }
    }

    if (pautaId) {
      const { error: pautaUpdateError } = await supabase
        .from("mkt_pautas")
        .update({
          status: "gerado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pautaId);

      if (pautaUpdateError) {
        console.error(`[${requestId}] Failed to update pauta ${pautaId} to gerado (non-blocking):`, pautaUpdateError);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[${requestId}] Post created: ${post.id} | images: ${imageUrls.length} | tags: ${JSON.stringify(limitedTags)} | ${duration}ms`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        post_id: post.id,
        status: "IN_REVIEW_INTERNAL",
        images_saved: imageUrls.length,
        base_images_saved: baseImageUrls.length > 0 ? baseImageUrls.length : imageUrls.length,
        thumbnail_url: thumbnailUrl,
        tags: limitedTags,
        origem,
        pauta_id: pautaId,
        channels: parsedChannels,
        newsletter_draft_created: includeNewsletter,
        message: "Post created and waiting approval",
        request_id: requestId,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(`[${requestId}] Unhandled error:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        error_code: "INTERNAL_ERROR",
        request_id: requestId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function updateGenerationStatus(
  supabase: ReturnType<typeof createClient>,
  generationId: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  try {
    await supabase
      .from("mkt_post_generation_status")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("generation_id", generationId);
  } catch (err) {
    console.error("updateGenerationStatus error (non-blocking):", err);
  }
}
