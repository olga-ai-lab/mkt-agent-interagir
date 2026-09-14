import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NewsletterSegment } from "@/types/marketing";

export function useNewsletterSegments() {
  return useQuery({
    queryKey: ["newsletter-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mkt_newsletter_segments")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as NewsletterSegment[];
    },
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (segment: Omit<NewsletterSegment, "id" | "created_at" | "updated_at" | "subscriber_count">) => {
      const { data, error } = await supabase
        .from("mkt_newsletter_segments")
        .insert(segment)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-segments"] });
    },
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NewsletterSegment> }) => {
      const { error } = await supabase
        .from("mkt_newsletter_segments")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-segments"] });
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mkt_newsletter_segments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-segments"] });
    },
  });
}

export function useUpdateSubscriberSegments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriberId, segments }: { subscriberId: string; segments: string[] }) => {
      const { error } = await supabase
        .from("mkt_newsletter_subscribers")
        .update({ segments })
        .eq("id", subscriberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-segments"] });
    },
  });
}
