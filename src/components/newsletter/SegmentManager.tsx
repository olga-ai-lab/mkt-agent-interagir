import { useState } from "react";
import { Plus, Trash2, Edit2, Users, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { NewsletterSegment } from "@/types/marketing";

interface SegmentManagerProps {
  segments: NewsletterSegment[];
  onCreateSegment: (segment: Omit<NewsletterSegment, "id" | "created_at" | "updated_at" | "subscriber_count">) => Promise<void>;
  onUpdateSegment: (id: string, data: Partial<NewsletterSegment>) => Promise<void>;
  onDeleteSegment: (id: string) => Promise<void>;
  loading?: boolean;
}

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#06b6d4", // Cyan
];

export function SegmentManager({
  segments,
  onCreateSegment,
  onUpdateSegment,
  onDeleteSegment,
  loading = false,
}: SegmentManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<NewsletterSegment | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: PRESET_COLORS[0],
  });
  const [saving, setSaving] = useState(false);

  const openCreateDialog = () => {
    setEditingSegment(null);
    setFormData({ name: "", description: "", color: PRESET_COLORS[0] });
    setIsDialogOpen(true);
  };

  const openEditDialog = (segment: NewsletterSegment) => {
    setEditingSegment(segment);
    setFormData({
      name: segment.name,
      description: segment.description || "",
      color: segment.color,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do segmento é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (editingSegment) {
        await onUpdateSegment(editingSegment.id, formData);
        toast.success("Segmento atualizado!");
      } else {
        await onCreateSegment(formData);
        toast.success("Segmento criado!");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao salvar segmento");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (segment: NewsletterSegment) => {
    if (!confirm(`Remover segmento "${segment.name}"? Isso não afetará os inscritos.`)) return;
    
    try {
      await onDeleteSegment(segment.id);
      toast.success("Segmento removido!");
    } catch (error) {
      toast.error("Erro ao remover segmento");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Segmentos
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openCreateDialog} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Segmento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {segments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum segmento criado</p>
              <p className="text-xs mt-1">Crie segmentos para organizar seus inscritos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {segments.map((segment) => (
                <div
                  key={segment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <div>
                      <span className="font-medium text-foreground">{segment.name}</span>
                      {segment.description && (
                        <p className="text-xs text-muted-foreground">{segment.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {segment.subscriber_count}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(segment)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(segment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? "Editar Segmento" : "Novo Segmento"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="segment-name">Nome *</Label>
              <Input
                id="segment-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Leads Quentes, VIPs, Novos Inscritos..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment-desc">Descrição</Label>
              <Input
                id="segment-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do segmento..."
              />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color
                        ? "border-white scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : editingSegment ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
