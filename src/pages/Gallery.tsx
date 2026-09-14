import { useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Image, Film, LayoutGrid } from "lucide-react";
import { useGalleryMedia } from "@/hooks/useGalleryMedia";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { LightboxModal } from "@/components/gallery/LightboxModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Gallery() {
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [companyFilter, setCompanyFilter] = useState<"all" | "livonius" | "livo">("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { files, isLoading, deleteFile, isDeleting } = useGalleryMedia(filter, companyFilter);

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Galeria</h1>
            <p className="text-muted-foreground">
              Todas as mídias dos seus posts
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Company filter */}
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <Button
                variant={companyFilter === "all" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCompanyFilter("all")}
              >
                Todas
              </Button>
              <Button
                variant={companyFilter === "livonius" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 text-xs",
                  companyFilter === "livonius" && "bg-primary text-primary-foreground"
                )}
                onClick={() => setCompanyFilter("livonius")}
              >
                Livonius
              </Button>
              <Button
                variant={companyFilter === "livo" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 text-xs",
                  companyFilter === "livo" && "bg-sky-600 text-white hover:bg-sky-700"
                )}
                onClick={() => setCompanyFilter("livo")}
              >
                Livo
              </Button>
            </div>

            {/* Type filter */}
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="all" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Todos
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-2">
                  <Image className="h-4 w-4" />
                  Imagens
                </TabsTrigger>
                <TabsTrigger value="video" className="gap-2">
                  <Film className="h-4 w-4" />
                  Vídeos
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <GalleryGrid
            files={files}
            onOpen={setLightboxIndex}
            onDelete={deleteFile}
            isDeleting={isDeleting}
          />
        )}

        {lightboxIndex !== null && (
          <LightboxModal
            files={files}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </div>
    </PageTransition>
  );
}
