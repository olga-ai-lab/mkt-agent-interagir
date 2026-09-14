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

    // Fetch last 50 rejections
    const { data: rejections, error: rejectionsError } = await supabase
      .from("mkt_rejection_reasons")
      .select("*")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (rejectionsError) {
      console.error("Error fetching rejections:", rejectionsError);
      throw rejectionsError;
    }

    if (!rejections || rejections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No rejections to analyze" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate reasons
    const reasonCounts: Record<string, number> = {};
    rejections.forEach((r) => {
      (r.reasons || []).forEach((reason: string) => {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
    });

    console.log("Aggregated reason counts:", reasonCounts);

    // Use Lovable AI to analyze patterns
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const analysisPrompt = `Analise os seguintes motivos de rejeição de posts de marketing para redes sociais.
Dados agregados (motivo: contagem):
${JSON.stringify(reasonCounts, null, 2)}

Total de rejeições analisadas: ${rejections.length}

Baseado nesses padrões, gere recomendações específicas e acionáveis.

Retorne APENAS um JSON válido no seguinte formato:
{
  "caption_avoid": ["lista de 3-5 coisas específicas a EVITAR nas legendas"],
  "caption_prefer": ["lista de 3-5 coisas a PREFERIR nas legendas"],
  "image_avoid": ["lista de 3-5 coisas a EVITAR nas imagens"],
  "image_prefer": ["lista de 3-5 coisas a PREFERIR nas imagens"]
}

Seja específico e prático. Por exemplo:
- Ruim: "Evite erros"
- Bom: "Evite hooks genéricos como 'Você sabia que...'"`;

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
            content: "Você é um especialista em marketing de conteúdo para redes sociais. Analise padrões de rejeição e gere recomendações práticas. Responda APENAS com JSON válido.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response:", aiContent);

    // Parse AI response
    let recommendations;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiContent;
      recommendations = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      recommendations = {
        caption_avoid: [],
        caption_prefer: [],
        image_avoid: [],
        image_prefer: [],
      };
    }

    // Upsert prompt adjustments
    const { error: upsertError } = await supabase
      .from("mkt_ai_prompt_adjustments")
      .upsert({
        workspace_id,
        caption_avoid_list: recommendations.caption_avoid || [],
        caption_prefer_list: recommendations.caption_prefer || [],
        image_avoid_list: recommendations.image_avoid || [],
        image_prefer_list: recommendations.image_prefer || [],
        common_issues: reasonCounts,
        last_analysis_at: new Date().toISOString(),
        total_rejections_analyzed: rejections.length,
      });

    if (upsertError) {
      console.error("Error upserting adjustments:", upsertError);
      throw upsertError;
    }

    console.log("Successfully updated prompt adjustments for workspace:", workspace_id);

    // Mark agent prompts as auto-updated so the trigger can detect it
    const { error: promptsUpdateError } = await supabase
      .from("mkt_ai_agent_prompts")
      .update({ auto_updated_at: new Date().toISOString() })
      .eq("workspace_id", workspace_id)
      .in("agent_type", ["redator", "revisor", "designer"]);

    if (promptsUpdateError) {
      console.error("Error updating agent prompts auto_updated_at:", promptsUpdateError);
      // Don't throw - this is not critical
    } else {
      console.log("Marked agent prompts as auto-updated");
    }

    return new Response(
      JSON.stringify({
        success: true,
        rejections_analyzed: rejections.length,
        recommendations,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-rejections:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
