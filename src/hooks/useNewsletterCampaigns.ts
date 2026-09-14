import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

export interface NewsletterCampaign {
  id: string;
  workspace_id: string;
  subject: string;
  content: string | null;
  segments: string[];
  status: "draft" | "scheduled" | "sending" | "sent" | "sent_with_errors" | "failed";
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export function useNewsletterCampaigns(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  return useQuery({
    queryKey: ["newsletter-campaigns", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as NewsletterCampaign[];
    },
  });
}

export function useCampaign(id: string | null, workspaceId: string = DEFAULT_WORKSPACE_ID) {
  return useQuery({
    queryKey: ["newsletter-campaign", id, workspaceId],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select("*")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .single();

      if (error) throw error;
      return data as NewsletterCampaign;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: {
      subject: string;
      content?: string;
      segments?: string[];
      workspace_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .insert({
          workspace_id: campaign.workspace_id || DEFAULT_WORKSPACE_ID,
          subject: campaign.subject,
          content: campaign.content ?? null,
          segments: campaign.segments || [],
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data as NewsletterCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      workspaceId,
    }: {
      id: string;
      data: Partial<Pick<NewsletterCampaign, "subject" | "content" | "segments" | "scheduled_at">>;
      workspaceId?: string;
    }) => {
      const { error } = await supabase
        .from("newsletter_campaigns")
        .update(data)
        .eq("id", id)
        .eq("workspace_id", workspaceId || DEFAULT_WORKSPACE_ID);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId?: string }) => {
      const { error } = await supabase
        .from("newsletter_campaigns")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspaceId || DEFAULT_WORKSPACE_ID);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async (params: {
      campaign_id: string;
      subject: string;
      content: string;
      segments: string[];
      test_email: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("mkt-send-newsletter", {
        body: {
          campaign_id: params.campaign_id,
          subject: params.subject,
          content: params.content,
          segments: params.segments,
          test_email: params.test_email,
        },
      });
      if (error) throw new Error(error.message || "Falha ao enviar email de teste");
      return data;
    },
  });
}

export function useSendCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: {
      id: string;
      subject: string;
      content: string;
      segments: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("mkt-send-newsletter", {
        body: {
          campaign_id: campaign.id,
          subject: campaign.subject,
          content: campaign.content,
          segments: campaign.segments,
        },
      });

      if (error) {
        const context = (error as any)?.context;
        const contextText = context ? ` | ${JSON.stringify(context)}` : "";
        throw new Error(`${error.message || "Failed to send newsletter"}${contextText}`);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-campaigns"] });
    },
  });
}
