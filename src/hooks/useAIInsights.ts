import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  AIPostInsight,
  AITrendPlaybook,
  AIContentSuggestion,
  AIPromptAdjustment,
  RejectionReason,
} from '@/types/ai-insights';

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

// Fetch post insights with analytics data
export function usePostInsights(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  return useQuery({
    queryKey: ['ai-post-insights', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mkt_ai_post_insights')
        .select(`
          *,
          social_posts!inner (
            id,
            title,
            content,
            channels,
            status,
            media_urls,
            published_at,
            created_at
          )
        `)
        .eq('workspace_id', workspaceId)
        .order('performance_score', { ascending: false });

      if (error) throw error;
      return data as (AIPostInsight & { social_posts: any })[];
    },
  });
}

// Fetch trend playbook
export function useTrendPlaybook(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  return useQuery({
    queryKey: ['ai-trend-playbook', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mkt_ai_trend_playbook')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) throw error;
      return data as AITrendPlaybook | null;
    },
  });
}

// Update playbook
export function useUpdatePlaybook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, updates }: { workspaceId: string; updates: Partial<AITrendPlaybook> }) => {
      const { data, error } = await supabase
        .from('mkt_ai_trend_playbook')
        .upsert({
          workspace_id: workspaceId,
          prompt_master: updates.prompt_master,
          do_list: updates.do_list,
          dont_list: updates.dont_list,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-trend-playbook', variables.workspaceId] });
    },
  });
}

// Fetch content suggestions
export function useContentSuggestions(workspaceId: string = DEFAULT_WORKSPACE_ID, status?: string) {
  return useQuery({
    queryKey: ['ai-content-suggestions', workspaceId, status],
    queryFn: async () => {
      let query = supabase
        .from('mkt_ai_content_suggestions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('confidence', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AIContentSuggestion[];
    },
  });
}

// Update suggestion status
export function useUpdateSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, created_post_id }: { id: string; status: string; created_post_id?: string }) => {
      const { data, error } = await supabase
        .from('mkt_ai_content_suggestions')
        .update({ status, created_post_id })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-content-suggestions'] });
    },
  });
}

// Fetch prompt adjustments
export function usePromptAdjustments(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  return useQuery({
    queryKey: ['ai-prompt-adjustments', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mkt_ai_prompt_adjustments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) throw error;
      return data as AIPromptAdjustment | null;
    },
  });
}

// Fetch rejection reasons for a post
export function useRejectionReasons(postId?: string) {
  return useQuery({
    queryKey: ['rejection-reasons', postId],
    queryFn: async () => {
      if (!postId) return [];

      const { data, error } = await supabase
        .from('mkt_rejection_reasons')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RejectionReason[];
    },
    enabled: !!postId,
  });
}

// Get posts with analytics for ranking
export function usePostsWithAnalytics(workspaceId: string = DEFAULT_WORKSPACE_ID, days: number = 30) {
  return useQuery({
    queryKey: ['posts-with-analytics', workspaceId, days],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: posts, error: postsError } = await supabase
        .from('mkt_social_posts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'PUBLISHED')
        .gte('published_at', startDate.toISOString())
        .order('published_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch analytics for these posts
      const postIds = posts?.map((p) => p.id) || [];
      if (postIds.length === 0) return [];

      const { data: analytics, error: analyticsError } = await supabase
        .from('mkt_post_analytics')
        .select('*')
        .in('post_id', postIds);

      if (analyticsError) throw analyticsError;

      // Fetch insights
      const { data: insights, error: insightsError } = await supabase
        .from('mkt_ai_post_insights')
        .select('*')
        .in('post_id', postIds);

      if (insightsError) throw insightsError;

      // Combine data
      return posts?.map((post) => ({
        ...post,
        analytics: analytics?.filter((a) => a.post_id === post.id) || [],
        insight: insights?.find((i) => i.post_id === post.id) || null,
      }));
    },
  });
}

// Trigger AI analysis for a post
export function useAnalyzePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, workspaceId }: { postId: string; workspaceId: string }) => {
      const { data, error } = await supabase.functions.invoke('mkt-ai-insights-analyze', {
        body: { post_id: postId, workspace_id: workspaceId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-post-insights'] });
      queryClient.invalidateQueries({ queryKey: ['posts-with-analytics'] });
    },
  });
}

// Generate new content suggestions
export function useGenerateSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      const { data, error } = await supabase.functions.invoke('mkt-ai-generate-suggestions', {
        body: { workspace_id: workspaceId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-content-suggestions'] });
    },
  });
}

// Analyze all posts in batch
export function useAnalyzeAllPosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, postIds }: { workspaceId: string; postIds: string[] }) => {
      // Analyze posts in batches of 5 to avoid overwhelming the API
      const batchSize = 5;
      let analyzed = 0;

      for (let i = 0; i < postIds.length; i += batchSize) {
        const batch = postIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(postId =>
            supabase.functions.invoke('mkt-ai-insights-analyze', {
              body: { post_id: postId, workspace_id: workspaceId },
            })
          )
        );
        analyzed += batch.length;
      }

      return { analyzed };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-post-insights'] });
      queryClient.invalidateQueries({ queryKey: ['ai-trend-playbook'] });
      queryClient.invalidateQueries({ queryKey: ['posts-with-analytics'] });
    },
  });
}

// Generate Prompt Master via AI
export function useGeneratePromptMaster() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      const { data, error } = await supabase.functions.invoke('mkt-generate-prompt-master', {
        body: { workspace_id: workspaceId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-trend-playbook'] });
    },
  });
}
