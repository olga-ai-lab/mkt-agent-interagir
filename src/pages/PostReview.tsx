import { useState, useEffect } from 'react';
import { PageTransition } from "@/components/ui/page-transition";
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { api } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { SocialPost, PostVersion, PostComment, SocialChannel } from '@/types/marketing';
import { PostPreview } from '@/components/marketing/PostPreview';
import { VersionTimeline } from '@/components/marketing/VersionTimeline';
import { CommentThread } from '@/components/marketing/CommentThread';
import { ApprovalActions } from '@/components/marketing/ApprovalActions';
import { RejectionReasonsAlert } from '@/components/marketing/RejectionReasonsAlert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, Pencil, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { APP_BASE_URL } from '@/lib/appConfig';
import { downloadPostPdf } from '@/lib/postPdf';
export default function PostReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();

  const [post, setPost] = useState<SocialPost | null>(null);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const loadData = async () => {
    if (!id) return;

    try {
      const [postData, versionsData, commentsData] = await Promise.all([
        api.getPost(id),
        api.getPostVersions(id),
        api.getPostComments(id),
      ]);

      setPost(postData);
      setVersions(versionsData);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading post:', error);
      toast.error('Erro ao carregar post');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleAddComment = async (content: string, isInternal: boolean) => {
    if (!id) return;
    
    const newComment = await api.addComment(id, content, isInternal);
    setComments((prev) => [...prev, newComment]);
  };

  const handleApprove = async (channels: SocialChannel[], scheduledAt?: string, comment?: string, connectionIds?: string[]) => {
    if (!id || !post) return;

    try {
      // Atualiza o post com os canais selecionados
      await api.updatePost(id, { channels });

      // Chamar edge function para publicar nos canais
      const { data, error } = await supabase.functions.invoke('mkt-trigger-publish', {
        body: {
          post_id: id,
          channels: channels,
          connection_ids: connectionIds,
          scheduled_at: scheduledAt,
        },
      });

      if (error) {
        console.error('Error triggering publish:', error);
        toast.error('Erro ao publicar nos canais');
        return;
      }

      console.log('Publish result:', data);

      // Mostra resultados por canal
      if (data?.results) {
        const successChannels = Object.entries(data.results)
          .filter(([_, result]: [string, any]) => result.success)
          .map(([channel]) => channel);
        
        const failedChannels = Object.entries(data.results)
          .filter(([_, result]: [string, any]) => !result.success)
          .map(([channel]) => channel);

        // Mensagem diferente para agendamento vs publicação imediata
        if (data.status === 'SCHEDULED' && data.scheduled_at) {
          const scheduledDate = new Date(data.scheduled_at);
          const formattedDate = format(scheduledDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
          toast.success(`Post agendado para ${formattedDate}`);
        } else {
          if (successChannels.length > 0) {
            toast.success(`Publicado em: ${successChannels.join(', ')}`);
          }
        }
        
        if (failedChannels.length > 0) {
          toast.error(`Falha em: ${failedChannels.join(', ')}`);
        }
      }

      // Recarrega os dados
      await loadData();
    } catch (error) {
      console.error('Error in handleApprove:', error);
      toast.error('Erro ao aprovar post');
    }
  };

  const handleRequestChanges = async (reasons: string[], comment?: string) => {
    if (!id) return;
    const workspaceId = post?.workspace_id || '00000000-0000-0000-0000-000000000001';
    await api.requestChanges(id, reasons, comment, workspaceId);
    await loadData();
  };

  const handleSendToExternalApproval = async (): Promise<string> => {
    if (!id) throw new Error('Post ID not found');

    await api.sendToApproval(id, 'external');
    const refreshed = await api.getPost(id);
    setPost(refreshed);

    const token = refreshed?.approval_token;
    if (!token) throw new Error('Token de aprovação não encontrado');
    return `${APP_BASE_URL}/approve/${token}`;
  };

  const handleDownloadPdf = async () => {
    if (!post) return;
    setIsDownloadingPdf(true);
    try {
      await downloadPostPdf(post);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar o PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleViewVersion = (version: PostVersion) => {
    toast.info(`Visualizando versão ${version.version_number}`);
    // TODO: Implementar modal de comparação de versões
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Post não encontrado</p>
        <Button variant="link" onClick={() => navigate('/app/posts')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/posts')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Revisão de Post</h1>
            <p className="text-sm text-muted-foreground">
              Revise, comente e aprove o conteúdo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>
            {isDownloadingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Baixar PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/app/posts/${id}`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Preview Column (60%) */}
        <div className="lg:col-span-3">
          <PostPreview post={post} />
        </div>

        {/* Actions Column (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Motivos de Rejeição */}
          {post.status === 'CHANGES_REQUESTED' && (
            <RejectionReasonsAlert postId={post.id} />
          )}

          {/* Ações de Aprovação */}
          <ApprovalActions
            post={post}
            onApprove={handleApprove}
            onRequestChanges={handleRequestChanges}
            onSendToExternalApproval={handleSendToExternalApproval}
          />

          {/* Histórico de Versões */}
          <VersionTimeline
            versions={versions}
            currentVersion={versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) : undefined}
            onViewVersion={handleViewVersion}
          />

          {/* Comentários */}
          <CommentThread comments={comments} onAddComment={handleAddComment} />
        </div>
      </div>
    </div>
    </PageTransition>
  );
}
