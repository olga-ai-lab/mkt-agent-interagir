import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GalleryFile } from "@/hooks/useGalleryMedia";

interface LightboxModalProps {
  files: GalleryFile[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function LightboxModal({ files, currentIndex, onClose, onNavigate }: LightboxModalProps) {
  const file = files[currentIndex];

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
  }, [currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < files.length - 1) onNavigate(currentIndex + 1);
  }, [currentIndex, files.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  const handleDownload = async () => {
    if (!file) return;
    const response = await fetch(file.publicUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
          <Download className="h-5 w-5" />
        </Button>
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="absolute top-4 left-4 text-sm text-white/70">
        {currentIndex + 1} / {files.length}
      </div>

      {currentIndex > 0 && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-4 text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      {currentIndex < files.length - 1 && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-4 text-white hover:bg-white/20 h-12 w-12"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {file.type === "video" ? (
          <video src={file.publicUrl} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded" />
        ) : (
          <img src={file.publicUrl} alt={file.name} className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
        )}
      </div>
    </div>
  );
}
