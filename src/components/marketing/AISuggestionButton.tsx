import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Copy, Check, Wand2, PenLine, Instagram, Linkedin, FileText, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'blog';

interface AISuggestionButtonProps {
  type: "caption" | "hashtags" | "title" | "excerpt";
  currentContent?: string;
  channel?: string;
  workspaceId?: string;
  onApply: (suggestion: string) => void;
}

const platformOptions: { value: Platform; label: string; icon: React.ReactNode }[] = [
  { value: 'instagram', label: 'Instagram', icon: <Instagram className="h-3 w-3" /> },
  { value: 'facebook', label: 'Facebook', icon: <Facebook className="h-3 w-3" /> },
  { value: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-3 w-3" /> },
  { value: 'blog', label: 'Blog', icon: <FileText className="h-3 w-3" /> },
];

export function AISuggestionButton({
  type,
  currentContent = "",
  channel,
  workspaceId,
  onApply,
}: AISuggestionButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'generate' | 'improve'>('generate');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>((channel as Platform) || 'instagram');
  const { currentWorkspace } = useWorkspace();
  const { isLoading, result, generateCaption, suggestHashtags, improveContent, suggestTitle, suggestExcerpt, clearResult } = useAIAssistant();
  const resultRef = useRef<string>('');
  
  const effectiveWorkspaceId = workspaceId || currentWorkspace?.id;

  // Keep ref in sync with result for reliable apply
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const handleGenerate = async () => {
    if (!currentContent.trim()) {
      const errorMessages: Record<string, string> = {
        caption: "Digite um tópico primeiro",
        hashtags: "Adicione conteúdo primeiro",
        title: "Digite a legenda primeiro para gerar um título",
        excerpt: "Digite o conteúdo primeiro para gerar um resumo",
      };
      toast.error(errorMessages[type] || "Adicione conteúdo primeiro");
      return;
    }
    clearResult();
    resultRef.current = '';
    
    try {
      if (type === "caption") {
        if (mode === 'improve') {
          await improveContent(currentContent, selectedPlatform, effectiveWorkspaceId);
        } else {
          await generateCaption(currentContent, selectedPlatform, effectiveWorkspaceId);
        }
      } else if (type === "title") {
        await suggestTitle(currentContent, selectedPlatform, effectiveWorkspaceId);
      } else if (type === "excerpt") {
        await suggestExcerpt(currentContent, effectiveWorkspaceId);
      } else {
        await suggestHashtags(currentContent, selectedPlatform, effectiveWorkspaceId);
      }
    } catch (error) {
      // Error already handled via toast in useAIAssistant
      console.log('AI generation error:', error);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    const textToApply = resultRef.current || result;
    if (textToApply) {
      onApply(textToApply);
      setOpen(false);
      clearResult();
      resultRef.current = '';
      toast.success("Aplicado com sucesso!");
    } else {
      toast.error("Aguarde a geração terminar");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10"
          title={
            type === "caption" ? "Gerar legenda com IA" : 
            type === "title" ? "Sugerir título com IA" :
            type === "excerpt" ? "Sugerir resumo com IA" :
            "Sugerir hashtags com IA"
          }
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">
              {type === "caption" ? "Assistente de Legenda" : 
               type === "title" ? "Sugerir Título" :
               type === "excerpt" ? "Sugerir Resumo" :
               "Sugerir Hashtags"}
            </span>
          </div>
          
          {/* Platform Selector */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Para qual plataforma?</span>
            <div className="flex flex-wrap gap-1">
              {platformOptions.map((platform) => (
                <Button
                  key={platform.value}
                  variant={selectedPlatform === platform.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs flex-1 min-w-[70px]"
                  onClick={() => { setSelectedPlatform(platform.value); clearResult(); }}
                >
                  {platform.icon}
                  <span className="ml-1">{platform.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {type === "caption" && (
            <div className="flex gap-1 p-1 bg-muted rounded-md">
              <Button
                variant={mode === 'generate' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => { setMode('generate'); clearResult(); }}
              >
                <Wand2 className="mr-1 h-3 w-3" />
                Gerar Nova
              </Button>
              <Button
                variant={mode === 'improve' ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => { setMode('improve'); clearResult(); }}
              >
                <PenLine className="mr-1 h-3 w-3" />
                Melhorar
              </Button>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            {type === "caption" 
              ? selectedPlatform === 'blog'
                ? "Texto profissional, técnico e denso para blog."
                : selectedPlatform === 'linkedin'
                  ? "Tom profissional com storytelling corporativo."
                  : mode === 'improve'
                    ? "A IA irá melhorar o texto mantendo a essência."
                    : "Texto casual e engajante para redes sociais."
              : type === "title"
                ? "A IA irá sugerir um título impactante."
                : type === "excerpt"
                  ? "A IA irá criar um resumo conciso."
                  : "A IA irá sugerir hashtags relevantes."}
          </p>

          <Button 
            onClick={handleGenerate} 
            disabled={isLoading}
            className="w-full"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : mode === 'improve' && type === 'caption' ? (
              <PenLine className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "Processando..." : mode === 'improve' && type === 'caption' ? "Melhorar Texto" : "Gerar com IA"}
          </Button>

          {result && (
            <div className="space-y-2">
              <Textarea
                value={result}
                readOnly
                className="min-h-[80px] resize-none text-sm bg-muted/50"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="mr-1 h-3 w-3" />
                  ) : (
                    <Copy className="mr-1 h-3 w-3" />
                  )}
                  Copiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleApply}
                  disabled={isLoading || !result}
                >
                  {isLoading ? "Aguarde..." : "Usar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
