// Marketing System Types

export type PostStatus = 
  | 'DRAFT'
  | 'IN_REVIEW_INTERNAL'
  | 'IN_REVIEW_EXTERNAL'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED';

export type SocialChannel = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'blog';

export type PostCompany = 'livonius' | 'livo';

export type BrandAssetKind = 'partner_logo' | 'brand_logo' | 'regulatory_badge';

export type OverlayAnchor =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center'
  | 'footer-center';

export type OverlayType = 'brand_logo' | 'partner_logo';

export interface OverlayItem {
  id: string;
  assetId?: string | null;
  uploadedUrl?: string | null;
  type: OverlayType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  variant?: 'default' | 'white';
  locked?: boolean;
  anchor?: OverlayAnchor;
  zIndex?: number;
  visible?: boolean;
  label?: string | null;
}

export type RegulatoryTextColor = 'white' | 'black';

export type RegulatoryOrientation = 'horizontal' | 'vertical';

export interface RegulatoryBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number; // fractional relative to canvas height (e.g. 0.02 = 2%)
  anchor?: OverlayAnchor;
  color?: RegulatoryTextColor; // cor do texto (default: branco)
  orientation?: RegulatoryOrientation; // sentido do texto (default: horizontal)
  visible?: boolean;
}

export interface MediaCompositionSlide {
  sourceUrl: string;
  outputUrl?: string | null;
  overlays: OverlayItem[];
  regulatory?: RegulatoryBlock | null;
}

export interface MediaComposition {
  slides: MediaCompositionSlide[];
}

export type ApproverType = 'internal' | 'external';

export type ApprovalAction = 'approved' | 'changes_requested';

export type IntegrationType = 'slack' | 'whatsapp' | 'instagram_api' | 'n8n';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface SocialPost {
  id: string;
  workspace_id: string;
  title: string;
  content?: string;
  excerpt?: string;
  status: PostStatus;
  channels: SocialChannel[];
  media_urls: string[];
  base_media_urls?: string[];
  rendered_media_urls?: string[] | null;
  media_composition?: MediaComposition | null;
  image_urls?: string[];
  thumbnail_url?: string;
  regulatory_notes?: string | null;
  scheduled_at?: string;
  published_at?: string;
  author_id?: string;
  approval_token?: string;
  n8n_workflow_id?: string;
  has_ab_test?: boolean;
  company?: string;
  origem?: string | null;
  pauta_id?: number | null;
  pauta_titulo?: string | null;
  tags?: string[];
  connection_ids?: string[];
  // SEO fields
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  og_image_url?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  author_name?: string;
  workspace_name?: string;
  workspace_logo_url?: string;
  connection_profiles?: Array<{ channel: string; name: string; avatar_url: string }>;
}

export interface BrandAsset {
  id: string;
  workspace_id: string;
  name: string;
  kind: BrandAssetKind;
  file_url: string;
  file_path: string;
  mime_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostVersion {
  id: string;
  post_id: string;
  content?: string;
  media_urls: string[];
  version_number: number;
  created_by?: string;
  created_at: string;
  // Joined fields
  author_name?: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id?: string;
  author_name?: string;
  author_email?: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface PostApproval {
  id: string;
  post_id: string;
  approver_id?: string;
  approver_email?: string;
  approver_name?: string;
  action: ApprovalAction;
  comment?: string;
  is_external: boolean;
  created_at: string;
}

export interface Approver {
  id: string;
  workspace_id: string;
  email: string;
  name: string;
  type: ApproverType;
  is_active: boolean;
  created_at: string;
}

export interface Integration {
  id: string;
  workspace_id: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// A/B Testing Types
export interface PostVariant {
  id: string;
  post_id: string;
  variant_name: string;
  content?: string;
  media_urls: string[];
  performance_score: number;
  is_winner: boolean;
  created_at: string;
  updated_at: string;
}

export interface ABTestResult {
  id: string;
  post_id: string;
  variant_id: string;
  impressions: number;
  clicks: number;
  engagements: number;
  shares: number;
  engagement_rate: number;
  recorded_at: string;
  created_at: string;
}

// Newsletter Segmentation Types
export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  segments: string[];
  preferences: Record<string, unknown>;
  engagement_score: number;
  source: string;
  is_active: boolean;
  subscribed_at: string;
}

export interface NewsletterSegment {
  id: string;
  name: string;
  description?: string;
  color: string;
  subscriber_count: number;
  created_at: string;
  updated_at: string;
}

// Dashboard Stats
export interface DashboardStats {
  drafts: number;
  pendingApproval: number;
  approved: number;
  scheduled: number;
  published: number;
}

// Filter types
export interface PostFilters {
  status?: PostStatus;
  channel?: SocialChannel;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Status configuration for UI
export const POST_STATUS_CONFIG: Record<PostStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  DRAFT: { label: 'Rascunho', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-500/20', dotColor: 'bg-slate-500 dark:bg-slate-400' },
  IN_REVIEW_INTERNAL: { label: 'Revisão Interna', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/20', dotColor: 'bg-blue-500 dark:bg-blue-400' },
  IN_REVIEW_EXTERNAL: { label: 'Revisão Externa', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-500/20', dotColor: 'bg-purple-500 dark:bg-purple-400' },
  CHANGES_REQUESTED: { label: 'Ajustes Solicitados', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/20', dotColor: 'bg-amber-500 dark:bg-amber-400' },
  APPROVED: { label: 'Aprovado', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/20', dotColor: 'bg-emerald-500 dark:bg-emerald-400' },
  SCHEDULED: { label: 'Agendado', color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-500/20', dotColor: 'bg-cyan-500 dark:bg-cyan-400' },
  PUBLISHED: { label: 'Publicado', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-500/20', dotColor: 'bg-green-500 dark:bg-green-400' },
};

export const CHANNEL_CONFIG: Record<SocialChannel, { label: string; color: string; bgColor: string }> = {
  instagram: { label: 'Instagram', color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-500/20' },
  facebook: { label: 'Facebook', color: 'text-blue-600 dark:text-blue-500', bgColor: 'bg-blue-500/20' },
  linkedin: { label: 'LinkedIn', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-500/20' },
  twitter: { label: 'X (Twitter)', color: 'text-white', bgColor: 'bg-[#000000]' },
  blog: { label: 'Blog', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/20' },
};

// Post Template types
export interface PostTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  content?: string | null;
  excerpt?: string | null;
  channels: SocialChannel[];
  category?: string | null;
  tags: string[];
  media_urls: string[];
  is_public?: boolean;
  usage_count?: number;
  created_at: string;
  updated_at: string;
}

export type TemplateCategory = 'lancamento' | 'promocao' | 'data_comemorativa' | 'engajamento' | 'institucional' | 'outro';

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'promocao', label: 'Promoção' },
  { value: 'data_comemorativa', label: 'Data Comemorativa' },
  { value: 'engajamento', label: 'Engajamento' },
  { value: 'institucional', label: 'Institucional' },
  { value: 'outro', label: 'Outro' },
];
