import { useEffect, useState } from "react";
import { Edit2, Save, CheckCircle2, ExternalLink, FileText, MessageSquare, Globe, Eye, Loader2, CalendarIcon, Instagram, Facebook, Linkedin, BookOpen, Zap, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PautaStatusBadge } from "./PautaStatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { inferPautaMarcaFromTitulo, parsePautaObservacoes } from "@/lib/agenda-editorial";
import type { Pauta } from "@/hooks/usePautas";

const CHANNELS = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-sky-700" },
  { id: "blog", label: "Blog", icon: BookOpen, color: "text-emerald-600" },
];

interface PautaDetailModalProps {
  pauta: Pauta | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (pauta: {
    id: number;
    titulo: string;
    briefing: string;
    link_referencia?: string;
    observacoes?: string;
    data_prevista?: string;
    plataforma?: string;
    marca?: "livo" | "livonius";
  }) => Promise<void>;
  onGenerateClick?: (pauta: Pauta) => Promise<void> | void;
  generating?: boolean;
}

export function PautaDetailModal({ pauta, isOpen, onClose, onSave, onGenerateClick, generating = false }: PautaDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ titulo: "", briefing: "", link_referencia: "", observacoes: "" });
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [dataPrevista, setDataPrevista] = useState<Date | undefined>();
  const [marca, setMarca] = useState<"livo" | "livonius">("livo");
  const [saving, setSaving] = useState(false);
  const [generatedPostId, setGeneratedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!pauta) return;

    setForm({
      titulo: pauta.titulo || "",
      briefing: pauta.briefing || "",
      link_referencia: pauta.link_referencia || "",
      observacoes: parsePautaObservacoes(pauta.observacoes).nota,
    });
    setSelectedChannels(pauta.plataforma ? pauta.plataforma.split(",").map((c) => c.trim()).filter(Boolean) : []);
    setDataPrevista(pauta.data_prevista ? new Date(pauta.data_prevista + "T00:00:00") : undefined);
    setMarca((pauta.marca === "livonius" || pauta.marca === "livo") ? pauta.marca : inferPautaMarcaFromTitulo(pauta.titulo || ""));
    setGeneratedPostId(null);
    setIsEditing(false);
  }, [pauta]);

  useEffect(() => {
    const loadGeneratedPost = async () => {
      if (!pauta || pauta.status !== "gerado") return;

      const { data, error } = await supabase
        .from("social_posts")
        .select("id")
        .eq("pauta_id", pauta.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error) {
        setGeneratedPostId(data?.id || null);
      }
    };

    if (isOpen) {
      loadGeneratedPost();
    }
  }, [isOpen, pauta]);

  if (!pauta) return null;

  // Pautas com falha precisam ser editaveis: o fluxo de recuperacao e ajustar a
  // pauta e disparar de novo. Travar a edicao em "pendente" deixaria a pauta em
  // "erro" sem saida pela UI.
  const isEditable = pauta.status === "pendente" || pauta.status === "erro";
  const stuckProcessing =
    pauta.status === "processando" &&
    !!pauta.updated_at &&
    Date.now() - new Date(pauta.updated_at).getTime() > 15 * 60 * 1000;
  const canGenerate =
    pauta.status === "pendente" || pauta.status === "erro" || stuckProcessing;
  const { nota: notaEquipe, falha: motivoFalha } = parsePautaObservacoes(pauta.observacoes);

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: pauta.id,
        ...form,
        plataforma: selectedChannels.length > 0 ? selectedChannels.join(",") : undefined,
        data_prevista: dataPrevista ? format(dataPrevista, "yyyy-MM-dd") : undefined,
        marca,
      });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      titulo: pauta.titulo || "",
      briefing: pauta.briefing || "",
      link_referencia: pauta.link_referencia || "",
      observacoes: parsePautaObservacoes(pauta.observacoes).nota,
    });
    setSelectedChannels(pauta.plataforma ? pauta.plataforma.split(",").map((c) => c.trim()).filter(Boolean) : []);
    setDataPrevista(pauta.data_prevista ? new Date(pauta.data_prevista + "T00:00:00") : undefined);
    setMarca((pauta.marca === "livonius" || pauta.marca === "livo") ? pauta.marca : inferPautaMarcaFromTitulo(pauta.titulo || ""));
    setIsEditing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PautaStatusBadge status={pauta.status} />
              <span className="text-xs text-muted-foreground">
                Criado em {new Date(pauta.data_criacao).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {isEditable && !isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto flex-1 py-2">
          {motivoFalha && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex gap-2.5"
            >
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">Falha na ultima geracao</p>
                <p className="text-sm text-destructive/90 mt-1 whitespace-pre-wrap break-words">
                  {motivoFalha}
                </p>
                {canGenerate && (
                  <p className="text-xs text-destructive/70 mt-2">
                    Ajuste a pauta e use "Gerar agora" para tentar de novo.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              <FileText className="w-3.5 h-3.5" /> Titulo
            </label>
            {isEditing ? (
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="text-lg font-semibold" />
            ) : (
              <p className="text-lg font-semibold text-foreground">{pauta.titulo}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              <MessageSquare className="w-3.5 h-3.5" /> Briefing / Descricao
            </label>
            {isEditing ? (
              <Textarea value={form.briefing} onChange={(e) => setForm({ ...form, briefing: e.target.value })} rows={4} />
            ) : (
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                {pauta.briefing || <span className="italic">Nao preenchido</span>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Canais
              </label>
              {isEditing ? (
                <div className="flex flex-wrap gap-3">
                  {CHANNELS.map((ch) => (
                    <label key={ch.id} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox checked={selectedChannels.includes(ch.id)} onCheckedChange={() => toggleChannel(ch.id)} />
                      <ch.icon className={cn("h-4 w-4", ch.color)} />
                      <span className="text-sm">{ch.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex gap-2 items-center">
                  {selectedChannels.length > 0 ? (
                    selectedChannels.map((ch) => {
                      const cfg = CHANNELS.find((c) => c.id === ch);
                      if (!cfg) return null;
                      return (
                        <span key={ch} className="flex items-center gap-1 text-sm">
                          <cfg.icon className={cn("h-4 w-4", cfg.color)} /> {cfg.label}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-muted-foreground italic text-sm">Nenhum canal</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <CalendarIcon className="w-3.5 h-3.5" /> Data Prevista
              </label>
              {isEditing ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !dataPrevista && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPrevista ? format(dataPrevista, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataPrevista} onSelect={setDataPrevista} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="text-sm">
                  {dataPrevista ? format(dataPrevista, "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground italic">Nao definida</span>}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Marca
            </label>
            {isEditing ? (
              <Select value={marca} onValueChange={(value: "livo" | "livonius") => setMarca(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a marca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="livo">Livo</SelectItem>
                  <SelectItem value="livonius">Livonius</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{marca === "livonius" ? "Livonius" : "Livo"}</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              <Globe className="w-3.5 h-3.5" /> Link de Referencia
            </label>
            {isEditing ? (
              <Input type="url" value={form.link_referencia} onChange={(e) => setForm({ ...form, link_referencia: e.target.value })} placeholder="https://..." />
            ) : pauta.link_referencia ? (
              <a href={pauta.link_referencia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline break-all">
                {pauta.link_referencia} <ExternalLink className="w-4 h-4 flex-shrink-0" />
              </a>
            ) : (
              <p className="text-muted-foreground italic">Nao preenchido</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              <Eye className="w-3.5 h-3.5" /> Observacoes
            </label>
            {isEditing ? (
              <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Notas adicionais..." />
            ) : (
              <p className="text-muted-foreground">
                {notaEquipe || <span className="italic">Nao preenchido</span>}
              </p>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="border-t border-border pt-4 flex justify-end gap-3 flex-shrink-0">
            <Button variant="ghost" onClick={handleCancel}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.titulo || !form.briefing || saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Salvando...</> : <><Save className="h-4 w-4 mr-1" /> Salvar</>}
            </Button>
          </div>
        )}

        {!isEditing && pauta.status === "gerado" && generatedPostId && (
          <div className="border-t border-border pt-4 flex justify-end flex-shrink-0">
            <Button asChild variant="outline">
              <Link to={`/app/posts/${generatedPostId}`}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Ver Post
              </Link>
            </Button>
          </div>
        )}

        {!isEditing && canGenerate && onGenerateClick && (
          <div className="border-t border-border pt-4 flex justify-end gap-3 flex-shrink-0">
            <Button onClick={() => void onGenerateClick(pauta)} disabled={generating}>
              {generating
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Disparando...</>
                  : stuckProcessing
                    ? <><Zap className="h-4 w-4 mr-1" /> Reenviar geracao</>
                    : <><Zap className="h-4 w-4 mr-1" /> Gerar agora</>}
            </Button>
          </div>
        )}

        {!isEditing && !isEditable && (
          <div className="border-t border-border pt-4 flex-shrink-0 bg-emerald-50 dark:bg-emerald-950/20 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Esta pauta nao pode mais ser editada.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
