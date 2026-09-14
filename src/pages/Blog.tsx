import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { LivoniusLogo } from "@/components/LivoniusLogo";
import livoLogo from "@/assets/livo-logo.png.asset.json";
import { BlogHero } from "@/components/blog/BlogHero";
import { BlogFilters } from "@/components/blog/BlogFilters";
import { BlogCTA } from "@/components/blog/BlogCTA";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { usePublishedArticles, useTotalArticlesCount, BrandFilter } from "@/hooks/useArticles";
import { useCategories } from "@/hooks/useCategories";
import { containerVariants, itemVariants } from "@/components/ui/animated-card";

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get("categoria") || undefined;
  const brandParam = (searchParams.get("marca") as BrandFilter) || "all";
  const searchParam = searchParams.get("busca") || "";

  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [brand, setBrand] = useState<BrandFilter>(brandParam);

  const { data: articles, isLoading } = usePublishedArticles({
    categorySlug,
    search: searchParam || undefined,
    brand,
  });
  const { data: categories } = useCategories();
  const { data: totalCount } = useTotalArticlesCount();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set("busca", searchQuery);
    } else {
      params.delete("busca");
    }
    setSearchParams(params);
  };

  const handleBrandChange = (newBrand: BrandFilter) => {
    setBrand(newBrand);
    const params = new URLSearchParams(searchParams);
    if (newBrand !== "all") {
      params.set("marca", newBrand);
    } else {
      params.delete("marca");
    }
    setSearchParams(params);
  };

  const handleCategoryFilter = (slug: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (slug) {
      params.set("categoria", slug);
    } else {
      params.delete("categoria");
    }
    setSearchParams(params);
  };

  return (
    <PageTransition>
      <Helmet>
        <title>Blog | Livonius & Livo - Artigos sobre Seguros</title>
        <meta
          name="description"
          content="Conheça artigos especializados sobre RCO, Energia Solar, Seguro Garantia, Agronegócio e muito mais. Conteúdo produzido por especialistas."
        />
        <meta
          name="keywords"
          content="RCO, Energia Solar, Seguros, Garantia, Agronegócio, Livonius, Livo MGA, MGA, Seguro"
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        >
          <div className="container flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <LivoniusLogo variant="color" className="h-8 w-auto" />
              <img src={livoLogo.url} alt="Livo" className="h-12 w-auto object-contain" />
              <span className="text-xl font-bold text-foreground">Blog</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                to="/admin"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Admin
              </Link>
            </nav>
          </div>
        </motion.header>

        {/* Hero */}
        <BlogHero />

        {/* Filters */}
        <BlogFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearch}
          brand={brand}
          onBrandChange={handleBrandChange}
          categorySlug={categorySlug || null}
          onCategoryChange={handleCategoryFilter}
          categories={categories || []}
          totalCount={totalCount || 0}
          filteredCount={articles?.length || 0}
        />

        {/* Articles Grid */}
        <main className="container pb-16">
          {isLoading ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="space-y-4"
                >
                  <Skeleton className="aspect-video w-full rounded-xl" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </motion.div>
              ))}
            </div>
          ) : articles?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <p className="text-lg text-muted-foreground">
                Nenhum artigo encontrado.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Tente alterar os filtros ou a busca.
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${categorySlug}-${brand}-${searchParam}`}
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3"
              >
                {articles?.map((article) => (
                  <motion.div
                    key={article.id}
                    variants={itemVariants}
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ArticleCard article={article} />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Newsletter CTA */}
        <BlogCTA />

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-border/50 py-8"
        >
          <div className="container text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Livonius. Todos os direitos
            reservados.
          </div>
        </motion.footer>
      </div>
    </PageTransition>
  );
}
