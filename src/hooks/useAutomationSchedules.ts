import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AutomationSchedule {
  id: string;
  workflow_name: string;
  display_name: string;
  description: string | null;
  interval_value: number;
  interval_unit: string;
  is_active: boolean;
  posts_generated_this_week: number;
  runs_this_week: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAutomationSchedules() {
  const [schedules, setSchedules] = useState<AutomationSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("automation_schedules")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSchedules(data || []);
    } catch (err) {
      console.error("Erro ao buscar schedules:", err);
      toast({ title: "Erro", description: "Não foi possível carregar as automações.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const updateSchedule = async (workflowName: string, updates: Partial<Pick<AutomationSchedule, "interval_value" | "interval_unit" | "is_active">>) => {
    const { error } = await supabase
      .from("automation_schedules")
      .update(updates)
      .eq("workflow_name", workflowName);
    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
      throw error;
    }
    await fetchSchedules();
  };

  return { schedules, loading, fetchSchedules, updateSchedule };
}
