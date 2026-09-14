import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Eye, MoreVertical, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "./StatusBadge";
import { ChannelIcons } from "./ChannelIcons";
import { ABTestBadge } from "./ABTestBadge";
import { CompanyBadge } from "./CompanyBadge";
import { PostOriginBadge } from "./PostOriginBadge";
import { SocialPost } from "@/types/marketing";

interface PostCardProps {
  post: SocialPost;
  onDelete?: (id: string) => void;
  index?: number;
}

export function PostCard({ post, onDelete, index = 0 }: PostCardProps) {
  const [imageError, setImageError] = useState(false);
  const displayDate = post.scheduled_at || post.published_at || post.created_at;
  const dateLabel = post.published_at
    ? "Publicado"
    : post.scheduled_at
    ? "Agendado"
    : "Criado";

  const displayImage = post.thumbnail_url || post.rendered_media_urls?.[0] || post.image_urls?.[0] || post.media_urls?.[0];
  const hasValidImage = !!displayImage && !imageError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className="h-full"
    >
      <Card className="group h-full flex flex-col overflow-hidden border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg">
        {/* Media Preview */}
        <div className="relative aspect-video bg-muted">
          {hasValidImage ? (
            <img
              src={displayImage!}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Eye className="h-8 w-8" />
            </div>
          )}
          
          {/* Actions Menu */}
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="h-8 w-8">
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
          </div>
        </div>

        <CardContent className="flex-1 flex flex-col p-4 gap-2">
          {/* Status Badges Row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={post.status} />
            {post.has_ab_test && <ABTestBadge />}
            <CompanyBadge company={post.company || "livonius"} />
            {post.pauta_id ? (
              <Link to={`/app/agenda-editorial?pauta_id=${post.pauta_id}`}>
                <PostOriginBadge origem={post.origem} />
              </Link>
            ) : (
              <PostOriginBadge origem={post.origem} />
            )}
          </div>

          {/* Title */}
          <Link to={`/app/posts/${post.id}`}>
            <h3 className="min-h-[2.75rem] line-clamp-2 font-semibold text-foreground transition-colors hover:text-primary">
              {post.title}
            </h3>
          </Link>

          {post.pauta_id && post.pauta_titulo && (
            <Link
              to={`/app/agenda-editorial?pauta_id=${post.pauta_id}`}
              className="line-clamp-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              Pauta: {post.pauta_titulo}
            </Link>
          )}

          {/* Excerpt - always reserve space */}
          <p className="min-h-[2.5rem] line-clamp-2 text-sm text-muted-foreground">
            {post.excerpt || "\u00A0"}
          </p>

          {/* Tags - always reserve space */}
          <div className="min-h-[1.5rem] flex flex-wrap gap-1">
            {post.tags && post.tags.length > 0 && (
              <>
                <Tag className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                {post.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} className="text-[10px] px-1.5 py-0.5 h-5 font-medium bg-white text-foreground border border-border">
                    {tag}
                  </Badge>
                ))}
                {post.tags.length > 3 && (
                  <Badge className="text-[10px] px-1.5 py-0.5 h-5 font-medium bg-white text-foreground border border-border">
                    +{post.tags.length - 3}
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Footer - pushed to bottom */}
          <div className="mt-auto flex items-center justify-between pt-2">
            <ChannelIcons channels={post.channels} size="sm" />
            
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{dateLabel}:</span>
              <span>{format(new Date(displayDate), "dd MMM", { locale: ptBR })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
