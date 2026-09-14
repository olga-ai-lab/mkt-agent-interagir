import { useEffect, useState, useMemo } from "react";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { PageTransition } from "@/components/ui/page-transition";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search, LayoutGrid, List, Filter, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PostCard } from "@/components/marketing/PostCard";
import { PostsTable } from "@/components/marketing/PostsTable";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { GenerationStatusBanner } from "@/components/marketing/GenerationStatusBanner";
import { DeleteWithReasonDialog } from "@/components/ui/delete-with-reason-dialog";
import { TrashPanel } from "@/components/marketing/TrashPanel";
import { api, SocialPost } from "@/services/api";
import { deletePost as movePostToTrash } from "@/services/postTrash";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { PostStatus, POST_STATUS_CONFIG } from "@/types/marketing";
import { toast } from "sonner";

type ViewMode = "cards" | "table";

export default function PostsList() {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = usePersistedTab<ViewMode>("posts-view-mode", "cards");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<SocialPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const statusFilter = searchParams.get("status") as PostStatus | null;

  const loadPosts = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const data = await api.getPosts(currentWorkspace.id, filters);

      // Guard against transient empty responses: retry once before replacing the UI with an empty state.
      if (!filters && data.length === 0) {
        const retryData = await api.getPosts(currentWorkspace.id, filters);

        setPosts((prev) => {
          if (retryData.length > 0) return retryData;
          if (prev.length > 0) {
            toast.warning("Falha temporária ao carregar posts. Mantendo a lista anterior.");
            return prev;
          }
          return retryData;
        });
        return;
      }

      setPosts(data);
    } catch (error) {
      console.error("Error loading posts:", error);
      toast.error("Erro ao carregar posts. Tente atualizar a página.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Stop loading if workspace context finished but no workspace available
    if (!workspaceLoading && !currentWorkspace) {
      setLoading(false);
      return;
    }
    
    if (currentWorkspace) {
      loadPosts();
    }
  }, [currentWorkspace, workspaceLoading, statusFilter]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    
    const query = searchQuery.toLowerCase();
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(query) ||
        post.pauta_titulo?.toLowerCase().includes(query) ||
        post.content?.toLowerCase().includes(query) ||
        post.excerpt?.toLowerCase().includes(query)
    );
  }, [posts, searchQuery]);

  const handleStatusFilter = (status: PostStatus | null) => {
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  const handleDeleteClick = (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (post) {
      setPostToDelete(post);
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async (reason?: string) => {
    if (!postToDelete) return;

    setDeleting(true);
    try {
      const success = await movePostToTrash(postToDelete.id, reason);
      if (success) {
        toast.success("Post movido para a lixeira");
        loadPosts();
      } else {
        toast.error("Erro ao mover post para a lixeira");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erro ao mover post para a lixeira");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setPostToDelete(null);
    }
  };

  const statuses = (Object.keys(POST_STATUS_CONFIG) as PostStatus[]).filter(s => s !== "IN_REVIEW_EXTERNAL");

  return (
    <PageTransition>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Posts</h1>
          <p className="text-muted-foreground">
            Gerencie seus posts de marketing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setTrashOpen(true)} title="Lixeira">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button asChild>
            <Link to="/app/posts/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Generation in-progress banner */}
      <GenerationStatusBanner onDone={loadPosts} />

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter Dropdown (Mobile) */}
          <div className="lg:hidden">
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => handleStatusFilter(v === "all" ? null : (v as PostStatus))}
            >
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {POST_STATUS_CONFIG[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter Chips (Desktop) */}
          <div className="hidden flex-wrap gap-2 lg:flex">
            <Button
              variant={!statusFilter ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusFilter(null)}
            >
              Todos
            </Button>
            {statuses.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusFilter(status)}
                className="gap-1.5"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    statusFilter === status
                      ? "bg-primary-foreground"
                      : POST_STATUS_CONFIG[status].dotColor
                  }`}
                />
                {POST_STATUS_CONFIG[status].label}
              </Button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-border/50 p-1">
            <Toggle
              pressed={viewMode === "cards"}
              onPressedChange={() => setViewMode("cards")}
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === "table"}
              onPressedChange={() => setViewMode("table")}
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>

      {/* Active Filter Badge */}
      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrando por:</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleStatusFilter(null)}
            className="gap-1.5"
          >
            <StatusBadge status={statusFilter} />
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <PostsListSkeleton viewMode={viewMode} />
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          hasFilter={!!statusFilter || !!searchQuery}
          onClearFilter={() => {
            handleStatusFilter(null);
            setSearchQuery("");
          }}
        />
      ) : viewMode === "cards" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDeleteClick} />
          ))}
        </div>
      ) : (
        <PostsTable posts={filteredPosts} onDelete={handleDeleteClick} />
      )}

      {/* Results Count */}
      {!loading && filteredPosts.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Mostrando {filteredPosts.length} de {posts.length} posts
        </p>
      )}

      <DeleteWithReasonDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        itemName={postToDelete?.title}
        loading={deleting}
      />

      {currentWorkspace && (
        <TrashPanel
          open={trashOpen}
          onOpenChange={setTrashOpen}
          workspaceId={currentWorkspace.id}
          onRestored={loadPosts}
        />
      )}
    </div>
    </PageTransition>
  );
}

function PostsListSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "table") {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border/50 bg-card">
          <Skeleton className="aspect-video w-full" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasFilter,
  onClearFilter,
}: {
  hasFilter: boolean;
  onClearFilter: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {hasFilter ? "Nenhum post encontrado" : "Nenhum post ainda"}
      </h3>
      <p className="mt-2 max-w-sm text-muted-foreground">
        {hasFilter
          ? "Tente ajustar seus filtros ou termos de busca."
          : "Crie seu primeiro post e comece a gerenciar seu conteúdo de marketing."}
      </p>
      {hasFilter ? (
        <Button variant="outline" className="mt-4" onClick={onClearFilter}>
          Limpar filtros
        </Button>
      ) : (
        <Button className="mt-4" asChild>
          <Link to="/app/posts/new">
            <Plus className="mr-2 h-4 w-4" />
            Criar primeiro post
          </Link>
        </Button>
      )}
    </div>
  );
}
