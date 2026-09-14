export type PautaStatus = "pendente" | "processando" | "gerado" | "publicado" | "erro";
export type PautaMarca = "livo" | "livonius";

const LIVONIUS_HINTS = ["livonius", "rco", "casco"];

export function inferPautaMarcaFromTitulo(titulo: string): PautaMarca {
  const normalizedTitle = titulo.toLowerCase();
  return LIVONIUS_HINTS.some((hint) => normalizedTitle.includes(hint)) ? "livonius" : "livo";
}

export function normalizePautaMarca(value: string | null | undefined, tituloFallback?: string): PautaMarca {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "livo") return "livo";
  if (normalized === "livonius") return "livonius";
  return inferPautaMarcaFromTitulo(tituloFallback || "");
}

export function normalizePautaStatus(value: string | null | undefined): PautaStatus {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "processando") return "processando";
  if (normalized === "gerado") return "gerado";
  if (normalized === "publicado") return "publicado";
  if (normalized === "erro") return "erro";
  return "pendente";
}

// O agente grava o motivo da falha em `observacoes` com este prefixo
// (mkt-agent-livo, repositories/pautas.py :: mark_failed).
const AGENT_FAILURE_PREFIX = "[agente] falha:";

export interface PautaObservacoes {
  /** Nota escrita pela equipe. */
  nota: string;
  /** Motivo da falha reportado pelo agente, se houver. */
  falha: string;
}

/**
 * Separa o motivo de falha do agente da nota da equipe.
 *
 * As duas coisas dividem a coluna `observacoes`, mas têm autores e finalidades
 * diferentes: a nota é editável pela equipe, a falha é diagnóstico e precisa de
 * destaque próprio. Sem essa separação o motivo da reprovação era renderizado
 * como texto secundário no rodapé do modal e passava despercebido.
 */
export function parsePautaObservacoes(observacoes: string | null | undefined): PautaObservacoes {
  const raw = (observacoes || "").trim();
  const markerIndex = raw.indexOf(AGENT_FAILURE_PREFIX);

  if (markerIndex === -1) return { nota: raw, falha: "" };

  return {
    nota: raw.slice(0, markerIndex).trim(),
    falha: raw.slice(markerIndex + AGENT_FAILURE_PREFIX.length).trim(),
  };
}
