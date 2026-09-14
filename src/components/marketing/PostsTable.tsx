import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreVertical, ArrowUpDown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";
import { ChannelIcons } from "./ChannelIcons";
import { CompanyBadge } from "./CompanyBadge";
import { PostOriginBadge } from "./PostOriginBadge";
import { SocialPost } from "@/types/marketing";

interface PostsTableProps {
  posts: SocialPost[];
  onSort?: (field: string) => void;
  onDelete?: (id: string) => void;
}

function PostTableImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  
  if (error) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
        <span className="text-xs text-muted-foreground">N/A</span>
      </div>
    );
  }
  
  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 rounded object-cover"
      onError={() => setError(true)}
    />
  );
}


export function PostsTable({ posts, onSort, onDelete }: PostsTableProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[300px]">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 text-muted-foreground hover:text-foreground"
                onClick={() => onSort?.("title")}
              >
                Título
                <ArrowUpDown className="ml-2 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Canais</TableHead>
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 h-8 text-muted-foreground hover:text-foreground"
                onClick={() => onSort?.("scheduled_at")}
              >
                Data
                <ArrowUpDown className="ml-2 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => {
            const displayDate = post.scheduled_at || post.published_at || post.created_at;
            
            return (
              <TableRow key={post.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {post.media_urls && post.media_urls.length > 0 ? (
                      <PostTableImage src={post.media_urls[0]} alt="" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                        <span className="text-xs text-muted-foreground">N/A</span>
                      </div>
                    )}
                    <div>
                      <Link
                        to={`/app/posts/${post.id}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {post.title}
                      </Link>
                      {post.excerpt && (
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {post.excerpt}
                        </p>
                      )}
                      {post.pauta_id && post.pauta_titulo && (
                        <Link
                          to={`/app/agenda-editorial?pauta_id=${post.pauta_id}`}
                          className="mt-1 block line-clamp-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
                        >
                          Pauta: {post.pauta_titulo}
                        </Link>
                      )}
                      <div className="mt-1 flex items-center gap-1.5">
                        <CompanyBadge company={post.company || "livonius"} />
                        {post.pauta_id ? (
                          <Link to={`/app/agenda-editorial?pauta_id=${post.pauta_id}`}>
                            <PostOriginBadge origem={post.origem} />
                          </Link>
                        ) : (
                          <PostOriginBadge origem={post.origem} />
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={post.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {post.tags && post.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {post.tags && post.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{post.tags.length - 2}
                      </Badge>
                    )}
                    {(!post.tags || post.tags.length === 0) && (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {(post as any).author_name || "-"}
                </TableCell>
                <TableCell>
                  <ChannelIcons channels={post.channels} size="sm" />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(displayDate), "dd MMM yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/app/posts/${post.id}`}>Editar</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/app/posts/${post.id}/review`}>Ver Aprovação</Link>
                      </DropdownMenuItem>
                      {onDelete && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(post.id)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
