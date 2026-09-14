import { useState } from "react";
import { Plus, Trash2, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AISuggestionButton } from "./AISuggestionButton";
import type { PostVariant, SocialChannel } from "@/types/marketing";

interface ABTestEditorProps {
  variants: PostVariant[];
  onVariantsChange: (variants: PostVariant[]) => void;
  baseContent?: string;
  channel?: SocialChannel;
  disabled?: boolean;
}

export function ABTestEditor({
  variants,
  onVariantsChange,
  baseContent = "",
  channel,
  disabled = false,
}: ABTestEditorProps) {
  const [isExpanded, setIsExpanded] = useState(variants.length > 0);

  const variantLabels = ["A", "B", "C", "D"];

  const addVariant = () => {
    if (variants.length >= 4) return;
    
    const newVariant: PostVariant = {
      id: `temp-${Date.now()}`,
      post_id: "",
      variant_name: variantLabels[variants.length] || `V${variants.length + 1}`,
      content: baseContent,
      media_urls: [],
      performance_score: 0,
      is_winner: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    onVariantsChange([...variants, newVariant]);
    setIsExpanded(true);
  };

  const updateVariant = (index: number, content: string) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], content, updated_at: new Date().toISOString() };
    onVariantsChange(updated);
  };

  const removeVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index);
    onVariantsChange(updated);
    if (updated.length === 0) setIsExpanded(false);
  };

  const getVariantColor = (name: string) => {
    const colors: Record<string, string> = {
      A: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      B: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      C: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      D: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return colors[name] || "bg-muted text-muted-foreground";
  };

  if (!isExpanded && variants.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Sparkles className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="font-medium text-foreground mb-1">Teste A/B</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Crie variantes do seu conteúdo para testar qual performa melhor
          </p>
          <Button variant="outline" onClick={addVariant} disabled={disabled}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Teste A/B
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Teste A/B</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {variants.length} variante{variants.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addVariant}
            disabled={disabled || variants.length >= 4}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {variants.map((variant, index) => (
          <div
            key={variant.id}
            className="relative rounded-lg border bg-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge className={getVariantColor(variant.variant_name)}>
                  Variante {variant.variant_name}
                </Badge>
                {variant.is_winner && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    <Trophy className="h-3 w-3 mr-1" />
                    Vencedor
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <AISuggestionButton
                  type="caption"
                  currentContent={variant.content || baseContent}
                  channel={channel}
                  onApply={(suggestion) => updateVariant(index, suggestion)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeVariant(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor={`variant-${index}`} className="text-xs text-muted-foreground">
                Conteúdo da variante
              </Label>
              <Textarea
                id={`variant-${index}`}
                value={variant.content || ""}
                onChange={(e) => updateVariant(index, e.target.value)}
                placeholder="Digite o conteúdo desta variante..."
                rows={4}
                disabled={disabled}
                className="resize-none"
              />
            </div>

            {variant.performance_score > 0 && (
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  Score: <span className="text-foreground font-medium">{variant.performance_score.toFixed(1)}%</span>
                </span>
              </div>
            )}
          </div>
        ))}

        {variants.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Máximo de 4 variantes por teste. Os resultados serão exibidos após a publicação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
