import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Lightbulb, 
  Sparkles, 
  FileText, 
  Calendar, 
  X,
  ImageIcon,
  LayoutGrid,
  Video,
} from 'lucide-react';
import type { AIContentSuggestion } from '@/types/ai-insights';
import { cn } from '@/lib/utils';

interface SuggestionCardProps {
  suggestion: AIContentSuggestion;
  onCreateDraft: (suggestion: AIContentSuggestion) => void;
  onSchedule: (suggestion: AIContentSuggestion) => void;
  onDismiss: (suggestion: AIContentSuggestion) => void;
  isLoading?: boolean;
}

export function SuggestionCard({
  suggestion,
  onCreateDraft,
  onSchedule,
  onDismiss,
  isLoading,
}: SuggestionCardProps) {
  const getFormatIcon = (format?: string) => {
    if (!format) return Lightbulb;
    if (format.toLowerCase().includes('carrossel')) return LayoutGrid;
    if (format.toLowerCase().includes('reel') || format.toLowerCase().includes('video')) return Video;
    if (format.toLowerCase().includes('imagem')) return ImageIcon;
    return Lightbulb;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    if (confidence >= 60) return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
    return 'text-muted-foreground bg-muted';
  };

  const FormatIcon = getFormatIcon(suggestion.format);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FormatIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">{suggestion.idea_title}</h4>
              {suggestion.format && (
                <Badge variant="outline" className="text-xs">
                  {suggestion.format}
                </Badge>
              )}
            </div>
          </div>
          <Badge className={cn('text-xs', getConfidenceColor(suggestion.confidence))}>
            <Sparkles className="h-3 w-3 mr-1" />
            {suggestion.confidence}%
          </Badge>
        </div>

        {/* Hook */}
        {suggestion.hook && (
          <div className="mb-3 p-2 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground uppercase mb-1">Hook sugerido</p>
            <p className="text-sm font-medium">{suggestion.hook}</p>
          </div>
        )}

        {/* Angle */}
        {suggestion.angle && (
          <p className="text-sm text-muted-foreground mb-3">
            <span className="font-medium">Ângulo:</span> {suggestion.angle}
          </p>
        )}

        {/* Caption Draft Preview */}
        {suggestion.caption_draft && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground uppercase mb-1">Rascunho da legenda</p>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {suggestion.caption_draft}
            </p>
          </div>
        )}

        {/* Objective */}
        {suggestion.objective && (
          <p className="text-xs text-muted-foreground mb-4">
            <span className="font-medium">Objetivo:</span> {suggestion.objective}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button 
            size="sm" 
            onClick={() => onCreateDraft(suggestion)}
            disabled={isLoading}
            className="flex-1"
          >
            <FileText className="h-3 w-3 mr-1" />
            Criar Rascunho
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onSchedule(suggestion)}
            disabled={isLoading}
          >
            <Calendar className="h-3 w-3" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => onDismiss(suggestion)}
            disabled={isLoading}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
