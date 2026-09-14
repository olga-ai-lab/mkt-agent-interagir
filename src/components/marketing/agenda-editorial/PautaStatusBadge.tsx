import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizePautaStatus } from "@/lib/agenda-editorial";

interface PautaStatusBadgeProps {
  status: string;
}

export function PautaStatusBadge({ status }: PautaStatusBadgeProps) {
  const normalized = normalizePautaStatus(status);

  const config = {
    pendente: {
      label: "Pendente",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      Icon: Clock,
      pulse: false,
    },
    processando: {
      label: "Gerando...",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      Icon: Loader2,
      pulse: true,
    },
    gerado: {
      label: "Post Gerado",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      Icon: CheckCircle2,
      pulse: false,
    },
    publicado: {
      label: "Publicado",
      className: "bg-green-800 text-green-100 dark:bg-green-900 dark:text-green-200",
      Icon: CheckCircle2,
      pulse: false,
    },
    erro: {
      label: "Erro",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      Icon: AlertCircle,
      pulse: false,
    },
  }[normalized];

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", config.className)}>
      <config.Icon className={cn("h-3 w-3", config.pulse && "animate-spin")} />
      {config.label}
    </span>
  );
}
