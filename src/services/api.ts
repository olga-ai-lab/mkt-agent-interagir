// API Service for Marketing System - Connected to Supabase
import { supabase } from '@/integrations/supabase/client';
import type { 
  Workspace, 
  SocialPost, 
  PostVersion, 
  PostComment, 
  PostApproval, 
  Approver,
  BrandAsset,
  Integration,
  PostStatus,
  PostFilters,
  DashboardStats,
  ApprovalAction,
  SocialChannel
} from '@/types/marketing';

// Re-export types for convenience
export type { 
  Workspace, 
  SocialPost, 
  PostVersion, 
  PostComment, 
  PostApproval, 
  Approver,
  BrandAsset,
  Integration,
  PostStatus,
  PostFilters,
  DashboardStats,
  ApprovalAction
};

// Default workspace ID
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

type ApprovalActionRow = {
  post_id: string;
  action: string;
  created_at: string;
};

type RejectionReasonRow = {
  post_id: string;
  created_at: string;
};

function normalizeApprovalAction(action: string | null | undefined): ApprovalAction | null {
  const value = (action || '').toLowerCase().trim();
  if (value === 'approved') return 'approved';
  if (value === 'changes_requested' || value === 'changes-requested' || value === 'changes requested') {
    return 'changes_requested';
  }
  return null;
}

function statusFromApprovalAction(action: ApprovalAction): PostStatus {
  return action === 'approved' ? 'APPROVED' : 'CHANGES_REQUESTED';
}

function resolveEffectivePostStatus(current: PostStatus, latestApprovalAction?: string | null): PostStatus {
  const normalizedAction = normalizeApprovalAction(latestApprovalAction);
  if (!normalizedAction) return current;

  const derived = statusFromApprovalAction(normalizedAction);

  // Preserve terminal/published workflow states.
  if (current === 'PUBLISHED') return current;

  // If still in review workflow (or stale), reflect the most recent approval action.
  if (['DRAFT', 'IN_REVIEW_INTERNAL', 'IN_REVIEW_EXTERNAL', 'CHANGES_REQUESTED', 'APPROVED'].includes(current)) {
    return derived;
  }

  // Keep scheduled status intact unless there was an explicit change request.
  if (current === 'SCHEDULED' && derived === 'CHANGES_REQUESTED') {
    return 'CHANGES_REQUESTED';
  }

  return current;
}

function resolveEffectivePostStatusWithFallback(
  current: PostStatus,
  latestApprovalAction?: string | null,
  hasRejectionReason?: boolean
): PostStatus {
  const fromApproval = resolveEffectivePostStatus(current, latestApprovalAction);

  // If an explicit approval action is available, it wins.
  if (normalizeApprovalAction(latestApprovalAction)) {
    return fromApproval;
  }

  // Fallback: if the post is still in review but already has rejection feedback,
  // keep it as CHANGES_REQUESTED to avoid masking reviewer feedback.
  if (
    hasRejectionReason &&
    (fromApproval === 'IN_REVIEW_INTERNAL' || fromApproval === 'IN_REVIEW_EXTERNAL')
  ) {
    return 'CHANGES_REQUESTED';
  }

  return fromApproval;
}

async function getLatestApprovalActionByPostId(postIds: string[]): Promise<Map<string, string>> {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];
  if (uniquePostIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('mkt_post_approvals')
    .select('post_id, action, created_at')
    .in('post_id', uniquePostIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching latest approval actions:', error);
    return new Map();
  }

  const latestByPostId = new Map<string, string>();
  for (const row of (data || []) as ApprovalActionRow[]) {
    if (!latestByPostId.has(row.post_id)) {
      latestByPostId.set(row.post_id, row.action);
    }
  }

  return latestByPostId;
}

async function getLatestRejectionReasonByPostId(postIds: string[]): Promise<Map<string, string>> {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];
  if (uniquePostIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('mkt_rejection_reasons')
    .select('post_id, created_at')
    .in('post_id', uniquePostIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching latest rejection reasons:', error);
    return new Map();
  }

  const latestByPostId = new Map<string, string>();
  for (const row of (data || []) as RejectionReasonRow[]) {
    if (!latestByPostId.has(row.post_id)) {
      latestByPostId.set(row.post_id, row.created_at);
    }
  }

  return latestByPostId;
}

