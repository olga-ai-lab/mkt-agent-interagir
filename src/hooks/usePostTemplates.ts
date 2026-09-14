import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PostTemplate, SocialChannel } from '@/types/marketing';
import { toast } from 'sonner';

// Fetch all templates for a workspace
export function usePostTemplates(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['post-templates', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      
      const { data, error } = await supabase
        .from('mkt_post_templates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('usage_count', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        channels: (t.channels || []) as SocialChannel[],
        tags: t.tags || [],
        media_urls: t.media_urls || [],
      })) as PostTemplate[];
    },
    enabled: !!workspaceId,
  });
}

// Fetch template by ID
export function usePostTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['post-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      
      const { data, error } = await supabase
        .from('mkt_post_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        channels: (data.channels || []) as SocialChannel[],
        tags: data.tags || [],
        media_urls: data.media_urls || [],
      } as PostTemplate;
    },
    enabled: !!templateId,
  });
}

// Create template
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (template: Partial<PostTemplate>) => {
      const { data, error } = await supabase
        .from('mkt_post_templates')
        .insert({
          workspace_id: template.workspace_id!,
          name: template.name!,
          description: template.description,
          content: template.content,
          excerpt: template.excerpt,
          channels: (template.channels || []) as any,
          category: template.category,
          tags: template.tags || [],
          media_urls: template.media_urls || [],
          is_public: template.is_public || false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-templates', data.workspace_id] });
      toast.success('Template criado com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast.error('Erro ao criar template');
    },
  });
}

// Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...template }: Partial<PostTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('mkt_post_templates')
        .update({
          name: template.name,
          description: template.description,
          content: template.content,
          excerpt: template.excerpt,
          channels: template.channels as any,
          category: template.category,
          tags: template.tags,
          media_urls: template.media_urls,
          is_public: template.is_public,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['post-templates', data.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ['post-template', data.id] });
      toast.success('Template atualizado!');
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast.error('Erro ao atualizar template');
    },
  });
}

// Delete template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const { error } = await supabase
        .from('mkt_post_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id, workspaceId };
    },
    onSuccess: ({ workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ['post-templates', workspaceId] });
      toast.success('Template excluído!');
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template');
    },
  });
}

// Increment usage count when template is used
export function useUseTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (templateId: string) => {
      // First get current count
      const { data: template, error: fetchError } = await supabase
        .from('mkt_post_templates')
        .select('usage_count, workspace_id')
        .eq('id', templateId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabase
        .from('mkt_post_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', templateId);
      
      if (error) throw error;
      return template.workspace_id;
    },
    onSuccess: (workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['post-templates', workspaceId] });
    },
  });
}
