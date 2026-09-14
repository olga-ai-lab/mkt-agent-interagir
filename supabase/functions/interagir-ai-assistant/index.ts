import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIRequest {
  action: 'generate_caption' | 'suggest_hashtags' | 'adapt_tone' | 'summarize' | 'generate_ideas' | 'improve_content' | 'suggest_title' | 'suggest_excerpt';
  content?: string;
  topic?: string;
  channel?: string;
  tone?: 'formal' | 'casual' | 'professional' | 'friendly';
  workspace_id?: string;
}

// Platform-specific prompts for caption generation
const platformPrompts: Record<string, string> = {
  blog: `Você é um redator especializado em conteúdo para blogs corporativos e profissionais.
Regras OBRIGATÓRIAS:
- Escreva de forma profissional, técnica e aprofundada
- Use parágrafos bem desenvolvidos (mínimo 3-4 frases cada)
- Inclua dados, estatísticas, exemplos ou casos de uso quando possível
- Tom educativo, com autoridade e expertise no assunto
- Estruture com introdução clara, desenvolvimento rico e conclusão
- MÍNIMO de 300 palavras - textos curtos serão rejeitados
- NÃO use emojis, hashtags ou linguagem informal
- Use linguagem formal mas acessível ao público-alvo
- Foque em entregar valor, conhecimento profundo e insights práticos
- Inclua subtítulos quando apropriado para organizar o conteúdo
- Responda APENAS com o texto do artigo, sem explicações adicionais`,

  instagram: `Você é um especialista em marketing para Instagram.
Regras de emoji (limite RÍGIDO — nunca ultrapasse):
- NO MÁXIMO 2 emojis em todo o texto: um junto ao gancho na primeira linha, e
  opcionalmente mais um no CTA final.
- Os parágrafos do meio (desenvolvimento) NÃO levam emoji nenhum — apenas texto.
Regras de estrutura:
- Comece com um HOOK forte que pare o scroll, em CAIXA ALTA (primeira linha é crucial)
- Seja conciso mas impactante
- Tom casual, leve, próximo e autêntico
- Quebre o texto em parágrafos curtos (2-3 linhas), com linha em branco entre eles
- Finalize com um CTA direto e objetivo (ex.: "Saiba mais", "Fale com a gente", "Fale
  com um corretor") — NUNCA peça para comentar uma palavra-código (ex.: "Comenta 'X'")
- Máximo de 2200 caracteres
- Use espaçamento para facilitar leitura no mobile
- Responda APENAS com a legenda, sem explicações`,

  facebook: `Você é um especialista em marketing para Facebook.
Regras de emoji (limite RÍGIDO — nunca ultrapasse):
- NO MÁXIMO 2 emojis em todo o texto: um junto ao gancho na primeira linha, e
  opcionalmente mais um no CTA final.
- Os parágrafos do meio (desenvolvimento) NÃO levam emoji nenhum — apenas texto.
Regras de estrutura:
- Comece com um hook que gere curiosidade ou emoção, em CAIXA ALTA
- Tom conversacional e próximo da comunidade
- Incentive interação sem pedir para comentar uma palavra-código
- Finalize com um CTA direto e objetivo (ex.: "Saiba mais", "Fale com a gente", "Fale
  com um corretor")
- Pode ser um pouco mais longo que Instagram
- Quebre em parágrafos para facilitar leitura, com linha em branco entre eles
- Responda APENAS com a legenda, sem explicações`,

  linkedin: `Você é um especialista em conteúdo para LinkedIn.
Regras:
- Tom profissional mas pessoal e autêntico
- Use storytelling corporativo quando apropriado
- Inclua insights de mercado, tendências ou aprendizados
- Emojis com moderação (máximo 3, profissionais)
- Estrutura: gancho envolvente → desenvolvimento → reflexão → CTA
- Incentive comentários e discussão profissional
- Evite linguagem muito comercial ou vendedora
- Foque em valor profissional e networking
- Use quebras de linha para facilitar leitura
- Responda APENAS com o post, sem explicações`,
};

