import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface BlogFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  brand: "all" | "livonius" | "livo";
  onBrandChange: (brand: "all" | "livonius" | "livo") => void;
  categorySlug: string | null;
  onCategoryChange: (slug: string | null) => void;
  categories: Category[];
  totalCount: number;
  filteredCount: number;
}

export function BlogFilters({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  brand,
  onBrandChange,
  categorySlug,
  onCategoryChange,
  categories,
  totalCount,
  filteredCount,
}: BlogFiltersProps) {
  const brandOptions: { value: "all" | "livonius" | "livo"; label: string }[] = [
    { value: "all", label: "Todas as Marcas" },
    { value: "livonius", label: "Livonius" },
    { value: "livo", label: "Livo" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="container py-8"
    >
      {/* Search Bar */}
      <form onSubmit={onSearchSubmit} className="mb-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos por título, conteúdo ou keywords..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-24"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1.5 top-1/2 -translate-y-1/2"
          >
            Buscar
          </Button>
        </div>
      </form>

      {/* Brand Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {brandOptions.map((option) => (
          <Button
            key={option.value}
            variant={brand === option.value ? "default" : "outline"}
            size="sm"
            onClick={() => onBrandChange(option.value)}
            className={cn(
              "transition-all",
              brand === option.value && "shadow-md"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Category Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={!categorySlug ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onCategoryChange(null)}
          className={cn(!categorySlug && "bg-secondary font-medium")}
        >
          Todos
        </Button>
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={categorySlug === category.slug ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onCategoryChange(category.slug)}
            className={cn(
              categorySlug === category.slug && "bg-secondary font-medium"
            )}
          >
            {category.name}
          </Button>
        ))}
      </div>

      {/* Results Counter */}
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{filteredCount}</span> de{" "}
        <span className="font-medium text-foreground">{totalCount}</span> artigos
      </p>
    </motion.section>
  );
}
