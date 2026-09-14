import { useState, useRef, useCallback, useEffect } from "react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

interface UseTextToSpeechOptions {
  text: string;
  title?: string;
  articleId?: string;
}

interface UseTextToSpeechReturn {
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  progress: number;
  generationProgress: number;
  isGenerating: boolean;
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => Promise<void>;
  seek: (time: number) => void;
  audioReady: boolean;
  isCached: boolean;
}

// Estimate generation time: ~12ms per character for turbo model
const MS_PER_CHAR = 12;

export function useTextToSpeech({ text, title, articleId }: UseTextToSpeechOptions): UseTextToSpeechReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate estimated generation time based on text length
  const getEstimatedGenerationTime = useCallback(() => {
    const cleanText = text?.replace(/<[^>]+>/g, "") || "";
    const charCount = Math.min(cleanText.length, 5000);
    return charCount * MS_PER_CHAR;
  }, [text]);

  // Start progress estimation
  const startProgressEstimation = useCallback(() => {
    const estimatedTime = getEstimatedGenerationTime();
    const startTime = Date.now();
    
    setIsGenerating(true);
    setGenerationProgress(0);

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / estimatedTime) * 100, 95); // Cap at 95% until complete
      setGenerationProgress(Math.round(progress));
    }, 200);
  }, [getEstimatedGenerationTime]);

  // Stop progress estimation
  const stopProgressEstimation = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsGenerating(false);
    setGenerationProgress(100);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current && !audioUrlRef.current.startsWith('http')) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const setupAudioElement = useCallback((audioUrl: string) => {
    // Create and setup audio element
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audioUrlRef.current = audioUrl;

    // Setup event listeners
    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
      setAudioReady(true);
    });

    audio.addEventListener("timeupdate", () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    audio.addEventListener("error", () => {
      setError("Erro ao reproduzir áudio");
      setIsPlaying(false);
    });

    return new Promise<void>((resolve, reject) => {
      audio.addEventListener("canplaythrough", () => resolve(), { once: true });
      audio.addEventListener("error", () => reject(new Error("Erro ao carregar áudio")), { once: true });
      audio.load();
    });
  }, []);

  const generateAudio = useCallback(async () => {
    if (audioReady && audioRef.current) {
      return; // Audio already generated
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/mkt-elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, title, articleId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao gerar áudio: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      const isStreaming = response.headers.get('x-streaming') === 'true';
      
      // Check if response is JSON (cached URL) or binary audio
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        if (data.cached && data.audioUrl) {
          console.log('Using cached audio:', data.audioUrl);
          setIsCached(true);
          await setupAudioElement(data.audioUrl);
        }
      } else {
        // Streaming or binary audio response
        if (isStreaming) {
          startProgressEstimation();
        }
        
        const audioBlob = await response.blob();
        
        stopProgressEstimation();
        
        // Revoke previous URL if exists
        if (audioUrlRef.current && !audioUrlRef.current.startsWith('http')) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        await setupAudioElement(audioUrl);
      }

    } catch (err) {
      stopProgressEstimation();
      const message = err instanceof Error ? err.message : "Erro ao gerar áudio";
      setError(message);
      console.error("TTS Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [text, title, articleId, audioReady, setupAudioElement, startProgressEstimation, stopProgressEstimation]);

  const play = useCallback(async () => {
    if (!audioRef.current) {
      await generateAudio();
    }

    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Play error:", err);
        setError("Erro ao iniciar reprodução");
      }
    }
  }, [generateAudio]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return {
    isLoading,
    isPlaying,
    error,
    currentTime,
    duration,
    progress,
    generationProgress,
    isGenerating,
    play,
    pause,
    togglePlayPause,
    seek,
    audioReady,
    isCached,
  };
}
