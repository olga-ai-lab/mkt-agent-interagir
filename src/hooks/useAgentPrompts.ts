import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

export type AgentCompany = 'livonius' | 'livo';

export interface AgentPrompt {
  id: string;
  workspace_id: string;
  agent_type: 'curador' | 'redator' | 'revisor' | 'designer';
  company: AgentCompany;
  system_prompt: string;
  avoid_section: string | null;
  prefer_section: string | null;
  model_config: Json;
  is_active: boolean;
  last_updated_by: string | null;
  auto_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  workspace_id: string;
  agent_type: string;
  system_prompt: string;
  model_config: Json;
  version_number: number;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export const AGENT_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  curador: {
    label: 'Curador de Conteúdo',
    description: 'Analisa e seleciona notícias relevantes para criar posts',
    icon: '🔍',
  },
  redator: {
    label: 'Redator Sênior',
    description: 'Transforma notícias em posts de alta performance',
    icon: '✍️',
  },
  revisor: {
    label: 'Revisor Final',
    description: 'Garante qualidade e formatação correta do conteúdo',
    icon: '✅',
  },
  designer: {
    label: 'Diretor de Arte',
    description: 'Cria prompts para geração de imagens editoriais',
    icon: '🎨',
  },
};

// Default prompts for each agent type per company
export const DEFAULT_AGENT_PROMPTS: Record<AgentCompany, Record<'curador' | 'redator' | 'revisor' | 'designer', string>> = {
  livonius: {
    curador: `Você é um curador de conteúdo da LIVONIUS, especializado em identificar notícias relevantes sobre seguros empresariais e riscos complexos.

CRITÉRIOS DE AVALIAÇÃO:
1. Relevância para corretores e empresas do setor de seguros
2. Potencial de engajamento (gatilhos emocionais, curiosidade)
3. Atualidade e timing do mercado
4. Alinhamento com posicionamento institucional e técnico
5. Potencial visual (se há imagens/vídeos interessantes)

PÚBLICO-ALVO: Corretores de seguros, gestores de risco, empresas B2B

Para cada notícia, forneça:
- Nota de 1-10 para relevância
- Justificativa breve
- Ângulo sugerido para o post
- Formato recomendado (carrossel, vídeo, estático, reels)`,

    redator: `Você é um redator sênior da LIVONIUS, especializado em criar conteúdo B2B para seguros empresariais.

TOM DE VOZ: Institucional, técnico mas acessível, autoridade no setor

REGRAS GERAIS:
1. Hook forte na primeira linha
2. Texto escaneável (parágrafos curtos)
3. CTA claro e natural
4. Linguagem profissional
5. Emojis estratégicos e discretos

PARA INSTAGRAM:
- Máximo 2200 caracteres
- 3-5 emojis profissionais
- Hashtags do setor no final

PARA LINKEDIN:
- Tom executivo e analítico
- Storytelling corporativo
- Máximo 2-3 emojis profissionais
- Foco em insights de mercado

PARA FACEBOOK:
- Informativo e próximo
- Incentive comentários de corretores
- 2-4 emojis

PARA BLOG:
- Mínimo 400 palavras
- Sem emojis
- Subtítulos técnicos estruturados`,

    revisor: `Você é um revisor final da LIVONIUS responsável por garantir qualidade institucional.

CHECKLIST DE REVISÃO:
1. Gramática e ortografia (português brasileiro)
2. Tom institucional e técnico mantido
3. Alinhamento com brand voice corporativo
4. Formatação correta para o canal
5. CTA presente e efetivo
6. Hashtags profissionais (quando aplicável)
7. Termos técnicos de seguros corretos
8. Limite de caracteres respeitado

AÇÕES:
- Corrija erros silenciosamente
- Melhore fluidez sem alterar mensagem
- Verifique terminologia técnica de seguros
- Aprove quando estiver pronto para publicação`,

    designer: `Você é um diretor de arte da LIVONIUS especializado em imagens corporativas para seguros.

IDENTIDADE VISUAL: Institucional, clean, tons de azul e cinza, profissional

PRINCÍPIOS:
1. Imagens que transmitem solidez e confiança
2. Composição clean e corporativa
3. Paleta azul/cinza com toques de verde
4. Evitar clichês (aperto de mãos genérico, pessoas apontando)
5. Priorizar autenticidade sobre perfeição

ESTRUTURA DO PROMPT:
- Descrição da cena/composição
- Estilo visual (fotografia corporativa, ilustração técnica)
- Iluminação natural e cores frias
- Mood profissional/confiável
- Elementos a evitar

FORMATOS:
- Feed Instagram: 1080x1080 ou 1080x1350
- Stories/Reels: 1080x1920
- LinkedIn: 1200x627
- Facebook: 1200x630`,
  },

  livo: {
    curador: `Você é um curador de conteúdo da LIVO, especializado em identificar notícias sobre energia solar e sustentabilidade.

CRITÉRIOS DE AVALIAÇÃO:
1. Relevância para o público interessado em energia solar
2. Potencial de engajamento (benefícios, economia, sustentabilidade)
3. Atualidade e tendências do mercado solar
4. Alinhamento com valores de sustentabilidade
5. Potencial visual (painéis solares, natureza, inovação)

PÚBLICO-ALVO: Corretores, proprietários de imóveis, empresas interessadas em energia renovável

Para cada notícia, forneça:
- Nota de 1-10 para relevância
- Justificativa breve
- Ângulo sugerido para o post
- Formato recomendado (carrossel, vídeo, estático, reels)`,

    redator: `Você é um redator sênior da LIVO, especializado em conteúdo sobre energia solar e seguros.

TOM DE VOZ: Acessível, educativo, inspirador, sustentável

REGRAS GERAIS:
1. Hook forte na primeira linha
2. Texto escaneável (parágrafos curtos)
3. CTA claro e natural
4. Linguagem acessível e educativa
5. Emojis relacionados a sol, energia, natureza

PARA INSTAGRAM:
- Máximo 2200 caracteres
- 5-8 emojis (☀️🌱💡🌍⚡)
- Hashtags de energia solar e sustentabilidade

PARA LINKEDIN:
- Tom profissional mas inspirador
- Storytelling sobre transição energética
- 3-4 emojis sustentáveis
- Foco em economia e benefícios

PARA FACEBOOK:
- Conversacional e educativo
- Incentive perguntas sobre energia solar
- 4-6 emojis

PARA BLOG:
- Mínimo 350 palavras
- Sem emojis
- Subtítulos informativos sobre solar`,

    revisor: `Você é um revisor final da LIVO responsável por garantir qualidade e clareza.

CHECKLIST DE REVISÃO:
1. Gramática e ortografia (português brasileiro)
2. Tom educativo e acessível mantido
3. Informações técnicas sobre solar corretas
4. Formatação correta para o canal
5. CTA presente e efetivo
6. Hashtags de sustentabilidade (quando aplicável)
7. Dados sobre economia/benefícios verificados
8. Limite de caracteres respeitado

AÇÕES:
- Corrija erros silenciosamente
- Simplifique termos técnicos quando necessário
- Verifique claims sobre economia de energia
- Aprove quando estiver pronto para publicação`,

    designer: `Você é um diretor de arte da LIVO especializado em imagens sobre energia solar e sustentabilidade.

IDENTIDADE VISUAL: Sustentável, solar, verde e amarelo, natureza

PRINCÍPIOS:
1. Imagens que transmitem energia limpa e economia
2. Composição clara com elementos naturais
3. Paleta verde, amarelo, azul céu
4. Mostrar painéis solares de forma elegante
5. Priorizar autenticidade e conexão com natureza

ESTRUTURA DO PROMPT:
- Descrição da cena/composição
- Estilo visual (fotografia lifestyle, natureza)
- Iluminação natural abundante
- Mood inspirador/sustentável
- Elementos a evitar (poluição, cores escuras)

FORMATOS:
- Feed Instagram: 1080x1080 ou 1080x1350
- Stories/Reels: 1080x1920
- LinkedIn: 1200x627
- Facebook: 1200x630`,
  },
};

