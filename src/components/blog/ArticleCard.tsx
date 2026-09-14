import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calendar, Clock, Tag, User } from "lucide-react";
import { BrandBadge } from "./BrandBadge";
import { Article } from "@/hooks/useArticles";

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const displayKeywords = article.keywords?.slice(0, 2) || [];
  const remainingCount = (article.keywords?.length || 0) - 2;

  return (
    <Link to={`/blog/${article.slug}`} className="block h-full">
      {/* Wrapper com altura total */}
      <div className="group flex h-full flex-col">
        {/* Category & Date - Altura fixa */}
        <div className="mb-3 flex h-6 items-center justify-between text-sm text-muted-foreground">
          {article.categories && (
            <span className="font-medium text-foreground">
              {article.categories.name}
            </span>
          )}
          {article.published_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(article.published_at), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </span>
            </div>
          )}
        </div>

        {/* Card Principal - Flex grow para preencher */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-card shadow-sm transition-all duration-300 hover:shadow-md">
          {/* Image with Badge */}
          <div className="relative aspect-video overflow-hidden">
            <div className="absolute right-3 top-3 z-10">
              <BrandBadge brand={article.brand || "livonius"} />
            </div>
            {article.cover_image_url ? (
              <img
                src={article.cover_image_url}
                alt={article.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary/60">
                <span className="text-4xl font-bold text-white/30">
                  {article.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Content - Flex grow com seções organizadas */}
          <div className="flex flex-1 flex-col p-5">
            {/* Title - Altura fixa (2 linhas) */}
            <h3 className="mb-2 line-clamp-2 min-h-[3.5rem] text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
              {article.title}
            </h3>

            {/* Excerpt - Altura fixa (3 linhas) */}
            <div className="mb-4 min-h-[4.5rem]">
              {article.excerpt && (
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {article.excerpt}
                </p>
              )}
            </div>

            {/* Keywords - Altura fixa */}
            <div className="mb-4 min-h-[1.75rem]">
              {displayKeywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {displayKeywords.map((keyword) => (
                    <div key={keyword} className="flex items-center gap-1 text-sm">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      <span className="text-primary">{keyword}</span>
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <span className="text-sm text-muted-foreground">
                      +{remainingCount} mais
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Sempre no fundo com mt-auto */}
            <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                {/* Author */}
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-red-500" />
                  <span>{article.profiles?.full_name || "Equipe Livonius"}</span>
                </div>
                
                {/* Reading Time */}
                {article.reading_time && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{article.reading_time} min</span>
                  </div>
                )}
              </div>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