async function enrichPostsWithPautaTitle<T extends { pauta_id?: number | null }>(
  posts: T[],
): Promise<Array<T & { pauta_titulo?: string | null }>> {
  const pautaIds = [...new Set(posts.map((post) => post.pauta_id).filter((value): value is number => Number.isInteger(value) && value > 0))];

  if (pautaIds.length === 0) {
    return posts.map((post) => ({
      ...post,
      pauta_titulo: null,
    }));
  }

  const { data: pautas, error } = await supabase
    .from('mkt_pautas')
    .select('id, titulo')
    .in('id', pautaIds);

  if (error) {
    console.error('Error fetching pauta titles:', error);
    return posts.map((post) => ({
      ...post,
      pauta_titulo: null,
    }));
  }

  const pautaMap = new Map((pautas || []).map((pauta) => [pauta.id, pauta.titulo]));

  return posts.map((post) => ({
    ...post,
    pauta_titulo: post.pauta_id ? pautaMap.get(post.pauta_id) || null : null,
  }));
}

function mapSocialPostRow(post: any): SocialPost {
  return {
    ...post,
    channels: (post.channels || []) as SocialChannel[],
    status: post.status as PostStatus,
    media_urls: post.media_urls || [],
    base_media_urls: post.base_media_urls || post.media_urls || [],
    rendered_media_urls: post.rendered_media_urls || post.media_urls || [],
    media_composition: (post.media_composition as SocialPost['media_composition']) || { slides: [] },
    regulatory_notes: post.regulatory_notes || null,
  };
}

// Workspaces
export async function getWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('mkt_workspaces')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching workspaces:', error);
    return [];
  }
  
  return data || [];
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('mkt_workspaces')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching workspace:', error);
    return null;
  }
  
  return data;
}

export async function updateWorkspace(id: string, workspaceData: Partial<Workspace>): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('mkt_workspaces')
    .update({
      name: workspaceData.name,
      logo_url: workspaceData.logo_url,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating workspace:', error);
    return null;
  }
  
  return data;
}

// Dashboard Stats
export async function getDashboardStats(workspaceId: string): Promise<DashboardStats> {
  const { data: posts, error } = await supabase
    .from('mkt_social_posts')
    .select('id, status, published_at')
    .eq('workspace_id', workspaceId);
  
  if (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      drafts: 0,
      pendingApproval: 0,
      approved: 0,
      scheduled: 0,
      published: 0,
    };
  }

  const latestApprovalByPostId = await getLatestApprovalActionByPostId((posts || []).map((p) => p.id));
  const latestRejectionByPostId = await getLatestRejectionReasonByPostId((posts || []).map((p) => p.id));

  const effectivePosts = (posts || []).map((post) => ({
    ...post,
    status: resolveEffectivePostStatusWithFallback(
      post.status as PostStatus,
      latestApprovalByPostId.get(post.id),
      latestRejectionByPostId.has(post.id)
    ),
  }));
  
  return {
    drafts: effectivePosts.filter(p => p.status === 'DRAFT').length || 0,
    pendingApproval: effectivePosts.filter(p => 
      p.status === 'IN_REVIEW_INTERNAL' || p.status === 'IN_REVIEW_EXTERNAL'
    ).length || 0,
    approved: effectivePosts.filter(p => p.status === 'APPROVED').length || 0,
    scheduled: effectivePosts.filter(p => p.status === 'SCHEDULED').length || 0,
    published: effectivePosts.filter(p => p.status === 'PUBLISHED').length || 0,
  };
}

