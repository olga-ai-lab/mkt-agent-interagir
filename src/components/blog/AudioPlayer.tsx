import { Headphones, Play, Pause, Loader2, AlertCircle, Volume2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  text: string;
  title?: string;
  articleId?: string;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ text, title, articleId, className }: AudioPlayerProps) {
  const {
    isLoading,
    isPlaying,
    error,
    currentTime,
    duration,
    progress,
    generationProgress,
    isGenerating,
    togglePlayPause,
    seek,
    audioReady,
    isCached,
  } = useTextToSpeech({ text, title, articleId });

  // Estimate reading time (average 150 words per minute for TTS)
  const wordCount = text?.replace(/<[^>]+>/g, "").split(/\s+/).length || 0;
  const estimatedMinutes = Math.ceil(wordCount / 150);

  // Calculate estimated remaining time during generation
  const getEstimatedRemainingTime = () => {
    if (!isGenerating || generationProgress === 0) return null;
    const cleanText = text?.replace(/<[^>]+>/g, "") || "";
    const charCount = Math.min(cleanText.length, 5000);
    const totalEstimatedMs = charCount * 12; // 12ms per char
    const elapsedMs = (generationProgress / 100) * totalEstimatedMs;
    const remainingMs = totalEstimatedMs - elapsedMs;
    const remainingSecs = Math.ceil(remainingMs / 1000);
    return remainingSecs > 0 ? `~${remainingSecs}s` : null;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioReady || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  const showGenerationProgress = isLoading && isGenerating && generationProgress > 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-muted/30 p-4 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          {isLoading ? (
            showGenerationProgress ? (
              <Zap className="h-6 w-6 text-primary animate-pulse" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )
          ) : error ? (
            <AlertCircle className="h-6 w-6 text-destructive" />
          ) : isPlaying ? (
            <Volume2 className="h-6 w-6 text-primary animate-pulse" />
          ) : (
            <Headphones className="h-6 w-6 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {showGenerationProgress
                  ? `Gerando áudio... ${generationProgress}%`
                  : isLoading
                    ? "Preparando áudio..."
                    : error
                      ? "Erro ao gerar áudio"
                      : "Ouvir este artigo"}
              </span>
              {isCached && audioReady && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Zap className="h-3 w-3" />
                  Instantâneo
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {audioReady
                ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                : showGenerationProgress
                  ? getEstimatedRemainingTime() || `~${estimatedMinutes} min`
                  : `~${estimatedMinutes} min`}
            </span>
          </div>

          {/* Progress bar */}
          {showGenerationProgress ? (
            <div className="mt-2">
              <Progress value={generationProgress} className="h-2" />
            </div>
          ) : audioReady ? (
            <div
              className="mt-2 cursor-pointer"
              onClick={handleProgressClick}
              role="slider"
              aria-label="Progresso do áudio"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <Progress value={progress} className="h-2" />
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {error || "Clique para ouvir a versão em áudio deste artigo"}
            </p>
          )}
        </div>

        {/* Play/Pause Button */}
        <Button
          variant="default"
          size="icon"
          className="h-10 w-10 flex-shrink-0 rounded-full"
          onClick={togglePlayPause}
          disabled={isLoading}
          aria-label={isPlaying ? "Pausar" : "Reproduzir"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
      </div>

      {/* Error retry button */}
      {error && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full text-sm"
          onClick={togglePlayPause}
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
