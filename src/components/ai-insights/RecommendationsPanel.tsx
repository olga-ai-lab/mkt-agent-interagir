import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  TrendingUp, 
  Target, 
  Zap, 
  Calendar,
  Hash,
  ImageIcon,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import type { AITrendPlaybook } from '@/types/ai-insights';

interface PostWithAnalytics {
  id: string;
  title: string;
  published_at?: string;
  channels: string[];
  analytics: {
    engagement_rate?: number;
    impressions?: number;
    likes?: number;
    comments?: number;
    saves?: number;
    shares?: number;
    channel: string;
  }[];
  insight?: {
    performance_score?: number;
    strengths?: string[];
    weaknesses?: string[];
  };
}

interface RecommendationsPanelProps {
  playbook: AITrendPlaybook | null;
  posts: PostWithAnalytics[];
  isLoading?: boolean;
}

interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'insight';
  category: string;
  title: string;
  description: string;
  metric?: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
}

export function RecommendationsPanel({ playbook, posts, isLoading }: RecommendationsPanelProps) {
  // Generate recommendations based on data analysis
  const recommendations = generateRecommendations(playbook, posts);
  
  // Calculate posting frequency stats
  const frequencyStats = calculateFrequencyStats(posts);
  
  // Get performance trends
  const trends = calculateTrends(posts);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/3 mb-4" />
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Frequência Ideal</span>
            </div>
            <p className="text-2xl font-bold">{frequencyStats.idealFrequency}</p>
            <p className="text-xs text-muted-foreground">posts/semana</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Melhor Horário</span>
            </div>
            <p className="text-2xl font-bold">{playbook?.best_posting_times?.[0] || '-'}</p>
            <p className="text-xs text-muted-foreground">maior engajamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Tendência</span>
            </div>
            <p className={`text-2xl font-bold ${trends.direction === 'up' ? 'text-green-600' : trends.direction === 'down' ? 'text-red-600' : ''}`}>
              {trends.direction === 'up' ? '+' : trends.direction === 'down' ? '-' : ''}{trends.percentage}%
            </p>
            <p className="text-xs text-muted-foreground">vs período anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs">Score Médio</span>
            </div>
            <p className="text-2xl font-bold">{trends.avgScore}</p>
            <p className="text-xs text-muted-foreground">performance</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Timing Recommendations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Horários Recomendados
            </CardTitle>
            <CardDescription>Baseado na performance dos seus posts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbook?.best_posting_times?.slice(0, 3).map((time, idx) => (
              <div key={time} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="w-6 h-6 p-0 justify-center">
                    {idx + 1}
                  </Badge>
                  <span className="font-medium">{time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={100 - (idx * 20)} className="w-20 h-2" />
                  <span className="text-xs text-muted-foreground w-12">{100 - (idx * 20)}%</span>
                </div>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground">Publique mais posts para análise</p>
            )}
          </CardContent>
        </Card>

        {/* Format Recommendations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Formatos que Funcionam
            </CardTitle>
            <CardDescription>Tipos de conteúdo com melhor performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbook?.best_formats?.slice(0, 3).map((format, idx) => (
              <div key={format} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={idx === 0 ? 'default' : 'secondary'} className="w-6 h-6 p-0 justify-center">
                    {idx + 1}
                  </Badge>
                  <span className="font-medium">{format}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {idx === 0 ? 'Top performer' : idx === 1 ? 'Recomendado' : 'Bom'}
                </Badge>
              </div>
            )) || (
              <p className="text-sm text-muted-foreground">Publique mais posts para análise</p>
            )}
          </CardContent>
        </Card>

        {/* Hashtag Strategy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" />
              Estratégia de Hashtags
            </CardTitle>
            <CardDescription>Tags com maior alcance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {playbook?.top_hashtags?.slice(0, 8).map((tag, idx) => (
                <Badge 
                  key={tag} 
                  variant={idx < 3 ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  #{tag}
                </Badge>
              )) || (
                <p className="text-sm text-muted-foreground">Nenhuma hashtag analisada ainda</p>
              )}
            </div>
            {playbook?.top_hashtags && playbook.top_hashtags.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                💡 Use 3-5 hashtags do top 10 em cada post
              </p>
            )}
          </CardContent>
        </Card>

        {/* Engagement Insights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Padrões de Engajamento
            </CardTitle>
            <CardDescription>O que gera mais interações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {playbook?.do_list?.slice(0, 3).map((item) => (
              <div key={item} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
            {playbook?.dont_list?.slice(0, 2).map((item) => (
              <div key={item} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
            {(!playbook?.do_list || playbook.do_list.length === 0) && (
              <p className="text-sm text-muted-foreground">Analise posts para ver padrões</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Recomendações da IA
          </CardTitle>
          <CardDescription>Ações sugeridas baseadas na sua performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div 
                key={rec.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  rec.type === 'success' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900' :
                  rec.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' :
                  'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900'
                }`}
              >
                <div className={`p-1.5 rounded-full ${
                  rec.type === 'success' ? 'bg-green-100 dark:bg-green-900' :
                  rec.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900' :
                  'bg-blue-100 dark:bg-blue-900'
                }`}>
                  {rec.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : rec.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {rec.category}
                    </Badge>
                    <Badge 
                      variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                  {rec.action && (
                    <p className="text-xs font-medium text-primary mt-2 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      {rec.action}
                    </p>
                  )}
                </div>
                {rec.metric && (
                  <div className="text-right">
                    <p className="text-lg font-bold">{rec.metric}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function generateRecommendations(playbook: AITrendPlaybook | null, posts: PostWithAnalytics[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  // Analyze posting consistency
  const postsPerWeek = posts.length > 0 ? Math.round((posts.length / 4)) : 0;
  
  if (postsPerWeek < 3) {
    recommendations.push({
      id: 'freq-low',
      type: 'warning',
      category: 'Frequência',
      title: 'Aumente a frequência de posts',
      description: `Você está postando ${postsPerWeek} vezes por semana. Recomendamos 4-5 posts para manter engajamento.`,
      action: 'Agende mais conteúdo no calendário',
      priority: 'high',
    });
  } else if (postsPerWeek >= 5) {
    recommendations.push({
      id: 'freq-good',
      type: 'success',
      category: 'Frequência',
      title: 'Ótima consistência de posts!',
      description: `Você mantém uma média de ${postsPerWeek} posts por semana. Continue assim!`,
      metric: `${postsPerWeek}/sem`,
      priority: 'low',
    });
  }

  // Analyze save rate
  if (playbook?.avg_save_rate) {
    if (playbook.avg_save_rate > 5) {
      recommendations.push({
        id: 'saves-high',
        type: 'success',
        category: 'Salvamentos',
        title: 'Taxa de salvamento excelente!',
        description: 'Seu conteúdo está sendo salvo acima da média. Isso indica alto valor percebido.',
        metric: `${playbook.avg_save_rate.toFixed(1)}%`,
        priority: 'low',
      });
    } else if (playbook.avg_save_rate < 2) {
      recommendations.push({
        id: 'saves-low',
        type: 'insight',
        category: 'Salvamentos',
        title: 'Aumente o valor do conteúdo',
        description: 'Taxa de salvamento baixa. Tente incluir dicas práticas, listas ou tutoriais que as pessoas queiram guardar.',
        action: 'Crie conteúdo educacional ou listas',
        priority: 'medium',
      });
    }
  }

  // Best time recommendation
  if (playbook?.best_posting_times && playbook.best_posting_times.length > 0) {
    recommendations.push({
      id: 'timing',
      type: 'insight',
      category: 'Horário',
      title: `Seu horário ideal é ${playbook.best_posting_times[0]}`,
      description: 'Baseado na análise dos seus posts com melhor performance. Agende publicações neste horário.',
      action: 'Configure agendamento automático',
      priority: 'medium',
    });
  }

  // Format recommendation
  if (playbook?.best_formats && playbook.best_formats.length > 0) {
    recommendations.push({
      id: 'format',
      type: 'insight',
      category: 'Formato',
      title: `Invista mais em ${playbook.best_formats[0]}`,
      description: 'Este formato tem gerado os melhores resultados para seu perfil.',
      action: 'Crie mais conteúdo neste formato',
      priority: 'medium',
    });
  }

  // Engagement analysis
  const avgEngagement = posts.reduce((acc, post) => {
    const postEng = post.analytics.reduce((a, an) => a + (an.engagement_rate || 0), 0) / (post.analytics.length || 1);
    return acc + postEng;
  }, 0) / (posts.length || 1);

  if (avgEngagement > 5) {
    recommendations.push({
      id: 'engagement-high',
      type: 'success',
      category: 'Engajamento',
      title: 'Engajamento acima da média!',
      description: 'Sua taxa de engajamento está excelente. Seu conteúdo ressoa bem com a audiência.',
      metric: `${avgEngagement.toFixed(1)}%`,
      priority: 'low',
    });
  } else if (avgEngagement < 2) {
    recommendations.push({
      id: 'engagement-low',
      type: 'warning',
      category: 'Engajamento',
      title: 'Melhore o engajamento',
      description: 'Taxa de engajamento abaixo do esperado. Experimente CTAs mais claros e perguntas na legenda.',
      action: 'Adicione perguntas e CTAs nos posts',
      priority: 'high',
    });
  }

  return recommendations.slice(0, 6);
}

function calculateFrequencyStats(posts: PostWithAnalytics[]) {
  const postsWithDate = posts.filter(p => p.published_at);
  const totalPosts = postsWithDate.length;
  
  // Calculate posts per week
  const idealFrequency = Math.max(3, Math.min(7, Math.round(totalPosts / 4)));
  
  return {
    idealFrequency,
    currentFrequency: Math.round(totalPosts / 4),
    consistency: totalPosts > 10 ? 'Alta' : totalPosts > 5 ? 'Média' : 'Baixa',
  };
}

function calculateTrends(posts: PostWithAnalytics[]) {
  if (posts.length < 4) {
    return { direction: 'neutral' as const, percentage: 0, avgScore: '-' };
  }

  const midpoint = Math.floor(posts.length / 2);
  const recentPosts = posts.slice(0, midpoint);
  const olderPosts = posts.slice(midpoint);

  const recentAvg = recentPosts.reduce((acc, p) => acc + (p.insight?.performance_score || 0), 0) / recentPosts.length;
  const olderAvg = olderPosts.reduce((acc, p) => acc + (p.insight?.performance_score || 0), 0) / olderPosts.length;

  const percentChange = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
  const avgScore = Math.round((recentAvg + olderAvg) / 2);

  return {
    direction: percentChange > 0 ? 'up' as const : percentChange < 0 ? 'down' as const : 'neutral' as const,
    percentage: Math.abs(percentChange),
    avgScore: avgScore > 0 ? avgScore.toString() : '-',
  };
}
