import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PostOriginBadgeProps {
  origem?: string | null;
}

function getOriginConfig(origem?: string | null): { label: string; className: string } {
  const normalized = (origem || "").trim().toLowerCase();

  if (normalized === "agenda_editorial") {
    return {
      label: "Pauta",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
    };
  }

  if (normalized === "manual" || normalized === "arquivo" || normalized.startsWith("arquivo_")) {
    return {
      label: "Arquivo",
      className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
    };
  }

  if (normalized === "rss" || normalized === "n8n" || normalized.includes("rss")) {
    return {
      label: "Auto",
      className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300",
    };
  }

  return {
    label: "Auto",
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  };
}

export function PostOriginBadge({ origem }: PostOriginBadgeProps) {
  const config = getOriginConfig(origem);

  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", config.className)}>
      {config.label}
    </Badge>
  );
}
