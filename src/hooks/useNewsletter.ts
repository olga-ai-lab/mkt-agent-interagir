import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string | null;
  subscribed_at: string;
  is_active: boolean;
  segments: string[];
  engagement_score: number;
  source: string | null;
  preferences: Record<string, unknown>;
}

export function useNewsletterSubscribers(segmentFilter?: string[]) {
  return useQuery({
    queryKey: ["newsletter-subscribers", segmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("newsletter_subscribers")
        .select("*")
        .order("subscribed_at", { ascending: false });
      
      if (segmentFilter && segmentFilter.length > 0) {
        query = query.overlaps("segments", segmentFilter);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as NewsletterSubscriber[];
    },
  });
}

export function useSubscribeNewsletter() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .insert([{ email }]);
      
      if (error) {
        if (error.code === "23505") {
          throw new Error("Este email já está inscrito na newsletter.");
        }
        throw error;
      }
      return { success: true };
    },
  });
}

export function useDeleteSubscriber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
    },
  });
}
