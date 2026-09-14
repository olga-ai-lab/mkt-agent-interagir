import { useState } from "react";
import { Download, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { CompanyBadge } from "@/components/marketing/CompanyBadge";
import type { GalleryFile } from "@/hooks/useGalleryMedia";

interface GalleryGridProps {
  files: GalleryFile[];
  onOpen: (index: number) => void;
  onDelete: (path: string) => void;
  isDeleting: boolean;
}

export function GalleryGrid({ files, onOpen, onDelete, isDeleting }: GalleryGridProps) {
  const [deleteTarget, setDeleteTarget] = useState<GalleryFile | null>(null);

  const handleDownload = async (e: React.MouseEvent, file: GalleryFile) => {
    e.stopPropagation();
    const response = await fetch(file.publicUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Nenhuma mídia encontrada</p>
        <p className="text-sm">Faça upload de imagens ou vídeos nos seus posts</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {files.map((file, index) => (
          <div
            key={file.path}
            className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-muted aspect-square"
            onClick={() => onOpen(index)}
          >
            {file.type === "video" ? (
              <div className="flex h-full items-center justify-center bg-muted">
                <Play className="h-10 w-10 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={file.publicUrl}
                alt={file.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            )}
            {file.company && (
              <div className="absolute left-2 top-2 z-10">
                <CompanyBadge company={file.company} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40" />
            <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={(e) => handleDownload(e, file)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(file);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget.path);
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget?.name}
        loading={isDeleting}
      />
    </>
  );
}
