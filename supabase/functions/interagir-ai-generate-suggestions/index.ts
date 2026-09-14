import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    , { db: { schema: 'interagir' } });

    // Fetch playbook
    const { data: playbook, error: playbookError } = await supabase
      .from("mkt_ai_trend_playbook")
      .select("*")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (playbookError) {
      console.error("Error fetching playbook:", playbookError);
    }

    // Fetch top performing posts for inspiration
    const { data: topPosts, error: postsError } = await supabase
      .from("mkt_ai_post_insights")
      .select(`
        *,
        mkt_social_posts (
          title,
          content,
          channels
        )
      `)
      .eq("workspace_id", workspace_id)
      .order("performance_score", { ascending: false })
      .limit(5);

    if (postsError) {
      console.error("Error fetching top posts:", postsError);
    }

    // Fetch prompt adjustments
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from("mkt_ai_prompt_adjustments")
      .select("*")
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (adjustmentsError) {
      console.error("Error fetching adjustments:", adjustmentsError);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const playbookContext = playbook
      ? `PLAYBOOK DO WORKSPACE:
- Prompt Master: ${playbook.prompt_master || "Não definido"}
- Faça: ${(playbook.do_list || []).join(", ") || "Não definido"}
- Evite: ${(playbook.dont_list || []).join(", ") || "Não definido"}
- Melhores Formatos: ${(playbook.best_formats || []).join(", ") || "Não definido"}
- Melhores Horários: ${(playbook.best_posting_times || []).join(", ") || "Não definido"}`
      : "Nenhum playbook disponível.";

    const topPostsContext = topPosts && topPosts.length > 0
      ? `TOP POSTS (para inspiração):
${topPosts.map((p, i) => `${i + 1}. "${p.social_posts?.title || "Sem título"}" - Score: ${p.performance_score}
   Hooks: ${(p.extracted_hooks || []).slice(0, 2).join(", ")}`).join("\n")}`
      : "Nenhum post de referência disponível.";

    const adjustmentsContext = adjustments
      ? `AJUSTES BASEADOS EM FEEDBACK:
- Evitar: ${(adjustments.caption_avoid_list || []).join(", ") || "Nenhum"}
- Preferir: ${(adjustments.caption_prefer_list || []).join(", ") || "Nenhum"}`
      : "";

    const generationPrompt = `Gere 5 ideias de conteúdo para redes sociais baseadas no contexto abaixo.

${playbookContext}

${topPostsContext}

${adjustmentsContext}

Para cada ideia, forneça:
1. Título criativo
2. Hook de abertura (1-2 frases impactantes)
3. Ângulo/perspectiva do conteúdo
4. Rascunho da legenda (2-3 parágrafos)
5. Formato recomendado (Carrossel, Reels, Imagem única, Story)
6. Objetivo (Engajamento, Educação, Vendas, Autoridade)
7. Nível de confiança (0-100)

Retorne APENAS um JSON válido:
{
  "suggestions": [
    {
      "idea_title": "Título da ideia",
      "hook": "Hook de abertura impactante",
      "angle": "Perspectiva/ângulo do conteúdo",
      "caption_draft": "Rascunho completo da legenda...",
      "format": "Carrossel",
      "objective": "Engajamento",
      "confidence": 85
    }
  ]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um estrategista de conteúdo criativo para redes sociais. Gere ideias originais, envolventes e alinhadas com o tom da marca. Responda APENAS com JSON válido.",
          },
          {
            role: "user",
            content: generationPrompt,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("AI suggestions response:", aiContent);

    // Parse AI response
    let suggestionsData;
    try {
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      suggestionsData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert suggestions
    const suggestions = (suggestionsData.suggestions || []).map((s: any) => ({
      workspace_id,
      idea_title: s.idea_title,
      hook: s.hook,
      angle: s.angle,
      caption_draft: s.caption_draft,
      format: s.format,
      objective: s.objective,
      confidence: s.confidence || 50,
      status: "pending",
    }));

    if (suggestions.length > 0) {
      const { error: insertError } = await supabase
        .from("mkt_ai_content_suggestions")
        .insert(suggestions);

      if (insertError) {
        console.error("Error inserting suggestions:", insertError);
        throw insertError;
      }
    }

    console.log("Successfully generated", suggestions.length, "suggestions for workspace:", workspace_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: suggestions.length,
        suggestions 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in ai-generate-suggestions:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
