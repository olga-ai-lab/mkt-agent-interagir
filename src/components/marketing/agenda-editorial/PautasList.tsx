import { useMemo, useState } from "react";
import { Search, Plus, Eye, Pencil, Trash2, Instagram, Facebook, Linkedin, BookOpen, Zap, Loader2, Mail, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PautaStatusBadge } from "./PautaStatusBadge";
import { parsePautaObservacoes, normalizePautaStatus, type PautaStatus } from "@/lib/agenda-editorial";
import type { Pauta } from "@/hooks/usePautas";

type SortOption =
  | "criacao_desc"
  | "criacao_asc"
  | "processada_desc"
  | "data_prevista_desc"
  | "data_prevista_asc";

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: "criacao_desc", label: "Criação: mais recentes" },
  { key: "criacao_asc", label: "Criação: mais antigos" },
  { key: "processada_desc", label: "Processadas recentemente" },
  { key: "data_prevista_desc", label: "Data prevista: mais recente" },
  { key: "data_prevista_asc", label: "Data prevista: mais próxima" },
];

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function sortPautas(list: Pauta[], sortBy: SortOption): Pauta[] {
  const withNullsLast = (a: number | null, b: number | null, ascending: boolean) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return ascending ? a - b : b - a;
  };

  return [...list].sort((a, b) => {
    switch (sortBy) {
      case "criacao_asc":
        return withNullsLast(toTime(a.created_at), toTime(b.created_at), true);
      case "processada_desc":
        return withNullsLast(toTime(a.updated_at), toTime(b.updated_at), false);
      case "data_prevista_desc":
        return withNullsLast(toTime(a.data_prevista), toTime(b.data_prevista), false);
      case "data_prevista_asc":
        return withNullsLast(toTime(a.data_prevista), toTime(b.data_prevista), true);
      case "criacao_desc":
      default:
        return withNullsLast(toTime(a.created_at), toTime(b.created_at), false);
    }
  });
}

interface PautasListProps {
  pautas: Pauta[];
  loading: boolean;
  onCreateClick: () => void;
  onPautaClick: (pauta: Pauta) => void;
  onDeleteClick?: (pauta: Pauta) => void;
  onGenerateClick?: (pauta: Pauta) => Promise<void> | void;
  generatingPautaId?: number | null;
}

const channelIcons: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  instagram: { icon: Instagram, color: "text-pink-500", label: "Instagram" },
  facebook: { icon: Facebook, color: "text-blue-600", label: "Facebook" },
  linkedin: { icon: Linkedin, color: "text-sky-700", label: "LinkedIn" },
  blog: { icon: BookOpen, color: "text-emerald-600", label: "Blog" },
  newsletter: { icon: Mail, color: "text-amber-600", label: "Newsletter" },
};

const STATUS_FILTERS: Array<{ key: "todos" | PautaStatus; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "pendente", label: "Pendentes" },
  { key: "processando", label: "Processando" },
  { key: "gerado", label: "Gerados" },
  { key: "publicado", label: "Publicados" },
  { key: "erro", label: "Erros" },
];

function normalizeChannels(plataforma: string): string[] {
  const tokens = plataforma
    .toLowerCase()
    .replace(/\se\s/g, ",")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  const mapped = tokens
    .map((token) => {
      if (token.includes("insta")) return "instagram";
      if (token.includes("face")) return "facebook";
      if (token.includes("linked")) return "linkedin";
      if (token.includes("blog")) return "blog";
      if (token.includes("news")) return "newsletter";
      return null;
    })
    .filter((item): item is "blog" | "facebook" | "instagram" | "linkedin" | "newsletter" => Boolean(item));

  return Array.from(new Set(mapped));
}

