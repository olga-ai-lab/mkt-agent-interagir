import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, RotateCcw, Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { usePromptVersions, useRestorePromptVersion, type PromptVersion } from '@/hooks/useAgentPrompts';
import { toast } from 'sonner';

interface PromptVersionHistoryProps {
  promptId: string;
  agentType: string;
  agentLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptVersionHistory({
  promptId,
  agentType,
  agentLabel,
  open,
  onOpenChange,
}: PromptVersionHistoryProps) {
  const { data: versions, isLoading } = usePromptVersions(promptId);
  const restoreMutation = useRestorePromptVersion();
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);

  const handleRestore = async (version: PromptVersion) => {
    try {
      await restoreMutation.mutateAsync({
        promptId,
        versionId: version.id,
      });
      toast.success('Versão restaurada com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Erro ao restaurar versão');
    }
  };

  const getChangeReasonBadge = (reason: string | null) => {
    switch (reason) {
      case 'auto_update':
        return <Badge variant="secondary" className="text-xs">Auto-Atualização</Badge>;
      case 'revert':
        return <Badge variant="outline" className="text-xs">Reversão</Badge>;
      case 'manual_edit':
      default:
        return <Badge className="text-xs">Edição Manual</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Versões - {agentLabel}
            </DialogTitle>
            <DialogDescription>
              Visualize e restaure versões anteriores do prompt
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions && versions.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {versions.map((version, index) => (
                  <div key={version.id} className="relative">
                    {index < versions.length - 1 && (
                      <div className="absolute left-3 top-8 bottom-0 w-px bg-border" />
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {version.version_number}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              Versão {version.version_number}
                            </span>
                            {getChangeReasonBadge(version.change_reason)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(version.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {version.system_prompt.substring(0, 150)}...
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingVersion(version)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Completo
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(version)}
                            disabled={restoreMutation.isPending}
                          >
                            {restoreMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-1" />
                            )}
                            Restaurar
                          </Button>
                        </div>
                      </div>
                    </div>
                    {index < versions.length - 1 && <Separator className="my-4 ml-9" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma versão anterior encontrada</p>
              <p className="text-sm">O histórico aparecerá após a primeira edição</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Full Version Dialog */}
      <Dialog open={!!viewingVersion} onOpenChange={() => setViewingVersion(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Versão {viewingVersion?.version_number} - {agentLabel}
            </DialogTitle>
            <DialogDescription>
              {viewingVersion && format(new Date(viewingVersion.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {viewingVersion?.change_reason && ` • ${
                viewingVersion.change_reason === 'auto_update' ? 'Auto-Atualização' :
                viewingVersion.change_reason === 'revert' ? 'Reversão' : 'Edição Manual'
              }`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Textarea
              value={viewingVersion?.system_prompt || ''}
              readOnly
              className="min-h-[350px] font-mono text-sm resize-none"
            />
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setViewingVersion(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (viewingVersion) {
                  handleRestore(viewingVersion);
                  setViewingVersion(null);
                }
              }}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Restaurar Esta Versão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
