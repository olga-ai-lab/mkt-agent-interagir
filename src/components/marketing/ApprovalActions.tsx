import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SocialPost, SocialChannel } from '@/types/marketing';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApprovalModal, ApprovalData } from './ApprovalModal';
import { RequestChangesModal } from './RequestChangesModal';
import { ScheduledPostModal } from './ScheduledPostModal';
import { Check, AlertTriangle, ExternalLink, Copy, CheckCheck, Clock, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalActionsProps {
  post: SocialPost;
  onApprove: (channels: SocialChannel[], scheduledAt?: string, comment?: string, connectionIds?: string[]) => Promise<void>;
  onRequestChanges: (reasons: string[], comment?: string) => Promise<void>;
  onSendToExternalApproval: () => Promise<string>;
  onPostUpdated?: () => void;
  isLoading?: boolean;
}

export function ApprovalActions({
  post,
  onApprove,
  onRequestChanges,
  onSendToExternalApproval,
  onPostUpdated,
  isLoading,
}: ApprovalActionsProps) {
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [externalLink, setExternalLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleApprove = async (data: ApprovalData) => {
    setActionLoading('approve');
    try {
      let scheduledAt: string | undefined;
      if (data.scheduleForLater && data.scheduledAt && data.scheduledTime) {
        const [hours, minutes] = data.scheduledTime.split(':');
        const scheduled = new Date(data.scheduledAt);
        scheduled.setHours(parseInt(hours), parseInt(minutes));
        scheduledAt = scheduled.toISOString();
      }

      await onApprove(data.channels, scheduledAt, data.comment, data.connection_ids);
      setShowApprovalModal(false);
      toast.success('Post aprovado com sucesso!');
    } catch (error) {
      toast.error('Erro ao aprovar post');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestChanges = async (reasons: string[], comment?: string) => {
    setActionLoading('changes');
    try {
      await onRequestChanges(reasons, comment);
      setShowChangesModal(false);
      toast.success('Solicitação de ajustes enviada!');
    } catch (error) {
      toast.error('Erro ao solicitar ajustes');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendToExternal = async () => {
    setActionLoading('external');
    try {
      const link = await onSendToExternalApproval();
      setExternalLink(link);
      toast.success('Link de aprovação externa gerado!');
    } catch (error) {
      toast.error('Erro ao gerar link');
    } finally {
      setActionLoading(null);
    }
  };

  const copyLink = () => {
    if (externalLink) {
      navigator.clipboard.writeText(externalLink);
      setLinkCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const canApprove = ['DRAFT', 'IN_REVIEW_INTERNAL', 'CHANGES_REQUESTED'].includes(post.status);
  const canRequestChanges = ['IN_REVIEW_INTERNAL', 'IN_REVIEW_EXTERNAL'].includes(post.status);
  const canSendToExternal = ['DRAFT', 'IN_REVIEW_INTERNAL', 'CHANGES_REQUESTED'].includes(post.status);

  return (
    <>
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações de Aprovação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Aprovar */}
          <Button
            onClick={() => setShowApprovalModal(true)}
            disabled={!canApprove || isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            <Check className="h-4 w-4 mr-2" />
            Aprovar e Publicar
          </Button>

          {/* Pedir Ajustes */}
          <Button
            variant="outline"
            onClick={() => setShowChangesModal(true)}
            disabled={!canRequestChanges || isLoading}
            className="w-full border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Solicitar Ajustes
          </Button>

          {/* Enviar para Aprovação Externa */}
          <Button
            variant="outline"
            onClick={handleSendToExternal}
            disabled={!canSendToExternal || isLoading || actionLoading === 'external'}
            className="w-full border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {actionLoading === 'external' ? 'Gerando link...' : 'Enviar para Aprovação Externa'}
          </Button>

          {/* Link Externo Gerado */}
          {externalLink && (
            <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">Link de aprovação externa:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={externalLink}
                  readOnly
                  className="flex-1 text-xs bg-background/50 px-2 py-1.5 rounded border border-border"
                />
                <Button size="sm" variant="secondary" onClick={copyLink}>
                  {linkCopied ? (
                    <CheckCheck className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Status Info */}
          {post.status === 'APPROVED' && (
            <div className="text-center py-2 text-sm text-emerald-600 dark:text-emerald-400">
              ✓ Este post já foi aprovado
            </div>
          )}
          {post.status === 'PUBLISHED' && (
            <div className="text-center py-2 text-sm text-green-600 dark:text-green-400">
              ✓ Este post já foi publicado
            </div>
          )}
          {post.status === 'SCHEDULED' && post.scheduled_at && (
            <div className="space-y-2">
              <div className="text-center py-2 text-sm text-cyan-600 dark:text-cyan-400 flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                Agendado para {format(new Date(post.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowScheduleModal(true)}
                className="w-full border-cyan-500/50 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Gerenciar Agendamento
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ApprovalModal
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onConfirm={handleApprove}
        isLoading={actionLoading === 'approve'}
      />

      <RequestChangesModal
        open={showChangesModal}
        onClose={() => setShowChangesModal(false)}
        onConfirm={handleRequestChanges}
        isLoading={actionLoading === 'changes'}
      />

      {post.status === 'SCHEDULED' && (
        <ScheduledPostModal
          post={post}
          open={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onPostUpdated={() => {
            setShowScheduleModal(false);
            onPostUpdated?.();
          }}
        />
      )}
    </>
  );
}