function ChannelBadges({ plataforma }: { plataforma: string | null }) {
  if (!plataforma) return <span className="text-muted-foreground text-xs">-</span>;
  const channels = normalizeChannels(plataforma);
  if (channels.length === 0) return <span className="text-muted-foreground text-xs">-</span>;

  return (
    <div className="flex gap-1">
      {channels.map((ch) => {
        const cfg = channelIcons[ch];
        if (!cfg) return null;
        const Icon = cfg.icon;
        return (
          <Tooltip key={ch}>
            <TooltipTrigger asChild>
              <span className={cfg.color}><Icon className="h-4 w-4" /></span>
            </TooltipTrigger>
            <TooltipContent>{cfg.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function PautasList({ pautas, loading, onCreateClick, onPautaClick, onDeleteClick, onGenerateClick, generatingPautaId = null }: PautasListProps) {
  const [filtroStatus, setFiltroStatus] = useState<"todos" | PautaStatus>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("criacao_desc");

  const filtered = pautas.filter((p) => {
    const normalizedStatus = normalizePautaStatus(p.status);
    if (filtroStatus !== "todos" && normalizedStatus !== filtroStatus) return false;
    if (searchQuery && !p.titulo.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sortedFiltered = useMemo(() => sortPautas(filtered, sortBy), [filtered, sortBy]);

  const counts = {
    todos: pautas.length,
    pendente: pautas.filter((p) => normalizePautaStatus(p.status) === "pendente").length,
    processando: pautas.filter((p) => normalizePautaStatus(p.status) === "processando").length,
    gerado: pautas.filter((p) => normalizePautaStatus(p.status) === "gerado").length,
    publicado: pautas.filter((p) => normalizePautaStatus(p.status) === "publicado").length,
    erro: pautas.filter((p) => normalizePautaStatus(p.status) === "erro").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pauta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={filtroStatus === f.key ? "default" : "outline"}
              onClick={() => setFiltroStatus(f.key)}
              className="h-8 text-xs"
            >
              {f.label} ({counts[f.key]})
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={onCreateClick} className="h-8">
            <Plus className="h-4 w-4 mr-1" /> Nova Pauta
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[28%]">Titulo</TableHead>
              <TableHead className="w-[22%]">Briefing</TableHead>
              <TableHead className="w-[10%]">Marca</TableHead>
              <TableHead className="w-[10%]">Canais</TableHead>
              <TableHead className="w-[12%]">Data Prevista</TableHead>
              <TableHead className="w-[10%]">Status</TableHead>
              <TableHead className="w-[8%] text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : sortedFiltered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Nenhuma pauta encontrada
                </TableCell>
              </TableRow>
            ) : (
              sortedFiltered.map((pauta) => {
                const normalizedStatus = normalizePautaStatus(pauta.status);
                const stuckProcessing =
                  normalizedStatus === "processando" &&
                  !!pauta.updated_at &&
                  Date.now() - new Date(pauta.updated_at).getTime() > 15 * 60 * 1000;
                const canGenerate =
                  normalizedStatus === "pendente" || normalizedStatus === "erro" || stuckProcessing;
                const isEditable = normalizedStatus === "pendente" || normalizedStatus === "erro";
                const motivoFalha = parsePautaObservacoes(pauta.observacoes).falha;
                const isGenerating = generatingPautaId === pauta.id;
                const isGenerateDisabled = !canGenerate || isGenerating;
                return (
                  <TableRow
                    key={pauta.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => onPautaClick(pauta)}
                  >
                    <TableCell className="font-medium truncate max-w-[250px]">{pauta.titulo}</TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                      {pauta.briefing ? (pauta.briefing.length > 60 ? `${pauta.briefing.slice(0, 60)}...` : pauta.briefing) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">{pauta.marca === "livonius" ? "Livonius" : "Livo"}</TableCell>
                    <TableCell><ChannelBadges plataforma={pauta.plataforma} /></TableCell>
                    <TableCell className="text-sm">{formatDate(pauta.data_prevista)}</TableCell>
                    <TableCell>
                      {motivoFalha ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <PautaStatusBadge status={normalizedStatus} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">{motivoFalha}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <PautaStatusBadge status={normalizedStatus} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); onPautaClick(pauta); }}
                            >
                              {isEditable ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isEditable ? "Editar" : "Ver"}</TooltipContent>
                        </Tooltip>
                        {onGenerateClick && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-primary hover:text-primary"
                                disabled={isGenerateDisabled}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onGenerateClick(pauta);
                                }}
                              >
                                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isGenerating
                                  ? "Disparando..."
                                  : stuckProcessing
                                    ? "Travado ha mais de 15 min - Reenviar geracao"
                                    : canGenerate
                                      ? "Gerar agora"
                                      : "Disponivel apenas para pautas pendentes, com erro ou travadas"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isEditable && onDeleteClick && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDeleteClick(pauta); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
