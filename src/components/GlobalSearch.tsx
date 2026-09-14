import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { ChannelIcons } from "@/components/marketing/ChannelIcons";
import { api, SocialPost } from "@/services/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);

  const searchData = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !currentWorkspace) return;

    setLoading(true);
    try {
      // Search posts
      const postsData = await api.getPosts(currentWorkspace.id, { search: searchQuery });
      setPosts(postsData.slice(0, 5));

      // Search articles
      const { data: articlesData } = await supabase
        .from("mkt_articles")
        .select("id, title, slug, status")
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
        .limit(5);
      
      setArticles(articlesData || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.trim()) {
        searchData(query);
      } else {
        setPosts([]);
        setArticles([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, searchData]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setPosts([]);
      setArticles([]);
    }
  }, [open]);

  const handleSelect = (type: string, id: string, slug?: string) => {
    onOpenChange(false);
    if (type === "post") {
      navigate(`/app/posts/${id}`);
    } else if (type === "article") {
      navigate(`/admin/articles/${id}`);
    }
  };

  const hasResults = posts.length > 0 || articles.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar posts, artigos..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Buscando...
          </div>
        )}

        {!loading && query.trim() && !hasResults && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}

        {posts.length > 0 && (
          <CommandGroup heading="Posts">
            {posts.map((post) => (
              <CommandItem
                key={post.id}
                value={`post-${post.id}`}
                onSelect={() => handleSelect("post", post.id)}
                className="flex items-center gap-3 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={post.status} />
                    <ChannelIcons channels={post.channels} size="sm" />
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {posts.length > 0 && articles.length > 0 && <CommandSeparator />}

        {articles.length > 0 && (
          <CommandGroup heading="Artigos do Blog">
            {articles.map((article) => (
              <CommandItem
                key={article.id}
                value={`article-${article.id}`}
                onSelect={() => handleSelect("article", article.id, article.slug)}
                className="flex items-center gap-3 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{article.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {article.status === "published" ? "Publicado" : "Rascunho"}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Hook para atalho de teclado
export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