const systemPrompts: Record<string, string> = {
  generate_caption: `Você é um especialista em marketing de redes sociais. Gere legendas criativas e engajantes para posts.
Regras:
- Seja conciso e impactante
- Use emojis com moderação
- Adapte o tom para a rede social mencionada
- Inclua call-to-action quando apropriado
- Responda APENAS com a legenda, sem explicações adicionais`,

  suggest_hashtags: `Você é um especialista em SEO e marketing de redes sociais. Sugira hashtags relevantes.
Regras:
- Sugira entre 5-15 hashtags
- Misture hashtags populares e de nicho
- Adapte para o canal (Instagram usa mais, LinkedIn menos, Blog não usa)
- Para Blog: sugira tags/palavras-chave em vez de hashtags
- Responda APENAS com as hashtags separadas por espaço, sem explicações`,

  adapt_tone: `Você é um especialista em comunicação. Adapte o texto para o tom solicitado.
Regras:
- Mantenha a mensagem principal intacta
- Ajuste vocabulário e estilo conforme o tom
- Preserve informações importantes
- Responda APENAS com o texto adaptado, sem explicações`,

  summarize: `Você é um especialista em comunicação concisa. Resuma o texto para formatos curtos.
Regras:
- Máximo de 280 caracteres (ideal para Twitter/X)
- Mantenha a essência da mensagem
- Use linguagem direta e impactante
- Responda APENAS com o resumo, sem explicações`,

  generate_ideas: `Você é um criativo de marketing. Sugira ideias de posts baseadas no tema.
Regras:
- Sugira 5 ideias diferentes
- Cada ideia deve ter um título curto e descrição de 1 linha
- Varie os formatos (informativo, inspiracional, promocional, etc.)
- Formato de resposta: cada ideia em uma linha, com título em negrito seguido de descrição
- Responda APENAS com as ideias, sem introdução ou conclusão`,

  improve_content: `Você é um especialista em copywriting e marketing digital. Melhore o texto fornecido mantendo sua mensagem principal.
Regras:
- Melhore clareza, impacto e engajamento
- Corrija erros gramaticais e de pontuação
- Fortaleça o hook/abertura para capturar atenção
- Adicione CTA (call-to-action) se ausente ou fraco
- Melhore o fluxo e ritmo do texto
- Mantenha a essência e informações originais
- Responda APENAS com o texto melhorado, sem explicações`,

  suggest_title: `Você é um especialista em criação de títulos.
Regras:
- Crie um título curto, impactante e direto (máximo 10 palavras)
- Capture a essência do conteúdo
- Use linguagem que gere curiosidade
- Não use aspas, hashtags ou emojis
- Responda APENAS com o título, sem explicações`,

  suggest_excerpt: `Você é um especialista em comunicação concisa.
Regras:
- Crie um resumo de 1-2 frases
- Capture o ponto principal do conteúdo
- Use linguagem direta e envolvente
- Máximo de 150 caracteres
- Não use hashtags ou emojis
- Responda APENAS com o resumo, sem explicações`,
};

