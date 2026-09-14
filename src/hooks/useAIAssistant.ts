import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

type AIAction = 'generate_caption' | 'suggest_hashtags' | 'adapt_tone' | 'summarize' | 'generate_ideas' | 'improve_content' | 'suggest_title' | 'suggest_excerpt';
type Tone = 'formal' | 'casual' | 'professional' | 'friendly';

interface AIRequest {
  action: AIAction;
  content?: string;
  topic?: string;
  channel?: string;
  tone?: Tone;
  workspace_id?: string;
}

interface UseAIAssistantReturn {
  isLoading: boolean;
  result: string;
  error: string | null;
  generateCaption: (topic: string, channel?: string, workspaceId?: string) => Promise<string>;
  suggestHashtags: (content: string, channel?: string, workspaceId?: string) => Promise<string>;
  adaptTone: (content: string, tone: Tone, channel?: string, workspaceId?: string) => Promise<string>;
  summarize: (content: string, workspaceId?: string) => Promise<string>;
  generateIdeas: (topic: string, channel?: string, workspaceId?: string) => Promise<string>;
  improveContent: (content: string, channel?: string, workspaceId?: string) => Promise<string>;
  suggestTitle: (content: string, channel?: string, workspaceId?: string) => Promise<string>;
  suggestExcerpt: (content: string, workspaceId?: string) => Promise<string>;
  clearResult: () => void;
}

const AI_ASSISTANT_URL = `${SUPABASE_URL}/functions/v1/mkt-ai-assistant`;

export function useAIAssistant(): UseAIAssistantReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  const streamRequest = useCallback(async (request: AIRequest): Promise<string> => {
    setIsLoading(true);
    setError(null);
    setResult('');

    try {
      const response = await fetch(AI_ASSISTANT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          const errorMsg = 'Limite de requisições excedido. Tente novamente mais tarde.';
          setError(errorMsg);
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }
        if (response.status === 402) {
          const errorMsg = 'Créditos insuficientes. Adicione créditos ao seu workspace.';
          setError(errorMsg);
          toast.error(errorMsg);
          throw new Error(errorMsg);
        }
        throw new Error('Failed to start AI stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullResult = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResult += content;
              setResult(fullResult);
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullResult += content;
              setResult(fullResult);
            }
          } catch { /* ignore */ }
        }
      }

      return fullResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar IA';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateCaption = useCallback(async (topic: string, channel?: string, workspaceId?: string) => {
    return streamRequest({ action: 'generate_caption', topic, channel, workspace_id: workspaceId });
  }, [streamRequest]);

  const suggestHashtags = useCallback(async (content: string, channel?: string, workspaceId?: string) => {
    return streamRequest({ action: 'suggest_hashtags', content, channel, workspace_id: workspaceId });
  }, [streamRequest]);

  const adaptTone = useCallback(async (content: string, tone: Tone, channel?: string, workspaceId?: string) => {
    return streamRequest({ action: 'adapt_tone', content, tone, channel, workspace_id: workspaceId });
  }, [streamRequest]);

  const summarize = useCallback(async (content: string, workspaceId?: string) => {
    return streamRequest({ action: 'summarize', content, workspace_id: workspaceId });
  }, [streamRequest]);

  const generateIdeas = useCallback(async (topic: string, channel?: string, workspaceId?: string) => {
    return streamRequest({ action: 'generate_ideas', topic, channel, workspace_id: workspaceId });
  }, [streamRequest]);

  const improveContent = useCallback(async (content: string, channel?: string, workspaceId?: string) => {
    return streamRequest({ action: 'improve_content', content, channel, workspace_id: workspaceId });
  }, [streamRequest]);

  const suggestTitle = useCallback(async (content: string, channel?: string, workspaceId?: string) => {
    return streamRequest({ action: 'suggest_title', content, channel, workspace_id: workspaceId });
  }, [streamRequest]);

  const suggestExcerpt = useCallback(async (content: string, workspaceId?: string) => {
    return streamRequest({ action: 'suggest_excerpt', content, workspace_id: workspaceId });
  }, [streamRequest]);

  const clearResult = useCallback(() => {
    setResult('');
    setError(null);
  }, []);

  return {
    isLoading,
    result,
    error,
    generateCaption,
    suggestHashtags,
    adaptTone,
    summarize,
    generateIdeas,
    improveContent,
    suggestTitle,
    suggestExcerpt,
    clearResult,
  };
}