// Posts
export async function getPosts(workspaceId: string, filters?: PostFilters): Promise<SocialPost[]> {
  let query = supabase
    .from('mkt_social_posts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (filters?.channel) {
    query = query.contains('channels', [filters.channel]);
  }
  
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching posts:', error);
    return [];
  }

  const latestApprovalByPostId = await getLatestApprovalActionByPostId((data || []).map((post) => post.id));
  const latestRejectionByPostId = await getLatestRejectionReasonByPostId((data || []).map((post) => post.id));
  const postsWithEffectiveStatus = (data || []).map((post) => ({
    ...post,
    status: resolveEffectivePostStatusWithFallback(
      post.status as PostStatus,
      latestApprovalByPostId.get(post.id),
      latestRejectionByPostId.has(post.id)
    ),
  }));

  const statusFilteredPosts = filters?.status
    ? postsWithEffectiveStatus.filter((post) => post.status === filters.status)
    : postsWithEffectiveStatus;

  const enrichedPosts = await enrichPostsWithPautaTitle(statusFilteredPosts);

  const mapped = enrichedPosts.map(post => ({
    ...mapSocialPostRow(post),
    author_name: null,
  }));

  // Sort: published posts by published_at, all others by created_at — both descending.
  // Editing a post never changes its position; only publishing does.
  return mapped.sort((a, b) => {
    const dateA = a.status === 'PUBLISHED' && a.published_at
      ? new Date(a.published_at).getTime()
      : new Date(a.created_at).getTime();
    const dateB = b.status === 'PUBLISHED' && b.published_at
      ? new Date(b.published_at).getTime()
      : new Date(b.created_at).getTime();
    return dateB - dateA;
  });
}

export async function getPost(id: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching post:', error);
    return null;
  }

  if (!data) return null;

  const latestApprovalByPostId = await getLatestApprovalActionByPostId([data.id]);
  const latestRejectionByPostId = await getLatestRejectionReasonByPostId([data.id]);
  const postWithEffectiveStatus = {
    ...data,
    status: resolveEffectivePostStatusWithFallback(
      data.status as PostStatus,
      latestApprovalByPostId.get(data.id),
      latestRejectionByPostId.has(data.id)
    ),
  };
  const [enrichedPost] = await enrichPostsWithPautaTitle([postWithEffectiveStatus]);

  return mapSocialPostRow(enrichedPost);
}

export async function createPost(postData: Partial<SocialPost>): Promise<SocialPost> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .insert({
      workspace_id: postData.workspace_id || DEFAULT_WORKSPACE_ID,
      title: postData.title || 'Novo Post',
      content: postData.content || '',
      excerpt: postData.excerpt || '',
      status: 'DRAFT' as const,
      channels: (postData.channels || []) as any,
      media_urls: postData.media_urls || [],
      base_media_urls: postData.base_media_urls || postData.media_urls || [],
      rendered_media_urls: postData.rendered_media_urls || postData.media_urls || [],
      media_composition: (postData.media_composition || { slides: [] }) as any,
      regulatory_notes: postData.regulatory_notes || null,
      scheduled_at: postData.scheduled_at,
      author_id: postData.author_id,
      company: postData.company || 'livonius',
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating post:', error);
    throw error;
  }
  
  return mapSocialPostRow(data);
}

export async function updatePost(id: string, postData: Partial<SocialPost>): Promise<SocialPost | null> {
  // Whitelist apenas colunas reais da tabela social_posts.
  // Campos auxiliares como `connection_ids` não existem na tabela e quebrariam o UPDATE inteiro.
  const allowed = [
    'title', 'content', 'excerpt', 'status', 'channels', 'media_urls',
    'scheduled_at', 'published_at', 'author_id', 'has_ab_test',
    'seo_title', 'seo_description', 'seo_keywords', 'og_image_url',
    'instagram_media_id', 'linkedin_post_urn', 'facebook_post_id',
    'company', 'tags', 'image_urls', 'thumbnail_url', 'origem', 'pauta_id',
    'base_media_urls', 'rendered_media_urls', 'media_composition', 'regulatory_notes',
  ] as const;

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in (postData as any)) {
      payload[key] = key === 'media_composition'
        ? ((postData as any)[key] || { slides: [] })
        : (postData as any)[key];
    }
  }

  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating post:', error);
    throw new Error(error.message || 'Falha ao atualizar post');
  }
  
  return data ? mapSocialPostRow(data) : null;
}

export async function deletePost(id: string, reason?: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('mkt_social_posts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
      delete_reason: reason || null,
    } as any)
    .eq('id', id);

  if (error) {
    console.error('Error soft-deleting post:', error);
    return false;
  }

  return true;
}

export async function restorePost(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('mkt_social_posts')
    .update({ deleted_at: null, deleted_by: null, delete_reason: null } as any)
    .eq('id', id);

  if (error) {
    console.error('Error restoring post:', error);
    return false;
  }

  return true;
}

export async function hardDeletePost(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('mkt_social_posts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error hard-deleting post:', error);
    return false;
  }

  return true;
}