// Platform-specific improve prompts
const platformImprovePrompts: Record<string, string> = {
  blog: `Você é um editor de conteúdo especializado em blogs profissionais.
Melhore o texto seguindo estas regras:
- Expanda e aprofunde o conteúdo com mais detalhes técnicos
- Adicione estrutura com subtítulos se necessário
- Use linguagem formal e profissional
- REMOVA todos os emojis e hashtags
- Garanta mínimo de 300 palavras
- Melhore a clareza e o fluxo de leitura
- Mantenha a essência e informações originais
- Responda APENAS com o texto melhorado, sem explicações`,

  instagram: `Você é um especialista em copywriting para Instagram.
Melhore o texto seguindo estas regras:
- Fortaleça o hook inicial para parar o scroll, colocando-o em CAIXA ALTA
- Emoji — limite RÍGIDO: no máximo 2 no total (um junto ao gancho inicial, outro
  opcional no CTA final). REMOVA qualquer emoji que esteja nos parágrafos do meio.
- Mantenha tom casual e engajante
- Melhore o CTA usando algo direto (ex.: "Saiba mais", "Fale com a gente") — nunca
  peça para comentar uma palavra-código (ex.: "Comenta 'X'")
- Quebre em parágrafos curtos, com linha em branco entre eles
- Responda APENAS com o texto melhorado, sem explicações`,

  facebook: `Você é um especialista em copywriting para Facebook.
Melhore o texto seguindo estas regras:
- Fortaleça o gancho inicial, colocando-o em CAIXA ALTA
- Emoji — limite RÍGIDO: no máximo 2 no total (um junto ao gancho inicial, outro
  opcional no CTA final). REMOVA qualquer emoji que esteja nos parágrafos do meio.
- Tom conversacional e próximo
- Incentive interação sem pedir para comentar uma palavra-código
- Melhore o CTA usando algo direto (ex.: "Saiba mais", "Fale com a gente")
- Responda APENAS com o texto melhorado, sem explicações`,

  linkedin: `Você é um especialista em copywriting para LinkedIn.
Melhore o texto seguindo estas regras:
- Tom profissional mas pessoal
- Adicione insights de mercado se possível
- Emojis com moderação (máximo 3)
- Estrutura: gancho → desenvolvimento → reflexão → CTA
- Responda APENAS com o texto melhorado, sem explicações`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, content, topic, channel, tone, workspace_id } = await req.json() as AIRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch prompt adjustments AND playbook if workspace_id is provided
    let adjustmentPrompt = '';
    if (workspace_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        , { db: { schema: 'interagir' } });

        // Fetch adjustments
        const { data: adjustments } = await supabase
          .from('mkt_ai_prompt_adjustments')
          .select('caption_avoid_list, caption_prefer_list, image_avoid_list, image_prefer_list')
          .eq('workspace_id', workspace_id)
          .maybeSingle();

        // NEW: Fetch playbook for Prompt Master
        const { data: playbook } = await supabase
          .from('mkt_ai_trend_playbook')
          .select('prompt_master, do_list, dont_list')
          .eq('workspace_id', workspace_id)
          .maybeSingle();

        // Inject Prompt Master first (strategic direction)
        if (playbook?.prompt_master) {
          adjustmentPrompt = `\n\n📋 DIREÇÃO ESTRATÉGICA DA MARCA:\n${playbook.prompt_master}`;
          console.log('Loaded Prompt Master for workspace:', workspace_id);
        }

        if (adjustments) {
          const avoidList = adjustments.caption_avoid_list?.filter(Boolean).join('\n• ') || '';
          const preferList = adjustments.caption_prefer_list?.filter(Boolean).join('\n• ') || '';

          if (avoidList) {
            adjustmentPrompt += `\n\n⚠️ IMPORTANTE - BASEADO EM FEEDBACK ANTERIOR, EVITE:\n• ${avoidList}`;
          }
          if (preferList) {
            adjustmentPrompt += `\n\n✅ PREFIRA:\n• ${preferList}`;
          }

          console.log('Loaded prompt adjustments for workspace:', workspace_id);
        }
        
        if (adjustmentPrompt) {
          console.log('Final adjustment prompt:', adjustmentPrompt);
        }
      } catch (adjustmentError) {
        console.error('Error fetching prompt adjustments/playbook:', adjustmentError);
        // Continue without adjustments
      }
    }

    // Build user message based on action
    let userMessage = '';
    let baseSystemPrompt = '';
    
    // Normalize channel to lowercase for matching
    const normalizedChannel = (channel || '').toLowerCase();
    
    switch (action) {
      case 'generate_caption':
        // Use platform-specific prompt for caption generation
        baseSystemPrompt = platformPrompts[normalizedChannel] || platformPrompts.instagram || systemPrompts.generate_caption;
        userMessage = `Gere ${normalizedChannel === 'blog' ? 'um artigo completo' : 'uma legenda criativa'} sobre: "${topic || content}"`;
        break;
        
      case 'suggest_hashtags':
        baseSystemPrompt = systemPrompts.suggest_hashtags;
        userMessage = `Sugira ${normalizedChannel === 'blog' ? 'palavras-chave/tags' : 'hashtags'} relevantes para o seguinte conteúdo:\n"${content || topic}"`;
        if (channel) userMessage += `\nCanal: ${channel}`;
        break;
        
      case 'adapt_tone':
        baseSystemPrompt = systemPrompts.adapt_tone;
        userMessage = `Adapte o seguinte texto para um tom ${tone || 'professional'}:\n"${content}"`;
        if (channel) userMessage += `\nCanal: ${channel}`;
        break;
        
      case 'summarize':
        baseSystemPrompt = systemPrompts.summarize;
        userMessage = `Resuma o seguinte texto para máximo 280 caracteres:\n"${content}"`;
        break;
        
      case 'generate_ideas':
        baseSystemPrompt = systemPrompts.generate_ideas;
        userMessage = `Sugira 5 ideias de posts sobre o tema: "${topic || content}"`;
        if (channel) userMessage += `\nPara o canal: ${channel}`;
        break;
        
      case 'improve_content':
        // Use platform-specific improve prompt
        baseSystemPrompt = platformImprovePrompts[normalizedChannel] || systemPrompts.improve_content;
        userMessage = `Melhore o seguinte texto${normalizedChannel === 'blog' ? ' para um artigo de blog profissional' : ''}, mantendo a essência:\n\n"${content}"`;
        break;
        
      case 'suggest_title': {
        baseSystemPrompt = systemPrompts.suggest_title;
        // Instagram e Facebook: título/gancho em caixa alta é o padrão da plataforma.
        if (normalizedChannel === 'instagram' || normalizedChannel === 'facebook') {
          baseSystemPrompt += `\n- Este título é para ${normalizedChannel === 'instagram' ? 'Instagram' : 'Facebook'}: escreva TODO o título em CAIXA ALTA (letras maiúsculas).`;
        }
        userMessage = `Crie um título ${normalizedChannel === 'blog' ? 'profissional e informativo' : 'curto e impactante'} para o seguinte conteúdo:\n\n"${content}"`;
        break;
      }
        
      case 'suggest_excerpt':
        baseSystemPrompt = systemPrompts.suggest_excerpt;
        userMessage = `Crie um resumo conciso (máximo 150 caracteres) para o seguinte conteúdo:\n\n"${content}"`;
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Combine base system prompt with dynamic adjustments
    const systemPrompt = baseSystemPrompt + adjustmentPrompt;

    console.log('Final system prompt:', systemPrompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
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
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
