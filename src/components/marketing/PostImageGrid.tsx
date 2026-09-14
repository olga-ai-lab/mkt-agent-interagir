import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PostImageGridProps {
  postId: string;
  imageUrls: string[];
  mediaUrls: string[];
  thumbnailUrl: string | null;
  onThumbnailChange: (url: string) => void;
}

export function PostImageGrid({
  postId,
  imageUrls,
  mediaUrls,
  thumbnailUrl,
  onThumbnailChange,
}: PostImageGridProps) {
  const [updating, setUpdating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images = imageUrls.length > 0 ? imageUrls : mediaUrls;

  if (images.length === 0) return null;

  const handleSetThumbnail = async (url: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("social_posts")
        .update({ thumbnail_url: url, og_image_url: url })
        .eq("id", postId);

      if (error) throw error;

      onThumbnailChange(url);
      toast.success("Thumbnail atualizada!");
    } catch (error) {
      console.error("Error updating thumbnail:", error);
      toast.error("Erro ao atualizar thumbnail");
    } finally {
      setUpdating(false);
    }
  };

  const isSingleImage = images.length === 1;
  const lightboxOpen = lightboxIndex !== null;
  const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null;
  const currentIsThumbnail = currentImage === thumbnailUrl;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Imagens Geradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {images.map((url, index) => {
              const isThumbnail = url === thumbnailUrl;
              return (
                <div
                  key={index}
                  className="relative group rounded-lg overflow-hidden border border-border cursor-pointer"
                  onClick={() => setLightboxIndex(index)}
                >
                  <img
                    src={url}
                    alt={`Imagem ${index + 1}`}
                    className="w-full h-[200px] object-cover"
                  />
                  {(isThumbnail || isSingleImage) && (
                    <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground shadow-md">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Thumbnail
                    </Badge>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-md">
                      Clique para ampliar
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={lightboxOpen} onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
          {currentImage && (
            <div className="flex flex-col">
              <div className="relative flex items-center justify-center bg-black/5 min-h-[400px] max-h-[70vh]">
                <img
                  src={currentImage}
                  alt={`Imagem ${(lightboxIndex ?? 0) + 1}`}
                  className="max-w-full max-h-[70vh] object-contain"
                />

                {images.length > 1 && lightboxIndex! > 0 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                    onClick={() => setLightboxIndex(lightboxIndex! - 1)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                {images.length > 1 && lightboxIndex! < images.length - 1 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                    onClick={() => setLightboxIndex(lightboxIndex! + 1)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {(lightboxIndex ?? 0) + 1} de {images.length}
                  {(currentIsThumbnail || (isSingleImage)) && (
                    <Badge className="ml-2 bg-primary text-primary-foreground">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Thumbnail
                    </Badge>
                  )}
                </span>
                {!currentIsThumbnail && !isSingleImage && (
                  <Button
                    size="sm"
                    onClick={() => handleSetThumbnail(currentImage)}
                    disabled={updating}
                  >
                    <Star className="h-4 w-4 mr-1" />
                    Usar como thumbnail
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
