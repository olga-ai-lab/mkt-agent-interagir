import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Hash, 
  Bookmark, 
  Sparkles, 
  ImageIcon,
  LayoutGrid,
  Video,
  RefreshCw,
} from 'lucide-react';
import type { AITrendPlaybook } from '@/types/ai-insights';
import { useNavigate } from 'react-router-dom';

interface PlaybookPanelProps {
  playbook: AITrendPlaybook | null;
  onUpdatePlaybook: (updates: Partial<AITrendPlaybook>) => void;
  onAnalyzePosts?: () => void;
  isUpdating?: boolean;
  isAnalyzing?: boolean;
}

export function PlaybookPanel({ 
  playbook, 
  onUpdatePlaybook, 
  onAnalyzePosts, 
  isUpdating, 
  isAnalyzing,
}: PlaybookPanelProps) {
  const navigate = useNavigate();

  const getFormatIcon = (format: string) => {
    if (format.toLowerCase().includes('carrossel')) return LayoutGrid;
    if (format.toLowerCase().includes('reel') || format.toLowerCase().includes('video')) return Video;
    return ImageIcon;
  };

  if (!playbook) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">Playbook não disponível</h3>
          <p className="text-sm text-muted-foreground mb-4">
            O playbook será gerado automaticamente após a análise de posts publicados.
          </p>
          <Button 
            variant="outline" 
            onClick={onAnalyzePosts}
            disabled={isAnalyzing}
          >
            {isAnalyzing && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Analisar Posts Agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Do & Don't Lists */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Do List */}
        <Card className="border-green-200 dark:border-green-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Faça
            </CardTitle>
          </CardHeader>
          <CardContent>
            {playbook.do_list && playbook.do_list.length > 0 ? (
              <ul className="space-y-2">
                {playbook.do_list.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma recomendação ainda.</p>
            )}
          </CardContent>
        </Card>

        {/* Don't List */}
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              Evite
            </CardTitle>
          </CardHeader>
          <CardContent>
            {playbook.dont_list && playbook.dont_list.length > 0 ? (
              <ul className="space-y-2">
                {playbook.dont_list.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum padrão a evitar identificado.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Indicators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Indicadores de Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Best Formats */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" /> Melhores Formatos
              </p>
              <div className="flex flex-wrap gap-1">
                {playbook.best_formats?.length > 0 ? (
                  playbook.best_formats.map((format, idx) => {
                    const Icon = getFormatIcon(format);
                    return (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <Icon className="h-3 w-3 mr-1" />
                        {format}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
            </div>

            {/* Best Times */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3 w-3" /> Melhores Horários
              </p>
              <div className="flex flex-wrap gap-1">
                {playbook.best_posting_times?.length > 0 ? (
                  playbook.best_posting_times.map((time, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {time}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
            </div>

            {/* Top Hashtags */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Hash className="h-3 w-3" /> Top Hashtags
              </p>
              <div className="flex flex-wrap gap-1">
                {playbook.top_hashtags?.length > 0 ? (
                  playbook.top_hashtags.slice(0, 5).map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      #{tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </div>
            </div>

            {/* Save Rate */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Bookmark className="h-3 w-3" /> Taxa de Salvamento
              </p>
              <p className="text-2xl font-bold text-primary">
                {(playbook.avg_save_rate || 0).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Apply to Creator CTA */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          onClick={() => navigate('/app/posts/new?from_playbook=true')}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Criar Post com Playbook
        </Button>
      </div>
    </div>
  );
}
