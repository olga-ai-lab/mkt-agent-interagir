import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { PageTransition } from "@/components/ui/page-transition";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Share2, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useArticleBySlug, useIncrementViewCount, useRelatedArticles } from "@/hooks/useArticles";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { AudioPlayer } from "@/components/blog/AudioPlayer";
import { BlogCTA } from "@/components/blog/BlogCTA";
import { BrandBadge } from "@/components/blog/BrandBadge";
import { LivoniusLogo } from "@/components/LivoniusLogo";

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading } = useArticleBySlug(slug || "");
  const { data: relatedArticles } = useRelatedArticles(article?.id || "", article?.category_id || null);
  const incrementView = useIncrementViewCount();

  useEffect(() => {
    if (article?.id) {
      incrementView.mutate(article.id);
    }
  }, [article?.id]);

  const shareArticle = () => {
    if (navigator.share) {
      navigator.share({
        title: article?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12">
          <div className="mx-auto max-w-3xl animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="h-12 w-full rounded bg-muted" />
            <div className="h-64 w-full rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">Artigo não encontrado</h1>
          <Link to="/blog">
            <Button>Voltar ao blog</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <Helmet>
        <title>{article.title} | Blog Livonius</title>
        <meta name="description" content={article.meta_description || article.excerpt || article.title} />
        {article.keywords && article.keywords.length > 0 && (
          <meta name="keywords" content={article.keywords.join(", ")} />
        )}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: article.title,
            description: article.excerpt,
            datePublished: article.published_at,
            author: {
              "@type": "Person",
              name: article.profiles?.full_name || "Livonius",
            },
            publisher: {
              "@type": "Organization",
              name: "Livonius",
            },
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/50 bg-background/95 backdrop-blur">
          <div className="container flex h-16 items-center justify-between">
            <Link to="/blog" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao blog
            </Link>
            <div className="flex items-center gap-4">
              <LivoniusLogo variant="color" className="h-6 w-auto" />
              <Button variant="ghost" size="icon" onClick={shareArticle}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container py-12">
          <article className="mx-auto max-w-3xl">
            {/* Breadcrumb */}
            <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
              <a href="https://livoniusmga.com.br" className="transition-colors hover:text-primary">
                Home
              </a>
              <ChevronRight className="h-4 w-4" />
              <Link to="/blog" className="transition-colors hover:text-primary">
                Blog
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="line-clamp-1 font-medium text-foreground">{article.title}</span>
            </nav>

            {/* Meta Info */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <BrandBadge brand={article.brand || "livonius"} size="md" />
              {article.categories && <Badge className="bg-primary/10 text-primary">{article.categories.name}</Badge>}
              {article.published_at && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(article.published_at), "d 'de' MMMM, yyyy", {
                    locale: ptBR,
                  })}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="mb-6 text-3xl font-bold leading-tight text-foreground md:text-4xl">{article.title}</h1>

            {/* Reading Time */}
            {article.reading_time && (
              <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{article.reading_time} min de leitura</span>
              </div>
            )}

            {/* Audio Player */}
            {article.content && (
              <AudioPlayer text={article.content} title={article.title} articleId={article.id} className="mb-8" />
            )}

            {/* Cover Image */}
            {article.cover_image_url && (
              <img
                src={article.cover_image_url}
                alt={article.title}
                className="mb-8 aspect-video w-full rounded-xl object-cover"
              />
            )}

            {/* Content */}
            <div
              className="blog-content prose prose-lg max-w-none
                         prose-headings:font-semibold prose-headings:text-foreground
                         prose-strong:font-semibold prose-strong:text-foreground
                         prose-p:mb-4 prose-p:leading-relaxed
                         prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                         dark:prose-invert"
            >
              <ReactMarkdown>{article.content || ""}</ReactMarkdown>
            </div>

            {/* Keywords */}
            {article.keywords && article.keywords.length > 0 && (
              <div className="mt-12 flex flex-wrap gap-2">
                {article.keywords.map((keyword) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </article>

          {/* Newsletter CTA */}
          <div className="mx-auto mt-16 max-w-3xl">
            <BlogCTA />
          </div>

          {/* Related Articles */}
          {relatedArticles && relatedArticles.length > 0 && (
            <div className="mx-auto mt-16 max-w-6xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">Artigos relacionados</h2>
                <Link to="/blog">
                  <Button variant="ghost" className="gap-2">
                    Ver todos
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                {relatedArticles.map((related) => (
                  <ArticleCard key={related.id} article={related} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
}
