// AI Insights Types

export interface RejectionReason {
  id: string;
  post_id: string;
  workspace_id: string;
  reasons: string[];
  additional_comment?: string;
  post_content?: string;
  post_format?: string;
  channel?: string;
  created_at: string;
  created_by?: string;
}

export interface AIPromptAdjustment {
  id: string;
  workspace_id: string;
  caption_avoid_list: string[];
  caption_prefer_list: string[];
  image_avoid_list: string[];
  image_prefer_list: string[];
  common_issues: Record<string, number>;
  last_analysis_at?: string;
  total_rejections_analyzed: number;
  created_at: string;
  updated_at: string;
}

export interface AIPostInsight {
  id: string;
  post_id: string;
  workspace_id: string;
  summary?: string;
  strengths: string[];
  weaknesses: string[];
  hypotheses: string[];
  recommended_edits: string[];
  extracted_hooks: string[];
  suggested_hashtags: string[];
  performance_score: number;
  created_at: string;
}

export interface AITrendPlaybook {
  id: string;
  workspace_id: string;
  prompt_master?: string;
  do_list: string[];
  dont_list: string[];
  winning_patterns: Record<string, unknown>;
  best_formats: string[];
  best_posting_times: string[];
  top_hashtags: string[];
  avg_save_rate: number;
  created_at: string;
  updated_at: string;
}

export interface AIContentSuggestion {
  id: string;
  workspace_id: string;
  idea_title: string;
  hook?: string;
  angle?: string;
  caption_draft?: string;
  format?: string;
  objective?: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'dismissed';
  created_post_id?: string;
  created_at: string;
}

// Rejection reasons configuration
export const REJECTION_REASON_OPTIONS = {
  LEGENDA: [
    { key: 'hook_fraco', label: 'Hook/abertura fraca' },
    { key: 'cta_ausente', label: 'Falta de CTA' },
    { key: 'tom_inadequado', label: 'Tom inadequado' },
    { key: 'muito_longo', label: 'Texto muito longo' },
    { key: 'muito_curto', label: 'Texto muito curto' },
    { key: 'emoji_excessivo', label: 'Emojis em excesso' },
    { key: 'hashtags_irrelevantes', label: 'Hashtags mal escolhidas' },
    { key: 'erro_gramatical', label: 'Erros de português' },
    { key: 'fora_do_tema', label: 'Fora do tema' },
    { key: 'linguagem_vendedora', label: 'Muito promocional' },
  ],
  IMAGEM: [
    { key: 'qualidade_baixa', label: 'Qualidade visual baixa' },
    { key: 'cores_inadequadas', label: 'Cores fora da paleta' },
    { key: 'texto_ilegivel', label: 'Texto difícil de ler' },
    { key: 'composicao_ruim', label: 'Composição confusa' },
    { key: 'nao_representa_marca', label: 'Não representa a marca' },
    { key: 'cliche_visual', label: 'Clichê visual' },
  ],
  GERAL: [
    { key: 'fora_briefing', label: 'Fora do briefing' },
    { key: 'outro', label: 'Outro (especifique)' },
  ],
} as const;

export const REJECTION_REASONS = [
  ...REJECTION_REASON_OPTIONS.LEGENDA.map(r => ({ ...r, category: 'LEGENDA' as const })),
  ...REJECTION_REASON_OPTIONS.IMAGEM.map(r => ({ ...r, category: 'IMAGEM' as const })),
  ...REJECTION_REASON_OPTIONS.GERAL.map(r => ({ ...r, category: 'GERAL' as const })),
];

export type RejectionReasonKey = typeof REJECTION_REASONS[number]['key'];
