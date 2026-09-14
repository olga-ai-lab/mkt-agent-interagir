import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { SocialPost } from "@/services/api";
import { getDeletedPosts, restorePost, hardDeletePost } from "@/services/postTrash";
import { toast } from "sonner";

interface TrashPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onRestored: () => void;
}

export function TrashPanel({ open, onOpenChange, workspaceId, onRestored }: TrashPanelProps) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<SocialPost | null>(null);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await getDeletedPosts(workspaceId);
      setPosts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadPosts();
  }, [open, workspaceId]);

  const handleRestore = async (post: SocialPost) => {
    setActionLoading(post.id);
    try {
      const ok = await restorePost(post.id);
      if (ok) {
        toast.success(`"${post.title}" recuperado com sucesso`);
        setPosts(prev => prev.filter(p => p.id !== post.id));
        onRestored();
      } else {
        toast.error("Erro ao recuperar post");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleHardDelete = async () => {
    if (!confirmHardDelete) return;
    setActionLoading(confirmHardDelete.id);
    try {
      const ok = await hardDeletePost(confirmHardDelete.id);
      if (ok) {
        toast.success("Post excluído definitivamente");
        setPosts(prev => prev.filter(p => p.id !== confirmHardDelete.id));
      } else {
        toast.error("Erro ao excluir post");
      }
    } finally {
      setActionLoading(null);
      setConfirmHardDelete(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Lixeira
            </SheetTitle>
            <SheetDescription>
              Posts excluídos são removidos definitivamente após 15 dias.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                A lixeira está vazia
              </div>
            ) : (
              posts.map(post => {
                const deletedAt = (post as any).deleted_at;
                const reason = (post as any).delete_reason;
                const daysLeft = deletedAt
                  ? 15 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000)
                  : null;

                return (
                  <div key={post.id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight line-clamp-2">{post.title}</p>
                        {reason && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{reason}"</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {deletedAt && (
                            <span className="text-xs text-muted-foreground">
                              Excluído {formatDistanceToNow(new Date(deletedAt), { addSuffix: true, locale: ptBR })}
                            </span>
                          )}
                          {daysLeft !== null && daysLeft <= 3 && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {daysLeft <= 0 ? "Expira hoje" : `${daysLeft}d restantes`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => handleRestore(post)}
                        disabled={actionLoading === post.id}
                      >
                        {actionLoading === post.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <RotateCcw className="h-3 w-3" />
                        }
                        Recuperar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmHardDelete(post)}
                        disabled={actionLoading === post.id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={!!confirmHardDelete}
        onOpenChange={(open) => !open && setConfirmHardDelete(null)}
        title="Excluir definitivamente"
        description={`Tem certeza? "${confirmHardDelete?.title}" será removido permanentemente e não poderá ser recuperado.`}
        onConfirm={handleHardDelete}
        loading={actionLoading === confirmHardDelete?.id}
      />
    </>
  );
}
