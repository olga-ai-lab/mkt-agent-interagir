import { useState } from "react";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AINewsletterAssistantProps {
  campaignType: string;
  selectedSegments: string[];
  currentSubject: string;
  currentContent: string;
  onApplySubject: (subject: string) => void;
  onApplyContent: (content: string) => void;
}

export function AINewsletterAssistant({
  campaignType,
  selectedSegments,
  currentSubject,
  currentContent,
  onApplySubject,
  onApplyContent,
}: AINewsletterAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ subject: string; content: string } | null>(null);
  const [briefing, setBriefing] = useState("");

  const generateSuggestion = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mkt-ai-newsletter-assist", {
        body: {
          campaign_type: campaignType,
          segments: selectedSegments,
          current_subject: currentSubject,
          current_content: currentContent,
          briefing,
        },
      });

      if (error) throw error;

      if (data?.subject && data?.content) {
        setSuggestion({ subject: data.subject, content: data.content });
      } else {
        toast.error("Não foi possível gerar sugestão");
      }
    } catch (err) {
      console.error("AI error:", err);
      toast.error("Erro ao gerar sugestão com IA");
    } finally {
      setLoading(false);
    }
  };

  const CAMPAIGN_LABELS: Record<string, string> = {
    circular: "Circular",
    novidade: "Novidade",
    comunicado: "Comunicado",
    marketing: "Marketing",
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Assistente IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1 text-xs">
          <Badge variant="outline">{CAMPAIGN_LABELS[campaignType] || campaignType}</Badge>
          {selectedSegments.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
          ))}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Briefing (opcional)</Label>
          <Textarea
            placeholder="Descreva o tema, objetivo ou público-alvo..."
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>

        <Button
          onClick={generateSuggestion}
          disabled={loading}
          className="w-full gap-2"
          size="sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Gerar Sugestão com IA
        </Button>

        {suggestion && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <p className="text-xs font-medium mb-1">Assunto sugerido:</p>
              <p className="text-sm bg-muted/50 p-2 rounded">{suggestion.subject}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs mt-1"
                onClick={() => { onApplySubject(suggestion.subject); toast.success("Assunto aplicado!"); }}
              >
                Usar este assunto
              </Button>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Conteúdo sugerido:</p>
              <div className="text-xs bg-muted/50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                {suggestion.content.substring(0, 500)}...
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs mt-1"
                onClick={() => { onApplyContent(suggestion.content); toast.success("Conteúdo aplicado!"); }}
              >
                Usar este conteúdo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
