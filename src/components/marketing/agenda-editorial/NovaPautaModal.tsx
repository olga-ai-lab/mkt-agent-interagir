import { useEffect, useState } from "react";
import { Plus, Loader2, CalendarIcon, Instagram, Facebook, Linkedin, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inferPautaMarcaFromTitulo } from "@/lib/agenda-editorial";

const CHANNELS = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500" },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-sky-700" },
  { id: "blog", label: "Blog", icon: BookOpen, color: "text-emerald-600" },
];

interface NovaPautaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pauta: {
    titulo: string;
    briefing: string;
    link_referencia?: string;
    observacoes?: string;
    data_prevista?: string;
    plataforma?: string;
    marca?: "livo" | "livonius";
  }) => Promise<void>;
}

export function NovaPautaModal({ isOpen, onClose, onSave }: NovaPautaModalProps) {
  const [form, setForm] = useState({ titulo: "", briefing: "", link_referencia: "", observacoes: "" });
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [dataPrevista, setDataPrevista] = useState<Date | undefined>();
  const [marca, setMarca] = useState<"livo" | "livonius">("livo");
  const [marcaTouched, setMarcaTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!marcaTouched) {
      setMarca(inferPautaMarcaFromTitulo(form.titulo));
    }
  }, [form.titulo, marcaTouched]);

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...form,
        plataforma: selectedChannels.length > 0 ? selectedChannels.join(",") : undefined,
        data_prevista: dataPrevista ? format(dataPrevista, "yyyy-MM-dd") : undefined,
        marca,
      });
      setForm({ titulo: "", briefing: "", link_referencia: "", observacoes: "" });
      setSelectedChannels([]);
      setDataPrevista(undefined);
      setMarca("livo");
      setMarcaTouched(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.titulo.trim() && form.briefing.trim();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Nova Pauta</DialogTitle>
          <DialogDescription>Preencha os dados da nova pauta de conteúdo</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Título *</label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Seguro de vida em 2025 — tendências" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Briefing / Descrição *</label>
            <Textarea value={form.briefing} onChange={(e) => setForm({ ...form, briefing: e.target.value })} placeholder="Descreva o ângulo desejado..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Canais</label>
              <div className="flex flex-wrap gap-3">
                {CHANNELS.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={selectedChannels.includes(ch.id)} onCheckedChange={() => toggleChannel(ch.id)} />
                    <ch.icon className={cn("h-4 w-4", ch.color)} />
                    <span className="text-sm">{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Data Prevista</label>
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
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Marca</label>
            <Select
              value={marca}
              onValueChange={(value: "livo" | "livonius") => {
                setMarca(value);
                setMarcaTouched(true);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="livo">Livo</SelectItem>
                <SelectItem value="livonius">Livonius</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Link de Referência</label>
            <Input type="url" value={form.link_referencia} onChange={(e) => setForm({ ...form, link_referencia: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Observações</label>
            <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Notas adicionais (opcional)" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Criando...</> : <><Plus className="h-4 w-4 mr-1" /> Criar Pauta</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