export async function getDeletedPosts(workspaceId: string): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted posts:', error);
    return [];
  }

  return (data || []).map(post => ({
    ...mapSocialPostRow(post),
    author_name: null,
  }));
}

export async function sendToApproval(id: string, type: 'internal' | 'external'): Promise<SocialPost | null> {
  const newStatus: PostStatus = type === 'internal' ? 'IN_REVIEW_INTERNAL' : 'IN_REVIEW_EXTERNAL';
  
  // Get current post to create version
  const currentPost = await getPost(id);
  if (!currentPost) return null;
  
  // Get latest version number
  const { data: versions } = await supabase
    .from('mkt_post_versions')
    .select('version_number')
    .eq('post_id', id)
    .order('version_number', { ascending: false })
    .limit(1);
  
  const nextVersion = (versions?.[0]?.version_number || 0) + 1;
  
  // Create new version
  await supabase
    .from('mkt_post_versions')
    .insert({
      post_id: id,
      content: currentPost.content,
      media_urls: currentPost.media_urls,
      version_number: nextVersion,
    });
  
  // Update post status
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update({ status: newStatus })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error sending to approval:', error);
    return null;
  }
  
  return data ? mapSocialPostRow(data) : null;
}

export async function approvePost(id: string, comment?: string): Promise<SocialPost | null> {
  // Create approval record
  await supabase
    .from('mkt_post_approvals')
    .insert({
      post_id: id,
      action: 'approved' as const,
      comment,
      is_external: false,
    });
  
  // Update post status
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update({ status: 'APPROVED' as const })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error approving post:', error);
    return null;
  }
  
  return data ? mapSocialPostRow(data) : null;
}

export async function requestChanges(
  id: string, 
  reasons: string[], 
  comment?: string,
  workspaceId: string = DEFAULT_WORKSPACE_ID
): Promise<SocialPost | null> {
  // Get post data for context
  const { data: postData } = await supabase
    .from('mkt_social_posts')
    .select('content, channels')
    .eq('id', id)
    .single();

  // Create rejection_reasons record for AI analysis
  await supabase
    .from('mkt_rejection_reasons')
    .insert({
      post_id: id,
      workspace_id: workspaceId,
      reasons: reasons,
      additional_comment: comment,
      post_content: postData?.content || null,
      channel: postData?.channels?.[0] || null,
    });

  // Create approval record
  const fullComment = comment 
    ? `Motivos: ${reasons.join(', ')}. ${comment}`
    : `Motivos: ${reasons.join(', ')}`;
    
  await supabase
    .from('mkt_post_approvals')
    .insert({
      post_id: id,
      action: 'changes_requested' as const,
      comment: fullComment,
      is_external: false,
    });
  
  // Add comment
  await supabase
    .from('mkt_post_comments')
    .insert({
      post_id: id,
      content: fullComment,
      is_internal: true,
    });
  
  // Update post status
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update({ status: 'CHANGES_REQUESTED' as const })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error requesting changes:', error);
    return null;
  }

  // Auto-trigger rejection analysis to update AI prompts
  try {
    await supabase.functions.invoke('mkt-analyze-rejections', {
      body: { workspace_id: workspaceId }
    });
    console.log('Auto-analysis triggered for rejections');
  } catch (err) {
    // Don't block the main flow if analysis fails
    console.error('Failed to trigger auto-analysis:', err);
  }
  
  return data ? mapSocialPostRow(data) : null;
}

export async function schedulePost(id: string, scheduledAt: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update({ 
      status: 'SCHEDULED' as const,
      scheduled_at: scheduledAt 
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error scheduling post:', error);
    return null;
  }
  
  return data ? mapSocialPostRow(data) : null;
}

// Cancel schedule - returns post to DRAFT
export async function cancelSchedule(id: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update({ 
      status: 'DRAFT' as const,
      scheduled_at: null 
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error canceling schedule:', error);
    return null;
  }
  
  return data ? mapSocialPostRow(data) : null;
}

// Reschedule post - update scheduled_at
export async function reschedulePost(id: string, newScheduledAt: string): Promise<SocialPost | null> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .update({ 
      scheduled_at: newScheduledAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error rescheduling post:', error);
    return null;
  }
  
  return data ? mapSocialPostRow(data) : null;
}

// Post Versions
export async function getPostVersions(postId: string): Promise<PostVersion[]> {
  const { data, error } = await supabase
    .from('mkt_post_versions')
    .select('*')
    .eq('post_id', postId)
    .order('version_number', { ascending: false });
  
  if (error) {
    console.error('Error fetching post versions:', error);
    return [];
  }
  
  return (data || []).map(v => ({
    ...v,
    media_urls: v.media_urls || [],
  }));
}

// Post Comments
export async function getPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('mkt_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching post comments:', error);
    return [];
  }
  
  return data || [];
}

