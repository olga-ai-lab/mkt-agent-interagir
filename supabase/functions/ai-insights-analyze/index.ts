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
    const { post_id, workspace_id } = await req.json();

    if (!post_id || !workspace_id) {
      return new Response(
        JSON.stringify({ error: "post_id and workspace_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    , { db: { schema: 'interagir' } });

    // Fetch post data
    const { data: post, error: postError } = await supabase
      .from("mkt_social_posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postError || !post) {
      throw new Error("Post not found");
    }

    // Fetch analytics
    const { data: analytics, error: analyticsError } = await supabase
      .from("mkt_post_analytics")
      .select("*")
      .eq("post_id", post_id);

    if (analyticsError) {
      console.error("Error fetching analytics:", analyticsError);
    }

    // Calculate aggregated metrics
    const totalMetrics = (analytics || []).reduce(
      (acc, a) => ({
        impressions: acc.impressions + (a.impressions || 0),
        reach: acc.reach + (a.reach || 0),
        likes: acc.likes + (a.likes || 0),
        comments: acc.comments + (a.comments || 0),
        shares: acc.shares + (a.shares || 0),
        saves: acc.saves + (a.saves || 0),
        engagement_rate: acc.engagement_rate + (a.engagement_rate || 0),
      }),
      { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement_rate: 0 }
    );

    const avgEngagement = analytics?.length
      ? totalMetrics.engagement_rate / analytics.length
      : 0;

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const analysisPrompt = `Analise o seguinte post de rede social e seus resultados de performance:

TÍTULO: ${post.title}

LEGENDA:
${post.content || "Sem conteúdo"}

CANAIS: ${(post.channels || []).join(", ")}

MÉTRICAS:
- Alcance: ${totalMetrics.reach}
- Impressões: ${totalMetrics.impressions}
- Curtidas: ${totalMetrics.likes}
- Comentários: ${totalMetrics.comments}
- Compartilhamentos: ${totalMetrics.shares}
- Salvamentos: ${totalMetrics.saves}
- Taxa de Engajamento: ${avgEngagement.toFixed(2)}%

Forneça uma análise completa no formato JSON:
{
  "summary": "Resumo de 1-2 frases sobre a performance do post",
  "strengths": ["lista de 2-4 pontos fortes que contribuíram para o sucesso"],
  "weaknesses": ["lista de 1-3 pontos fracos ou áreas de melhoria"],
  "hypotheses": ["lista de 2-3 hipóteses sobre por que o post performou assim"],
  "recommended_edits": ["lista de 2-3 sugestões de edição para posts futuros"],
  "extracted_hooks": ["lista de 1-3 hooks efetivos extraídos deste post"],
  "suggested_hashtags": ["lista de 5-10 hashtags recomendadas baseadas no conteúdo"],
  "performance_score": <número de 0 a 100 indicando performance geral>
}

Seja específico e prático nas análises.`;

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
            content: "Você é um especialista em análise de performance de conteúdo para redes sociais. Analise posts e forneça insights acionáveis. Responda APENAS com JSON válido.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("AI analysis response:", aiContent);

    // Parse AI response
    let analysis;
    try {
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      analysis = {
        summary: "Análise não disponível",
        strengths: [],
        weaknesses: [],
        hypotheses: [],
        recommended_edits: [],
        extracted_hooks: [],
        suggested_hashtags: [],
        performance_score: 0,
      };
    }

    // Upsert insight
    const { data: insight, error: upsertError } = await supabase
      .from("mkt_ai_post_insights")
      .upsert({
        post_id,
        workspace_id,
        summary: analysis.summary,
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        hypotheses: analysis.hypotheses || [],
        recommended_edits: analysis.recommended_edits || [],
        extracted_hooks: analysis.extracted_hooks || [],
        suggested_hashtags: analysis.suggested_hashtags || [],
        performance_score: analysis.performance_score || 0,
      })
      .select()
      .single();

    if (upsertError) {
      console.error("Error upserting insight:", upsertError);
      throw upsertError;
    }

    console.log("Successfully created insight for post:", post_id);

    // Trigger playbook update after saving insight
    try {
      const playbookResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/mkt-update-trend-playbook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ workspace_id }),
        }
      );
      
      if (playbookResponse.ok) {
        console.log("Trend playbook updated successfully");
      } else {
        console.error("Failed to update playbook:", await playbookResponse.text());
      }
    } catch (playbookError) {
      console.error("Error triggering playbook update:", playbookError);
      // Don't fail the main request if playbook update fails
    }

    return new Response(
      JSON.stringify({ success: true, insight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in ai-insights-analyze:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
