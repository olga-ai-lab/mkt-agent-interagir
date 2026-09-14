import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export function BlogHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative bg-gradient-to-b from-primary/10 via-primary/5 to-background py-12 md:py-16"
    >
      <div className="container">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <a href="https://livoniusmga.com.br" className="transition-colors hover:text-primary">
            Home
          </a>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Blog</span>
        </nav>

        {/* Title & Subtitle */}
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Blog Especializado em <span className="text-primary">Seguros</span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Conteúdo técnico e educativo sobre RCO, Energia Solar, Garantia, Agronegócio e muito mais. Fique atualizado
          com as tendências do mercado de seguros.
        </p>
      </div>
    </motion.section>
  );
}