export async function addComment(postId: string, content: string, isInternal: boolean = true): Promise<PostComment> {
  const { data, error } = await supabase
    .from('mkt_post_comments')
    .insert({
      post_id: postId,
      content,
      is_internal: isInternal,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
  
  return data;
}

// Post Approvals
export async function getPostApprovals(postId: string): Promise<PostApproval[]> {
  const { data, error } = await supabase
    .from('mkt_post_approvals')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching post approvals:', error);
    return [];
  }
  
  return (data || []).map(a => ({
    ...a,
    action: a.action as ApprovalAction,
  }));
}

// External Approval (public access via token) - uses database function
export async function getPostByToken(token: string): Promise<SocialPost | null> {
  const { data, error } = await (supabase as any).rpc('mkt_get_post_by_token', { _token: token });

  if (error || !data || data.length === 0) {
    console.error('Error fetching post by token:', error);
    return null;
  }

  const post = data[0];
  return {
    id: post.id,
    workspace_id: '',
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    status: post.status as PostStatus,
    channels: (post.channels || []) as SocialChannel[],
    media_urls: post.media_urls || [],
    image_urls: post.image_urls || [],
    thumbnail_url: post.thumbnail_url || undefined,
    scheduled_at: post.scheduled_at,
    workspace_name: post.workspace_name,
    created_at: post.created_at || '',
    updated_at: '',
    tags: post.tags || [],
    workspace_logo_url: post.workspace_logo_url || undefined,
    connection_profiles: post.connection_profiles || [],
  };
}

export async function submitExternalApproval(
  token: string,
  action: ApprovalAction | 'scheduled',
  comment?: string,
  approverName?: string,
  approverEmail?: string,
  scheduledAt?: string
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('mkt_submit_external_approval', {
    _token: token,
    _action: action,
    _comment: comment || null,
    _approver_name: approverName || null,
    _approver_email: approverEmail || null,
    _scheduled_at: scheduledAt || null,
  });
  
  if (error) {
    console.error('Error submitting external approval:', error);
    return false;
  }
  
  return data === true;
}

// Calendar
export async function getCalendarPosts(
  workspaceId: string, 
  startDate: string, 
  endDate: string
): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from('mkt_social_posts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .or(`scheduled_at.gte.${startDate},published_at.gte.${startDate}`)
    .or(`scheduled_at.lte.${endDate},published_at.lte.${endDate}`);
  
  if (error) {
    console.error('Error fetching calendar posts:', error);
    return [];
  }

  const latestApprovalByPostId = await getLatestApprovalActionByPostId((data || []).map((post) => post.id));
  const latestRejectionByPostId = await getLatestRejectionReasonByPostId((data || []).map((post) => post.id));

  return (data || []).map(post => ({
    ...mapSocialPostRow({
      ...post,
      status: resolveEffectivePostStatusWithFallback(
      post.status as PostStatus,
      latestApprovalByPostId.get(post.id),
      latestRejectionByPostId.has(post.id)
      ) as PostStatus,
    }),
  }));
}

// Approvers
export async function getApprovers(workspaceId: string): Promise<Approver[]> {
  const { data, error } = await supabase
    .from('mkt_approvers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching approvers:', error);
    return [];
  }
  
  return (data || []).map(a => ({
    ...a,
    type: a.type as 'internal' | 'external',
  }));
}

