import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";

interface ImageFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onAccept: () => void;
  onRegenerate: (feedback: string) => void;
  isRegenerating?: boolean;
}

const MIN_FEEDBACK_LENGTH = 10;

export function ImageFeedbackDialog({
  open,
  onOpenChange,
  imageUrl,
  onAccept,
  onRegenerate,
  isRegenerating = false,
}: ImageFeedbackDialogProps) {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleAccept = () => {
    setShowFeedbackInput(false);
    setFeedback("");
    onAccept();
  };

  const handleReject = () => {
    setShowFeedbackInput(true);
  };

  const handleRegenerate = () => {
    if (feedback.trim().length >= MIN_FEEDBACK_LENGTH) {
      onRegenerate(feedback.trim());
      setFeedback("");
      setShowFeedbackInput(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setShowFeedbackInput(false);
      setFeedback("");
    }
    onOpenChange(open);
  };

  const canRegenerate = feedback.trim().length >= MIN_FEEDBACK_LENGTH;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Imagem Gerada</DialogTitle>
          <DialogDescription>
            {showFeedbackInput
              ? "Descreva o que gostaria de mudar na imagem"
              : "O que você achou da imagem gerada?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            <img
              src={imageUrl}
              alt="Imagem gerada"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Feedback Input */}
          {showFeedbackInput && (
            <div className="space-y-2">
              <Label htmlFor="feedback">
                Por que não gostou? (mínimo {MIN_FEEDBACK_LENGTH} caracteres)
              </Label>
              <Textarea
                id="feedback"
                placeholder="Ex: A imagem está muito escura, preciso de cores mais vibrantes e um fundo mais clean..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                disabled={isRegenerating}
              />
              <p className="text-xs text-muted-foreground">
                {feedback.length}/{MIN_FEEDBACK_LENGTH} caracteres mínimos
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!showFeedbackInput ? (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isRegenerating}
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                Não gostei
              </Button>
              <Button onClick={handleAccept} disabled={isRegenerating}>
                <ThumbsUp className="mr-2 h-4 w-4" />
                Gostei, usar esta
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setShowFeedbackInput(false)}
                disabled={isRegenerating}
              >
                Voltar
              </Button>
              <Button
                onClick={handleRegenerate}
                disabled={!canRegenerate || isRegenerating}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRegenerating ? "animate-spin" : ""}`} />
                {isRegenerating ? "Regenerando..." : "Gerar nova imagem"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
