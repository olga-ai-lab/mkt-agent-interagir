import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostVariant, ABTestResult } from "@/types/marketing";

export function usePostVariants(postId: string) {
  return useQuery({
    queryKey: ["post-variants", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_post_variants")
        .select("*")
        .eq("post_id", postId)
        .order("variant_name");

      if (error) throw error;
      return data as PostVariant[];
    },
    enabled: !!postId,
  });
}

export function useABTestResults(postId: string) {
  return useQuery({
    queryKey: ["ab-test-results", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_ab_test_results")
        .select("*")
        .eq("post_id", postId)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      return data as ABTestResult[];
    },
    enabled: !!postId,
  });
}

export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variant: Omit<PostVariant, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("mkt_post_variants")
        .insert({
          post_id: variant.post_id,
          variant_name: variant.variant_name,
          content: variant.content,
          media_urls: variant.media_urls,
          performance_score: variant.performance_score,
          is_winner: variant.is_winner,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["post-variants", data.post_id] });
    },
  });
}

export function useUpdateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, postId, data }: { id: string; postId: string; data: Partial<PostVariant> }) => {
      const { error } = await supabase
        .from("mkt_post_variants")
        .update(data)
        .eq("id", id);

      if (error) throw error;
      return { postId };
    },
    onSuccess: ({ postId }) => {
      queryClient.invalidateQueries({ queryKey: ["post-variants", postId] });
    },
  });
}

export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, postId }: { id: string; postId: string }) => {
      const { error } = await supabase
        .from("mkt_post_variants")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { postId };
    },
    onSuccess: ({ postId }) => {
      queryClient.invalidateQueries({ queryKey: ["post-variants", postId] });
    },
  });
}

export function useSaveVariants() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, variants }: { postId: string; variants: PostVariant[] }) => {
      // First, delete existing variants for this post
      await supabase
        .from("mkt_post_variants")
        .delete()
        .eq("post_id", postId);

      // Then, insert new variants (if any)
      if (variants.length > 0) {
        const variantsToInsert = variants.map((v) => ({
          post_id: postId,
          variant_name: v.variant_name,
          content: v.content,
          media_urls: v.media_urls,
          performance_score: v.performance_score || 0,
          is_winner: v.is_winner || false,
        }));

        const { error } = await supabase
          .from("mkt_post_variants")
          .insert(variantsToInsert);

        if (error) throw error;
      }

      // Update post has_ab_test flag
      await supabase
        .from("mkt_social_posts")
        .update({ has_ab_test: variants.length > 0 })
        .eq("id", postId);

      return { postId };
    },
    onSuccess: ({ postId }) => {
      queryClient.invalidateQueries({ queryKey: ["post-variants", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
