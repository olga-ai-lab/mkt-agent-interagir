import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceEmailSettings {
  logo_livonius_url: string;
  logo_livo_url: string;
  header_photo_url: string;
  primary_color: string;
  company_name: string;
  address: string;
  phone: string;
  site_url: string;
  instagram_url: string;
  facebook_url: string;
  linkedin_url: string;
}

const DEFAULT_SETTINGS: WorkspaceEmailSettings = {
  logo_livonius_url:
    "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email//Livonius_logo_color.png",
  logo_livo_url: "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email//LIVO_marca_color.png",
  header_photo_url:
    "https://uvwqhpesqbufjpytveti.supabase.co/storage/v1/object/public/assets-email//realistic_office_background.png",
  primary_color: "#1a6b5a",
  company_name: "Livonius MGA",
  address: "Av. Loureiro da Silva, 1940 - 12º andar - CEP 90050-240 - Porto Alegre/RS",
  phone: "(51) 3224.8555",
  site_url: "livomga.com.br",
  instagram_url: "https://www.instagram.com/livoniusmga",
  facebook_url: "https://www.facebook.com/livoniusmga",
  linkedin_url: "https://www.linkedin.com/company/livonius",
};

export function useWorkspaceEmailSettings(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-email-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<WorkspaceEmailSettings> => {
      // email_settings is added via migration; cast to bypass stale generated types
      const { data, error } = await (supabase as any)
        .from("workspaces")
        .select("email_settings")
        .eq("id", workspaceId!)
        .single();

      if (error) throw error;

      const saved = ((data as any)?.email_settings ?? {}) as Partial<WorkspaceEmailSettings>;
      return { ...DEFAULT_SETTINGS, ...saved };
    },
  });
}

export function useUpdateWorkspaceEmailSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workspaceId, settings }: { workspaceId: string; settings: WorkspaceEmailSettings }) => {
      // email_settings is added via migration; cast to bypass stale generated types
      const { error } = await (supabase as any)
        .from("workspaces")
        .update({ email_settings: settings })
        .eq("id", workspaceId);

      if (error) throw error;
    },
    onSuccess: (_, { workspaceId }) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-email-settings", workspaceId] });
    },
  });
}
