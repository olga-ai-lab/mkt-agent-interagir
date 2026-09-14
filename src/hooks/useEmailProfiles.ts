import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmailGenerationSettings } from "@/lib/emailTemplates";

export interface EmailProfile {
  id: string;
  workspace_id: string;
  name: string;
  settings: EmailGenerationSettings;
  created_at: string;
  updated_at: string;
}

// ─── Queries ────────────────────────────────────────────────

export function useEmailProfiles(workspaceId?: string) {
  return useQuery({
    queryKey: ["email-profiles", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<EmailProfile[]> => {
      const { data, error } = await (supabase as any)
        .from("mkt_email_profiles")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmailProfile[];
    },
  });
}

// ─── Mutations ───────────────────────────────────────────────

export function useCreateEmailProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      name,
      settings,
    }: {
      workspaceId: string;
      name: string;
      settings: EmailGenerationSettings;
    }): Promise<EmailProfile> => {
      const { data, error } = await (supabase as any)
        .from("mkt_email_profiles")
        .insert({ workspace_id: workspaceId, name, settings })
        .select()
        .single();
      if (error) throw error;
      return data as EmailProfile;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-profiles", data.workspace_id] });
    },
  });
}

export function useUpdateEmailProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      workspaceId,
      name,
      settings,
    }: {
      id: string;
      workspaceId: string;
      name: string;
      settings: EmailGenerationSettings;
    }): Promise<EmailProfile> => {
      const { data, error } = await (supabase as any)
        .from("mkt_email_profiles")
        .update({ name, settings })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as EmailProfile;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["email-profiles", data.workspace_id] });
    },
  });
}

export function useDeleteEmailProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      workspaceId,
    }: {
      id: string;
      workspaceId: string;
    }) => {
      const { error } = await (supabase as any)
        .from("mkt_email_profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { workspaceId };
    },
    onSuccess: ({ workspaceId }) => {
      qc.invalidateQueries({ queryKey: ["email-profiles", workspaceId] });
    },
  });
}
