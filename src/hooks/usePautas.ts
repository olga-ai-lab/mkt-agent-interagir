import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePautaMarca, normalizePautaStatus, type PautaStatus } from "@/lib/agenda-editorial";

export interface Pauta {
  id: number;
  titulo: string;
  briefing: string | null;
  link_referencia: string | null;
  status: PautaStatus;
  data_criacao: string | null;
  data_prevista: string | null;
  plataforma: string | null;
  marca: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePautaInput {
  titulo: string;
  briefing: string;
  link_referencia?: string;
  observacoes?: string;
  data_prevista?: string;
  plataforma?: string;
  marca?: "livo" | "livonius";
  status?: PautaStatus;
}

// Status em que a pauta ainda pertence a equipe (editavel/removivel). "erro"
// entra aqui porque o agente passou a marcar falhas com esse status em vez de
// devolver para "pendente".
const EDITABLE_STATUSES = ["pendente", "erro"];

export function usePautas() {
  const [pautas, setPautas] = useState<Pauta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPautas = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("mkt_pautas")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      if (!options?.silent) {
        toast({ title: "Erro", description: "Não foi possível carregar as pautas.", variant: "destructive" });
      }
    } else {
      setPautas(
        (data || []).map((item) => ({
          ...item,
          status: normalizePautaStatus(item.status),
        })),
      );
    }
    if (!options?.silent) setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPautas();
  }, [fetchPautas]);

  // Enquanto houver alguma pauta "processando", revalida em background (silencioso,
  // sem re-acionar o loading): o agente roda fora do request e conclui minutos
  // depois — sem isso, o status só atualiza na tela quando o usuário dá refresh.
  useEffect(() => {
    const hasProcessing = pautas.some((p) => p.status === "processando");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchPautas({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [pautas, fetchPautas]);

  const createPauta = async (input: CreatePautaInput) => {
    const { data, error: createError } = await supabase
      .from("mkt_pautas")
      .insert({
        titulo: input.titulo,
        briefing: input.briefing,
        link_referencia: input.link_referencia || null,
        observacoes: input.observacoes || null,
        data_prevista: input.data_prevista || null,
        plataforma: input.plataforma || null,
        marca: normalizePautaMarca(input.marca, input.titulo),
        status: "pendente",
      })
      .select()
      .single();

    if (createError) throw createError;
    const normalizedData = { ...data, status: normalizePautaStatus(data.status) };
    setPautas((prev) => [normalizedData, ...prev]);
    return normalizedData;
  };

  const updatePauta = async (input: {
    id: number;
    titulo: string;
    briefing: string;
    link_referencia?: string;
    observacoes?: string;
    data_prevista?: string;
    plataforma?: string;
    marca?: "livo" | "livonius";
  }) => {
    const { data, error: updateError } = await supabase
      .from("mkt_pautas")
      .update({
        titulo: input.titulo,
        briefing: input.briefing,
        link_referencia: input.link_referencia || null,
        observacoes: input.observacoes || null,
        data_prevista: input.data_prevista || null,
        plataforma: input.plataforma || null,
        marca: normalizePautaMarca(input.marca, input.titulo),
      })
      .eq("id", input.id)
      // Pautas com falha tambem sao editaveis: ajustar e redisparar e o unico
      // caminho de recuperacao de uma pauta em "erro".
      .in("status", EDITABLE_STATUSES)
      .select()
      .single();

    if (updateError) throw updateError;
    const normalizedData = { ...data, status: normalizePautaStatus(data.status) };
    setPautas((prev) => prev.map((p) => (p.id === input.id ? normalizedData : p)));
    return normalizedData;
  };

  const deletePauta = async (id: number) => {
    const { error: deleteError } = await supabase
      .from("mkt_pautas")
      .delete()
      .eq("id", id)
      .in("status", EDITABLE_STATUSES);

    if (deleteError) throw deleteError;
    setPautas((prev) => prev.filter((p) => p.id !== id));
  };

  const importPautas = async (rows: CreatePautaInput[]) => {
    const insertData = rows.map((r) => ({
      titulo: r.titulo,
      briefing: r.briefing || "",
      link_referencia: r.link_referencia || null,
      observacoes: r.observacoes || null,
      data_prevista: r.data_prevista || null,
      plataforma: r.plataforma || null,
      marca: normalizePautaMarca(r.marca, r.titulo),
      status: normalizePautaStatus(r.status) || "pendente",
    }));

    const { data, error: importError } = await supabase
      .from("mkt_pautas")
      .insert(insertData)
      .select();

    if (importError) throw importError;
    const normalizedData = (data || []).map((item) => ({
      ...item,
      status: normalizePautaStatus(item.status),
    }));
    setPautas((prev) => [...normalizedData, ...prev]);
    return normalizedData;
  };

  const triggerPautaGeneration = async (pautaId: number) => {
    const { data, error: invokeError } = await supabase.functions.invoke("mkt-trigger-agenda-pauta", {
      body: { pauta_id: pautaId },
    });

    if (invokeError) {
      // Em respostas não-2xx o supabase-js entrega um FunctionsHttpError genérico
      // ("non-2xx status code") e mantém o corpo real em .context (Response).
      // Lemos esse corpo para expor a causa de verdade (ex.: falha do webhook n8n).
      let detail = invokeError.message;
      const ctx = (invokeError as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const errBody = await ctx.json();
          if (errBody?.error) detail = errBody.error;
        } catch {
          // corpo não-JSON: mantém a mensagem padrão
        }
      }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);

    await fetchPautas();
    return data;
  };

  return { pautas, loading, error, fetchPautas, createPauta, updatePauta, deletePauta, importPautas, triggerPautaGeneration };
}
