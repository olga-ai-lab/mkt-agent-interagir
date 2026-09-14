import { useState, useRef, useCallback } from "react";
import { Upload, X, Image, Film, Loader2, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MediaUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  accept?: string;
  disabled?: boolean;
  generatedImages?: string[];
  thumbnailUrl?: string | null;
  onThumbnailChange?: (url: string) => void;
  postId?: string;
}

const BUCKET_NAME = "interagir-post-media";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
];

export function MediaUploader({
  value = [],
  onChange,
  maxFiles = 5,
  accept = "image/*,video/mp4,video/webm",
  disabled = false,
  generatedImages = [],
  thumbnailUrl,
  onThumbnailChange,
  postId,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [updatingThumbnail, setUpdatingThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deduplicate: combine manual uploads + generated, removing duplicates
  const allImages = Array.from(new Set([...value, ...generatedImages]));

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Tipo de arquivo não suportado: ${file.type}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo muito grande. Máximo: 50MB`;
    }
    return null;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return null;
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error(`Erro ao fazer upload: ${uploadError.message}`);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remainingSlots = maxFiles - value.length;

      if (fileArray.length > remainingSlots) {
        toast.error(`Você pode adicionar no máximo ${remainingSlots} arquivo(s)`);
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      const uploadedUrls: string[] = [];
      const totalFiles = fileArray.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = fileArray[i];
        const url = await uploadFile(file);
        if (url) {
          uploadedUrls.push(url);
        }
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      if (uploadedUrls.length > 0) {
        onChange([...value, ...uploadedUrls]);
        toast.success(
          `${uploadedUrls.length} arquivo(s) enviado(s) com sucesso!`
        );
      }

      setUploading(false);
      setUploadProgress(0);
    },
    [value, onChange, maxFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || uploading) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, uploading, handleFiles]
  );

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeMedia = async (urlToRemove: string) => {
    const url = new URL(urlToRemove);
    const pathMatch = url.pathname.match(/\/(?:interagir-post-media|post-media)\/(.+)$/);

    if (pathMatch) {
      const filePath = decodeURIComponent(pathMatch[1]);
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
    }

    onChange(value.filter((u) => u !== urlToRemove));
    toast.success("Mídia removida");
  };

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm)$/i);
  };

  const isManualUpload = (url: string) => value.includes(url);

  const handleSetThumbnail = async (url: string) => {
    if (!postId || !onThumbnailChange) return;
    setUpdatingThumbnail(true);
    try {
      const { error } = await supabase
        .from("mkt_social_posts")
        .update({ thumbnail_url: url, og_image_url: url })
        .eq("id", postId);
      if (error) throw error;
      onThumbnailChange(url);
      toast.success("Thumbnail atualizada!");
    } catch (error) {
      console.error("Error updating thumbnail:", error);
      toast.error("Erro ao atualizar thumbnail");
    } finally {
      setUpdatingThumbnail(false);
    }
  };

  const lightboxOpen = lightboxIndex !== null;
  const currentMedia = lightboxIndex !== null ? allImages[lightboxIndex] : null;
  const currentIsThumbnail = currentMedia === thumbnailUrl;
  const isSingleImage = allImages.length === 1;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer",
          "flex flex-col items-center justify-center gap-2 text-center",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed",
          uploading && "pointer-events-none"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || uploading}
        />

        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Enviando... {uploadProgress}%
            </p>
            <div className="w-full max-w-xs bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Arraste arquivos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Imagens (JPG, PNG, GIF, WebP) ou Vídeos (MP4, WebM) até 50MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Unified Preview Grid */}
      {allImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {allImages.map((url, index) => {
            const isThumbnail = url === thumbnailUrl || (isSingleImage && !thumbnailUrl);
            return (
              <div
                key={url}
                className={cn(
                  "relative group aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer",
                  isThumbnail && "ring-2 ring-primary"
                )}
                onClick={() => setLightboxIndex(index)}
              >
                {isVideo(url) ? (
                  <video
                    src={url}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={url}
                    alt={`Mídia ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                )}

                {/* Thumbnail badge */}
                {isThumbnail && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground shadow-md">
                    <Star className="h-3 w-3 mr-1 fill-current" />
                    Thumbnail
                  </Badge>
                )}

                {/* Type indicator */}
                {!isThumbnail && (
                  <div className="absolute bottom-2 left-2">
                    {isVideo(url) ? (
                      <div className="flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-xs">
                        <Film className="h-3 w-3" />
                        Vídeo
                      </div>
                    ) : !isManualUpload(url) ? (
                      <div className="flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-xs">
                        <Image className="h-3 w-3" />
                        Gerada
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-md">
                    Ampliar
                  </span>
                </div>

                {/* Remove Button (only for manual uploads) */}
                {isManualUpload(url) && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMedia(url);
                    }}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Files count */}
      {allImages.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {allImages.length} imagem(ns) • {value.length} enviada(s) manualmente
        </p>
      )}

      {/* Lightbox with thumbnail selection */}
      <Dialog open={lightboxOpen} onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Visualizar mídia</DialogTitle>
          {currentMedia && (
            <div className="flex flex-col">
              <div className="relative flex items-center justify-center bg-black/5 min-h-[400px] max-h-[70vh]">
                {isVideo(currentMedia) ? (
                  <video
                    src={currentMedia}
                    className="max-w-full max-h-[70vh] rounded"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={currentMedia}
                    alt={`Mídia ${(lightboxIndex ?? 0) + 1}`}
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                )}

                {allImages.length > 1 && lightboxIndex! > 0 && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-md"
                    onClick={() => setLightboxIndex(lightboxIndex! - 1)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                {allImages.length > 1 && lightboxIndex! < allImages.length - 1 && (
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
                  {(lightboxIndex ?? 0) + 1} de {allImages.length}
                  {(currentIsThumbnail || isSingleImage) && (
                    <Badge className="ml-2 bg-primary text-primary-foreground">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Thumbnail
                    </Badge>
                  )}
                </span>
                {!currentIsThumbnail && !isSingleImage && postId && onThumbnailChange && (
                  <Button
                    size="sm"
                    onClick={() => handleSetThumbnail(currentMedia)}
                    disabled={updatingThumbnail}
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
    </div>
  );
}