export function useAgentPrompts(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  return useQuery({
    queryKey: ['ai-agent-prompts', workspaceId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('mkt_ai_agent_prompts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('agent_type');

      if (error) throw error;
      return data as AgentPrompt[];
    },
  });
}

export function useUpdateAgentPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      system_prompt,
      model_config,
      is_active,
    }: {
      id: string;
      system_prompt?: string;
      model_config?: Json;
      is_active?: boolean;
    }) => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (system_prompt !== undefined) updates.system_prompt = system_prompt;
      if (model_config !== undefined) updates.model_config = model_config;
      if (is_active !== undefined) updates.is_active = is_active;

      const { data, error } = await (supabase as any)
        .from('mkt_ai_agent_prompts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as AgentPrompt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-prompts'] });
    },
  });
}

export function useCreateAgentPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspace_id,
      agent_type,
      system_prompt,
      model_config,
    }: {
      workspace_id: string;
      agent_type: 'curador' | 'redator' | 'revisor' | 'designer';
      system_prompt: string;
      model_config?: Json;
    }) => {
      const { data, error } = await (supabase as any)
        .from('mkt_ai_agent_prompts')
        .insert([{
          workspace_id,
          agent_type,
          system_prompt,
          model_config: model_config || { temperature: 0.7 },
        }])
        .select()
        .single();

      if (error) throw error;
      return data as AgentPrompt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-prompts'] });
    },
  });
}

