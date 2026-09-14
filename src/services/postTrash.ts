import { supabase } from '@/integrations/supabase/client';
import type { SocialPost, PostStatus, SocialChannel } from '@/types/marketing';

function mapTrashPostRow(post: any): SocialPost {
  return {
    ...post,
    channels: (post.channels || []) as SocialChannel[],
    status: post.status as PostStatus,
    media_urls: post.media_urls || [],
    base_media_urls: post.base_media_urls || post.media_urls || [],
    rendered_media_urls: post.rendered_media_urls || post.media_urls || [],
    media_composition: (post.media_composition as SocialPost['media_composition']) || { slides: [] },
    regulatory_notes: post.regulatory_notes || null,
    author_name: null,
  };
}

export async function deletePost(id: string, reason?: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await (supabase as any)
    .from('mkt_social_posts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
      delete_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error soft-deleting post:', error);
    return false;
  }

  return !!data?.id;
}

export async function restorePost(id: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('mkt_social_posts')
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error restoring post:', error);
    return false;
  }

  return !!data?.id;
}

export async function hardDeletePost(id: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('mkt_social_posts')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Error hard-deleting post:', error);
    return false;
  }

  return !!data?.id;
}

export async function getDeletedPosts(workspaceId: string): Promise<SocialPost[]> {
  const { data, error } = await (supabase as any)
    .from('mkt_social_posts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching deleted posts:', error);
    return [];
  }

  return (data || []).map(mapTrashPostRow);
}
