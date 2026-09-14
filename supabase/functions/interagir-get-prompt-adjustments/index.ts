import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentPrompt {
  id: string;
  agent_type: string;
  system_prompt: string;
  model_config: Record<string, unknown>;
  is_active: boolean;
  updated_at: string;
  auto_updated_at: string | null;
}

interface Adjustments {
  caption_avoid_list?: string[];
  caption_prefer_list?: string[];
  image_avoid_list?: string[];
  image_prefer_list?: string[];
  common_issues?: Record<string, number>;
  total_rejections_analyzed?: number;
  last_analysis_at?: string;
}

interface Playbook {
  prompt_master?: string | null;
  do_list?: string[];
  dont_list?: string[];
}

function buildAgentPrompt(
  prompts: AgentPrompt[] | null,
  agentType: string,
  adjustments: Adjustments | null,
  playbook: Playbook | null
): { type: string; prompt: string; model_config: Record<string, unknown>; updated_at: string; auto_updated_at: string | null } | null {
  const prompt = prompts?.find((p) => p.agent_type === agentType && p.is_active);
  if (!prompt) return null;

  let finalPrompt = prompt.system_prompt;

  // NEW: Inject Prompt Master at the beginning for content-generating agents
  if (playbook?.prompt_master && ['redator', 'revisor', 'designer'].includes(agentType)) {
    finalPrompt = `📋 DIREÇÃO ESTRATÉGICA DA MARCA:\n${playbook.prompt_master}\n\n---\n\n${finalPrompt}`;
  }

  // Inject avoid/prefer sections based on insights
  if (agentType === "redator" || agentType === "revisor") {
    if (adjustments?.caption_avoid_list && adjustments.caption_avoid_list.length > 0) {
      finalPrompt += `\n\n⚠️ EVITE (baseado em rejeições anteriores):\n${adjustments.caption_avoid_list.map((i) => `• ${i}`).join("\n")}`;
    }
    if (adjustments?.caption_prefer_list && adjustments.caption_prefer_list.length > 0) {
      finalPrompt += `\n\n✅ PREFIRA (padrões de sucesso):\n${adjustments.caption_prefer_list.map((i) => `• ${i}`).join("\n")}`;
    }
  }

  if (agentType === "designer") {
    if (adjustments?.image_avoid_list && adjustments.image_avoid_list.length > 0) {
      finalPrompt += `\n\n⚠️ EVITE nas imagens:\n${adjustments.image_avoid_list.map((i) => `• ${i}`).join("\n")}`;
    }
    if (adjustments?.image_prefer_list && adjustments.image_prefer_list.length > 0) {
      finalPrompt += `\n\n✅ PREFIRA nas imagens:\n${adjustments.image_prefer_list.map((i) => `• ${i}`).join("\n")}`;
    }
  }

  return {
    type: agentType,
    prompt: finalPrompt,
    model_config: prompt.model_config,
    updated_at: prompt.updated_at,
    auto_updated_at: prompt.auto_updated_at,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id") || "00000000-0000-0000-0000-000000000001";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    , { db: { schema: 'interagir' } });

    // Fetch prompt adjustments
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from("mkt_ai_prompt_adjustments")
      .select("*")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (adjustmentsError) {
      console.error("Error fetching adjustments:", adjustmentsError);
      throw adjustmentsError;
    }

    // Fetch agent prompts
    const { data: agentPrompts, error: agentPromptsError } = await supabase
      .from("mkt_ai_agent_prompts")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("is_active", true);

    if (agentPromptsError) {
      console.error("Error fetching agent prompts:", agentPromptsError);
    }

    // Also fetch playbook for additional context
    const { data: playbook, error: playbookError } = await supabase
      .from("mkt_ai_trend_playbook")
      .select("*")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (playbookError) {
      console.error("Error fetching playbook:", playbookError);
    }

    // Build agent prompts with dynamic injection (now includes playbook)
    const agents = {
      curador: buildAgentPrompt(agentPrompts, "curador", adjustments, playbook),
      redator: buildAgentPrompt(agentPrompts, "redator", adjustments, playbook),
      revisor: buildAgentPrompt(agentPrompts, "revisor", adjustments, playbook),
      designer: buildAgentPrompt(agentPrompts, "designer", adjustments, playbook),
    };

    // Format response for n8n integration
    const response = {
      // Agent prompts with injected rules (NEW!)
      agents,

      // Prompt adjustments from rejection analysis
      caption_avoid: adjustments?.caption_avoid_list || [],
      caption_prefer: adjustments?.caption_prefer_list || [],
      image_avoid: adjustments?.image_avoid_list || [],
      image_prefer: adjustments?.image_prefer_list || [],
      
      // Common issues for context
      common_issues: adjustments?.common_issues || {},
      total_rejections_analyzed: adjustments?.total_rejections_analyzed || 0,
      last_analysis_at: adjustments?.last_analysis_at || null,

      // Playbook data
      prompt_master: playbook?.prompt_master || null,
      do_list: playbook?.do_list || [],
      dont_list: playbook?.dont_list || [],
      best_formats: playbook?.best_formats || [],
      best_posting_times: playbook?.best_posting_times || [],
      top_hashtags: playbook?.top_hashtags || [],

      // For prompt injection (legacy format, kept for backwards compatibility)
      formatted_avoid_section: adjustments?.caption_avoid_list?.length > 0
        ? `EVITE nas legendas:\n${adjustments.caption_avoid_list.map((i: string) => `• ${i}`).join("\n")}`
        : "",
      formatted_prefer_section: adjustments?.caption_prefer_list?.length > 0
        ? `PREFIRA nas legendas:\n${adjustments.caption_prefer_list.map((i: string) => `• ${i}`).join("\n")}`
        : "",
      formatted_image_avoid_section: adjustments?.image_avoid_list?.length > 0
        ? `EVITE nas imagens:\n${adjustments.image_avoid_list.map((i: string) => `• ${i}`).join("\n")}`
        : "",
      formatted_image_prefer_section: adjustments?.image_prefer_list?.length > 0
        ? `PREFIRA nas imagens:\n${adjustments.image_prefer_list.map((i: string) => `• ${i}`).join("\n")}`
        : "",
    };

    console.log("Returning prompt adjustments for workspace:", workspace_id, "with agents:", Object.keys(agents).filter(k => agents[k as keyof typeof agents] !== null));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in get-prompt-adjustments:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