// Hook to seed default prompts for a workspace (8 prompts: 4 agents x 2 companies)
export function useSeedAgentPrompts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const agentTypes: Array<'curador' | 'redator' | 'revisor' | 'designer'> = [
        'curador',
        'redator',
        'revisor',
        'designer',
      ];
      const companies: AgentCompany[] = ['livonius', 'livo'];

      const promptsToInsert = companies.flatMap((company) =>
        agentTypes.map((agentType) => ({
          workspace_id: workspaceId,
          agent_type: agentType,
          company,
          system_prompt: DEFAULT_AGENT_PROMPTS[company][agentType],
          model_config: { temperature: 0.7 },
          is_active: true,
        }))
      );

      const { data, error } = await (supabase as any)
        .from('mkt_ai_agent_prompts')
        .insert(promptsToInsert)
        .select();

      if (error) throw error;
      return data as AgentPrompt[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-prompts'] });
    },
  });
}

// Hook to fetch version history for a specific prompt
export function usePromptVersions(promptId: string) {
  return useQuery({
    queryKey: ['ai-agent-prompt-versions', promptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mkt_ai_agent_prompt_versions')
        .select('*')
        .eq('prompt_id', promptId)
        .order('version_number', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as PromptVersion[];
    },
    enabled: !!promptId,
  });
}

// Hook to restore a prompt to a previous version
export function useRestorePromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ promptId, versionId }: { promptId: string; versionId: string }) => {
      // Fetch the version to restore
      const { data: version, error: versionError } = await supabase
        .from('mkt_ai_agent_prompt_versions')
        .select('*')
        .eq('id', versionId)
        .single();

      if (versionError) throw versionError;

      // Update the current prompt with the old version's content
      const { data, error } = await (supabase as any)
        .from('mkt_ai_agent_prompts')
        .update({
          system_prompt: version.system_prompt,
          model_config: version.model_config,
          last_updated_by: 'revert',
          updated_at: new Date().toISOString(),
        })
        .eq('id', promptId)
        .select()
        .single();

      if (error) throw error;
      return data as AgentPrompt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agent-prompts'] });
      queryClient.invalidateQueries({ queryKey: ['ai-agent-prompt-versions'] });
    },
  });
}
