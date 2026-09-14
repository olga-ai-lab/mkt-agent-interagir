import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { REJECTION_REASONS, type RejectionReasonKey } from '@/types/ai-insights';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RequestChangesModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reasons: string[], comment?: string) => Promise<void>;
  isLoading?: boolean;
}

export function RequestChangesModal({
  open,
  onClose,
  onConfirm,
  isLoading,
}: RequestChangesModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<RejectionReasonKey[]>([]);
  const [comment, setComment] = useState('');

  const handleToggleReason = (key: RejectionReasonKey) => {
    setSelectedReasons((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  };

  const handleConfirm = async () => {
    if (selectedReasons.length === 0) return;
    await onConfirm(selectedReasons, comment.trim() || undefined);
    setSelectedReasons([]);
    setComment('');
  };

  const handleClose = () => {
    setSelectedReasons([]);
    setComment('');
    onClose();
  };

  const categories = {
    LEGENDA: REJECTION_REASONS.filter((r) => r.category === 'LEGENDA'),
    IMAGEM: REJECTION_REASONS.filter((r) => r.category === 'IMAGEM'),
    GERAL: REJECTION_REASONS.filter((r) => r.category === 'GERAL'),
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Solicitar Ajustes
          </DialogTitle>
          <DialogDescription>
            Selecione os motivos e adicione um comentário opcional.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Legenda */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-primary">
                Legenda / Texto
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {categories.LEGENDA.map((reason) => (
                  <div
                    key={reason.key}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleReason(reason.key)}
                  >
                    <Checkbox
                      id={reason.key}
                      checked={selectedReasons.includes(reason.key)}
                      onCheckedChange={() => handleToggleReason(reason.key)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={reason.key}
                      className="text-sm cursor-pointer leading-tight"
                    >
                      {reason.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Imagem */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-primary">
                Imagem / Visual
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {categories.IMAGEM.map((reason) => (
                  <div
                    key={reason.key}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleReason(reason.key)}
                  >
                    <Checkbox
                      id={reason.key}
                      checked={selectedReasons.includes(reason.key)}
                      onCheckedChange={() => handleToggleReason(reason.key)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={reason.key}
                      className="text-sm cursor-pointer leading-tight"
                    >
                      {reason.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Geral */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-primary">Geral</Label>
              <div className="grid grid-cols-2 gap-2">
                {categories.GERAL.map((reason) => (
                  <div
                    key={reason.key}
                    className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleReason(reason.key)}
                  >
                    <Checkbox
                      id={reason.key}
                      checked={selectedReasons.includes(reason.key)}
                      onCheckedChange={() => handleToggleReason(reason.key)}
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={reason.key}
                      className="text-sm cursor-pointer leading-tight"
                    >
                      {reason.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Comentário adicional */}
            <div className="space-y-2">
              <Label htmlFor="changes-comment">Comentário adicional (opcional)</Label>
              <Textarea
                id="changes-comment"
                placeholder="Descreva detalhes adicionais sobre os ajustes necessários..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={isLoading}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {selectedReasons.length} motivo(s) selecionado(s)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedReasons.length === 0 || isLoading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isLoading ? 'Enviando...' : 'Solicitar Ajustes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
