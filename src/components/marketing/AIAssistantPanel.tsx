import { useState } from "react";
import { Sparkles, Copy, Check, Loader2, Wand2, Hash, MessageSquare, Lightbulb, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import type { SocialChannel } from "@/types/marketing";

interface PlaybookData {
  prompt_master?: string;
  do_list?: string[];
  dont_list?: string[];
}

interface AIAssistantPanelProps {
  currentContent?: string;
  currentChannel?: SocialChannel;
  onApplyCaption?: (caption: string) => void;
  onApplyHashtags?: (hashtags: string) => void;
  playbookMode?: boolean;
  playbook?: PlaybookData;
}

export function AIAssistantPanel({
  currentContent = "",
  currentChannel,
  onApplyCaption,
  onApplyHashtags,
  playbookMode = false,
  playbook,
}: AIAssistantPanelProps) {
  const { isLoading, result, generateCaption, suggestHashtags, adaptTone, summarize, generateIdeas, clearResult } = useAIAssistant();
  const { currentWorkspace } = useWorkspace();
  
  const [topic, setTopic] = useState("");
  const [selectedTone, setSelectedTone] = useState<"formal" | "casual" | "professional" | "friendly">("professional");
  const [copied, setCopied] = useState(false);

  const workspaceId = currentWorkspace?.id;

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateCaption = async () => {
    if (!topic.trim() && !currentContent.trim()) {
      toast.error("Digite um tópico ou tenha conteúdo no post");
      return;
    }
    clearResult();
    await generateCaption(topic || currentContent, currentChannel, workspaceId);
  };

  const handleSuggestHashtags = async () => {
    if (!currentContent.trim() && !topic.trim()) {
      toast.error("Adicione conteúdo ao post primeiro");
      return;
    }
    clearResult();
    await suggestHashtags(currentContent || topic, currentChannel, workspaceId);
  };

  const handleAdaptTone = async () => {
    if (!currentContent.trim()) {
      toast.error("Adicione conteúdo ao post primeiro");
      return;
    }
    clearResult();
    await adaptTone(currentContent, selectedTone, currentChannel, workspaceId);
  };

  const handleSummarize = async () => {
    if (!currentContent.trim()) {
      toast.error("Adicione conteúdo ao post primeiro");
      return;
    }
    clearResult();
    await summarize(currentContent, workspaceId);
  };

  const handleGenerateIdeas = async () => {
    if (!topic.trim()) {
      toast.error("Digite um tema para gerar ideias");
      return;
    }
    clearResult();
    await generateIdeas(topic, currentChannel, workspaceId);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-card/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Assistente IA
        </CardTitle>
        <CardDescription>
          {playbookMode ? (
            <span className="flex items-center gap-1.5 text-primary">
              <BookOpen className="h-3.5 w-3.5" />
              Usando direção estratégica do Playbook
            </span>
          ) : (
            "Use IA para gerar legendas, hashtags e muito mais"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="caption" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="caption" className="text-xs px-1 py-1.5">
              <Wand2 className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Legenda</span>
            </TabsTrigger>
            <TabsTrigger value="hashtags" className="text-xs px-1 py-1.5">
              <Hash className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Hashtags</span>
            </TabsTrigger>
            <TabsTrigger value="tone" className="text-xs px-1 py-1.5">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Tom</span>
            </TabsTrigger>
            <TabsTrigger value="summarize" className="text-xs px-1 py-1.5">
              <FileText className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Resumir</span>
            </TabsTrigger>
            <TabsTrigger value="ideas" className="text-xs px-1 py-1.5">
              <Lightbulb className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Ideias</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="caption" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Tópico ou tema</Label>
              <Input
                id="topic"
                placeholder="Ex: Lançamento do novo produto..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              {/* Playbook topic suggestions */}
              {playbookMode && playbook?.do_list && playbook.do_list.length > 0 && !topic && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-xs text-muted-foreground">Sugestões:</span>
                  {playbook.do_list.slice(0, 3).map((item, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="h-5 text-xs px-2 py-0 text-primary hover:text-primary"
                      onClick={() => setTopic(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <Button 
              onClick={handleGenerateCaption} 
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Gerar Legenda
            </Button>
          </TabsContent>

          <TabsContent value="hashtags" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Gere hashtags baseadas no conteúdo atual do post.
            </p>
            <Button 
              onClick={handleSuggestHashtags} 
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Hash className="mr-2 h-4 w-4" />
              )}
              Sugerir Hashtags
            </Button>
          </TabsContent>

          <TabsContent value="tone" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label>Tom desejado</Label>
              <Select value={selectedTone} onValueChange={(v) => setSelectedTone(v as typeof selectedTone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="friendly">Amigável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAdaptTone} 
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              Adaptar Tom
            </Button>
          </TabsContent>

          <TabsContent value="summarize" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Gere um resumo conciso do conteúdo atual do post.
            </p>
            <Button
              onClick={handleSummarize}
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Resumir conteúdo
            </Button>
          </TabsContent>

          <TabsContent value="ideas" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="idea-topic">Tema para ideias</Label>
              <Input
                id="idea-topic"
                placeholder="Ex: Marketing digital, sustentabilidade..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleGenerateIdeas} 
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="mr-2 h-4 w-4" />
              )}
              Gerar Ideias
            </Button>
          </TabsContent>
        </Tabs>

        {/* Result Area */}
        {(result || isLoading) && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Resultado</Label>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
                  disabled={!result}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Textarea
                value={result}
                readOnly
                className="min-h-[120px] resize-none bg-muted/50"
                placeholder={isLoading ? "Gerando..." : ""}
              />
              {isLoading && !result && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/20 rounded-md">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            {result && onApplyCaption && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => onApplyCaption(result)}
              >
                Usar esta sugestão
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