export async function addApprover(approverData: Partial<Approver>): Promise<Approver> {
  const { data, error } = await supabase
    .from('mkt_approvers')
    .insert({
      workspace_id: approverData.workspace_id || DEFAULT_WORKSPACE_ID,
      email: approverData.email || '',
      name: approverData.name || '',
      type: approverData.type || 'internal',
      is_active: true,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error adding approver:', error);
    throw error;
  }
  
  return {
    ...data,
    type: data.type as 'internal' | 'external',
  };
}

export async function updateApprover(id: string, approverData: Partial<Approver>): Promise<Approver | null> {
  const { data, error } = await supabase
    .from('mkt_approvers')
    .update(approverData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating approver:', error);
    return null;
  }
  
  return data ? {
    ...data,
    type: data.type as 'internal' | 'external',
  } : null;
}

export async function deleteApprover(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('mkt_approvers')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting approver:', error);
    return false;
  }
  
  return true;
}

// Integrations
export async function getIntegrations(workspaceId: string): Promise<Integration[]> {
  const { data, error } = await supabase
    .from('mkt_integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching integrations:', error);
    return [];
  }
  
  return (data || []).map(i => ({
    ...i,
    type: i.type as Integration['type'],
    config: (i.config || {}) as Record<string, unknown>,
  }));
}

export async function updateIntegration(id: string, integrationData: Partial<Integration>): Promise<Integration | null> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  
  if (integrationData.is_active !== undefined) updateData.is_active = integrationData.is_active;
  if (integrationData.config !== undefined) updateData.config = integrationData.config as object;
  if (integrationData.type !== undefined) updateData.type = integrationData.type;
  
  const { data, error } = await supabase
    .from('mkt_integrations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating integration:', error);
    return null;
  }
  
  return data ? {
    ...data,
    type: data.type as Integration['type'],
    config: (data.config || {}) as Record<string, unknown>,
  } : null;
}

export async function createIntegration(integrationData: Partial<Integration>): Promise<Integration> {
  const { data, error } = await supabase
    .from('mkt_integrations')
    .insert([{
      workspace_id: integrationData.workspace_id || DEFAULT_WORKSPACE_ID,
      type: integrationData.type as 'instagram_api' | 'n8n' | 'slack' | 'whatsapp',
      is_active: integrationData.is_active ?? true,
      config: JSON.parse(JSON.stringify(integrationData.config || {})),
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error creating integration:', error);
    throw error;
  }
  
  return {
    ...data,
    type: data.type as Integration['type'],
    config: (data.config || {}) as Record<string, unknown>,
  };
}

export async function deleteIntegration(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('mkt_integrations')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting integration:', error);
    return false;
  }
  
  return true;
}

// Brand assets
export async function listBrandAssets(workspaceId: string, kind?: BrandAsset['kind']): Promise<BrandAsset[]> {
  let query = (supabase as any)
    .from('brand_assets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (kind) {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching brand assets:', error);
    const message = error.message || '';
    if (/brand_assets/i.test(message) && /(schema cache|does not exist|could not find the table)/i.test(message)) {
      throw error;
    }
    return [];
  }

  return (data || []) as unknown as BrandAsset[];
}

export async function createBrandAsset(assetData: Omit<BrandAsset, 'id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean }): Promise<BrandAsset> {
  const { data, error } = await (supabase as any)
    .from('brand_assets')
    .insert({
      workspace_id: assetData.workspace_id,
      name: assetData.name,
      kind: assetData.kind,
      file_url: assetData.file_url,
      file_path: assetData.file_path,
      mime_type: assetData.mime_type,
      is_active: assetData.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating brand asset:', error);
    throw error;
  }

  return data as unknown as BrandAsset;
}

export async function archiveBrandAsset(id: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from('brand_assets')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error archiving brand asset:', error);
    return false;
  }

  return true;
}

// Consolidated API object for easier imports
export const api = {
  getWorkspaces,
  getWorkspace,
  updateWorkspace,
  getDashboardStats,
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  restorePost,
  hardDeletePost,
  getDeletedPosts,
  sendToApproval,
  approvePost,
  requestChanges,
  schedulePost,
  cancelSchedule,
  reschedulePost,
  getPostVersions,
  getPostComments,
  addComment,
  getPostApprovals,
  getPostByToken,
  submitExternalApproval,
  getCalendarPosts,
  getApprovers,
  addApprover,
  updateApprover,
  deleteApprover,
  getIntegrations,
  updateIntegration,
  createIntegration,
  deleteIntegration,
  listBrandAssets,
  createBrandAsset,
  archiveBrandAsset,
};
