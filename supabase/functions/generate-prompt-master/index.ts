import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostWithInsight {
  id: string;
  title: string;
  content: string | null;
  channels: string[];
  published_at: string | null;
  insight: {
    strengths: string[] | null;
    extracted_hooks: string[] | null;
    performance_score: number | null;
  } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();
    
    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    , { db: { schema: 'interagir' } });

    // Fetch top 10 posts with highest performance_score
    const { data: insights, error: insightsError } = await supabase
      .from('mkt_ai_post_insights')
      .select(`
        post_id,
        strengths,
        extracted_hooks,
        performance_score,
        mkt_social_posts!inner (
          id,
          title,
          content,
          channels,
          published_at
        )
      `)
      .eq('workspace_id', workspace_id)
      .order('performance_score', { ascending: false })
      .limit(10);

    if (insightsError) {
      console.error("Error fetching insights:", insightsError);
      throw insightsError;
    }

    if (!insights || insights.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "Nenhum post analisado encontrado. Analise alguns posts primeiro.",
          code: "NO_DATA"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format posts context for AI
    const postsContext = insights.map((item: any, idx: number) => {
      const post = item.social_posts;
      return `
POST ${idx + 1} (Score: ${item.performance_score || 0}/100)
Título: ${post?.title || 'Sem título'}
Canais: ${post?.channels?.join(', ') || 'N/A'}
Conteúdo: ${post?.content?.slice(0, 500) || 'Sem conteúdo'}...
Pontos Fortes: ${item.strengths?.join(', ') || 'N/A'}
Hooks Extraídos: ${item.extracted_hooks?.join(' | ') || 'N/A'}
`.trim();
    }).join('\n\n---\n\n');

    const generationPrompt = `Você é um especialista em estratégia de conteúdo e branding. Analise os seguintes posts de alto desempenho de uma marca:

${postsContext}

Com base nesses dados, gere um "Prompt Master" - uma descrição concisa (3-5 parágrafos) que capture:

1. **TOM DE VOZ**: Como a marca se comunica (formal, casual, inspirador, provocativo, técnico, etc.)
2. **ESTILO DE ESCRITA**: Estrutura típica, uso de emojis, comprimento, ritmo das frases
3. **PERSONALIDADE DA MARCA**: Valores, posicionamento, como quer ser percebida pelo público
4. **PADRÕES DE SUCESSO**: O que funciona repetidamente nesses posts que performam bem
5. **HOOKS EFETIVOS**: Tipos de aberturas que geram mais engajamento

O resultado deve ser um guia estratégico que qualquer redator possa seguir para criar conteúdo consistente e alinhado com a marca.

IMPORTANTE: 
- Seja específico e prático, não genérico
- Use exemplos dos posts quando possível
- Escreva em português brasileiro
- Responda APENAS com o texto do Prompt Master, sem JSON, markdown excessivo ou explicações adicionais`;

    console.log("Generating Prompt Master for workspace:", workspace_id);
    console.log("Analyzing", insights.length, "top posts");

    // Call AI to generate Prompt Master
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "user", content: generationPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const promptMaster = aiResponse.choices?.[0]?.message?.content?.trim();

    if (!promptMaster) {
      throw new Error("AI did not return a valid Prompt Master");
    }

    console.log("Generated Prompt Master:", promptMaster.slice(0, 200) + "...");

    // Save to ai_trend_playbook
    const { data: updatedPlaybook, error: updateError } = await supabase
      .from('mkt_ai_trend_playbook')
      .upsert({
        workspace_id,
        prompt_master: promptMaster,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id',
      })
      .select()
      .single();

    if (updateError) {
      console.error("Error saving Prompt Master:", updateError);
      throw updateError;
    }

    console.log("Prompt Master saved successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        prompt_master: promptMaster,
        posts_analyzed: insights.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-prompt-master error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
