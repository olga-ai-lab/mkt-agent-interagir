import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle2, XCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 3000;
// Sem um teto, uma linha que nunca existiu (insert falhou) ou nunca é
// atualizada (agente/webhook nunca chamou de volta) deixava o banner
// "carregando" pra sempre, sem nenhum feedback — 5 minutos é bastante folga
// pro pipeline real (que normalmente termina em menos de 2 min) sem deixar
// o usuário esperando indefinidamente por algo que já não vai responder.
const MAX_POLL_MS = 5 * 60 * 1000;

const STATUS_CONFIG: Record<string, { label: string; step: number; done: boolean; error: boolean }> = {
  pending:    { label: "Aguardando processamento...",       step: 1, done: false, error: false },
  reading:    { label: "Lendo e extraindo conteúdo...",     step: 1, done: false, error: false },
  generating: { label: "Gerando post com IA...",            step: 2, done: false, error: false },
  writing:    { label: "Gerando post com IA...",            step: 2, done: false, error: false },
  saving:     { label: "Salvando post...",                  step: 3, done: false, error: false },
  done:       { label: "Post gerado com sucesso!",          step: 3, done: true,  error: false },
  completed:  { label: "Post gerado com sucesso!",          step: 3, done: true,  error: false },
  error:      { label: "Erro ao gerar post",                step: 0, done: false, error: true  },
};

const STEPS = [
  { step: 1, label: "Lendo arquivo" },
  { step: 2, label: "Gerando conteúdo" },
  { step: 3, label: "Finalizando" },
];

function getConfig(status: string) {
  return STATUS_CONFIG[status] ?? { label: `Processando (${status})...`, step: 1, done: false, error: false };
}

export function GenerationStatusBanner({ onDone }: { onDone?: () => void }) {
  const [generationId, setGenerationId] = useState<string | null>(
    () => localStorage.getItem("pending_generation_id")
  );
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    localStorage.removeItem("pending_generation_id");
    setGenerationId(null);
    setStatus(null);
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    if (!generationId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const poll = async () => {
      const { data, error } = await supabase
        .from("post_generation_status")
        .select("status, error_message")
        .eq("generation_id", generationId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("GenerationStatusBanner poll error:", error);
        setStatus("error");
        setErrorMessage(error.message);
        return; // stop polling, wait for manual dismiss
      }

      if (data) {
        setStatus(data.status);
        setErrorMessage(data.error_message ?? null);

        const cfg = getConfig(data.status);
        if (cfg.done) {
          // Keep success message briefly, then auto-dismiss
          timer = setTimeout(() => {
            if (!cancelled) {
              dismiss();
              onDone?.();
            }
          }, 4000);
          return; // stop polling
        }
        if (cfg.error) return; // stop polling, wait for manual dismiss
      }

      if (Date.now() - startedAt > MAX_POLL_MS) {
        setStatus("error");
        setErrorMessage("Tempo de espera esgotado — o processamento pode ter travado.");
        return; // stop polling, wait for manual dismiss
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [generationId, dismiss, onDone]);

  // Re-detect if localStorage changes (e.g. new generation started)
  useEffect(() => {
    const handleStorage = () => {
      const id = localStorage.getItem("pending_generation_id");
      if (id && id !== generationId) {
        setGenerationId(id);
        setStatus(null);
        setErrorMessage(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [generationId]);

  if (!generationId) return null;

  const cfg = status ? getConfig(status) : getConfig("pending");

  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center gap-4 text-sm ${
        cfg.error
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : cfg.done
          ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          : "border-primary/30 bg-primary/5 text-foreground"
      }`}
    >
      {/* Icon */}
      <div className="shrink-0">
        {cfg.error ? (
          <XCircle className="h-5 w-5 text-destructive" />
        ) : cfg.done ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <FileText className="h-5 w-5 text-primary" />
        )}
      </div>

      {/* Text + steps */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-medium">
          {!cfg.done && !cfg.error && (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          )}
          <span>{cfg.label}</span>
          {errorMessage && (
            <span className="text-xs font-normal text-destructive/80 truncate">— {errorMessage}</span>
          )}
        </div>

        {!cfg.error && (
          <div className="mt-1.5 flex items-center gap-3">
            {STEPS.map(({ step, label }) => {
              const active = cfg.step === step;
              const completed = cfg.done || cfg.step > step;
              return (
                <div key={step} className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      completed
                        ? "bg-green-500"
                        : active
                        ? "bg-primary animate-pulse"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      completed
                        ? "text-green-600 dark:text-green-400"
                        : active
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dismiss */}
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 h-7 px-2 text-xs"
        onClick={dismiss}
      >
        Fechar
      </Button>
    </div>
  );
}
