import { useState } from 'react';
import { PageTransition } from "@/components/ui/page-transition";
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  TrendingUp,
  Lightbulb,
  Instagram,
  Linkedin,
  AlertCircle,
  Zap,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { PostRankingCard } from '@/components/ai-insights/PostRankingCard';
import { InsightsDashboardCards } from '@/components/ai-insights/InsightsDashboardCards';
import { RecommendationsPanel } from '@/components/ai-insights/RecommendationsPanel';
import {
  usePostsWithAnalytics,
  useTrendPlaybook,
} from '@/hooks/useAIInsights';

// Post real vindo de mkt-socialbu-overview (topPosts) — mesmo formato usado
// em Analytics.tsx. Repassado como prop quando o AI Insights é renderizado
// dentro da aba Analytics, porque mkt_post_analytics (usePostsWithAnalytics)
// está sempre vazia neste projeto — a única fonte de engajamento real por
// post hoje é o SocialBu.
interface SocialBuTopPost {
  id: number;
  content: string;
  permalink: string | null;
  account_name: string | null;
  account_type: string;
  thumbnail: string | null;
  published_at: string | null;
  engagement_rate: number;
  reach: number;
  likes: number;
  comments: number;
  engagements: number;
}

interface AIInsightsProps {
  /** true quando renderizado dentro da aba Analytics — esconde o cabeçalho
   * próprio (título/subtítulo/badges de canal), já coberto pelo header da
   * página que o engloba. */
  embedded?: boolean;
  /** Ranking real vindo do SocialBu (ver acima). Quando presente, substitui
   * o ranking baseado em mkt_post_analytics (sempre vazia) no lugar de
   * mostrar curtidas/comentários zerados pra todo mundo. */
  socialBuTopPosts?: SocialBuTopPost[];
}

export default function AIInsights({ embedded = false, socialBuTopPosts }: AIInsightsProps = {}) {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '00000000-0000-0000-0000-000000000001';

  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('recommendations');

  const { data: postsWithAnalytics, isLoading: postsLoading } = usePostsWithAnalytics(workspaceId, parseInt(period));
  const { data: playbook, isLoading: playbookLoading } = useTrendPlaybook(workspaceId);
  const hasSocialBuRanking = !!socialBuTopPosts && socialBuTopPosts.length > 0;

  const handleViewDetails = (postId: string) => {
    navigate(`/app/posts/${postId}`);
  };

  const handleCreateSimilar = (postId: string) => {
    navigate(`/app/posts/new?similar=${postId}`);
  };

  // Sort posts by performance score or engagement.
  // engagement_rate vem da coluna numeric do Postgres — o cliente supabase-js
  // devolve numeric como STRING (pra não perder precisão), então some com "+"
  // sem coerção virava concatenação de texto em vez de soma. Number(...) força
  // a comparação numérica de verdade.
  const rankedPosts = postsWithAnalytics?.sort((a, b) => {
    const scoreA = a.insight?.performance_score || 0;
    const scoreB = b.insight?.performance_score || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // Fallback to engagement metrics
    const engA = a.analytics.reduce((acc, an) => acc + Number(an.engagement_rate || 0), 0);
    const engB = b.analytics.reduce((acc, an) => acc + Number(an.engagement_rate || 0), 0);
    return engB - engA;
  }) || [];

  return (
    <PageTransition>
    <div className="space-y-6">
      {!embedded && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                AI Insights
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Análise de performance e sugestões inteligentes para seu conteúdo
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Channel Badges */}
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0">
                  <Instagram className="h-3 w-3 mr-1" />
                  Instagram
                </Badge>
                <Badge className="bg-[#0A66C2] text-white border-0">
                  <Linkedin className="h-3 w-3 mr-1" />
                  LinkedIn
                </Badge>
              </div>

              {/* Period Filter */}
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Stats */}
          <InsightsDashboardCards playbook={playbook} isLoading={playbookLoading} />
        </>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="recommendations" className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Recomendações</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-1">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Sugestões</span>
          </TabsTrigger>
        </TabsList>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="mt-6">
          <RecommendationsPanel
            playbook={playbook}
            posts={rankedPosts}
            isLoading={postsLoading || playbookLoading}
          />
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="mt-6">
          {hasSocialBuRanking ? (
            // mkt_post_analytics está sempre vazia neste projeto — usar o
            // ranking real vindo do SocialBu (mesma fonte do card "Top
            // posts" em Analytics) em vez de curtidas/comentários zerados.
            <div className="space-y-3">
              {socialBuTopPosts!.map((p, idx) => (
                <Card key={p.id}>
                  <CardContent className="flex items-center gap-3 p-3">
                    <Badge className="shrink-0 bg-muted text-muted-foreground">#{idx + 1}</Badge>
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{p.account_name ?? p.account_type}</span>
                        <span>·</span>
                        <span>{p.account_type}</span>
                      </div>
                      <p className="truncate text-sm">{p.content}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">{p.engagements} eng.</p>
                      {p.reach > 0 && <p>{p.reach} alcance</p>}
                    </div>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : postsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <Skeleton className="w-32 h-32" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : rankedPosts.length > 0 ? (
            <div className="space-y-4">
              {rankedPosts.map((post, idx) => (
                <PostRankingCard
                  key={post.id}
                  post={post}
                  rank={idx + 1}
                  onViewDetails={handleViewDetails}
                  onCreateSimilar={handleCreateSimilar}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum post publicado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Publique posts para ver o ranking de performance.
                </p>
                <Button onClick={() => navigate('/app/posts/new')}>
                  Criar Novo Post
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Suggestions Tab — Em breve */}
        <TabsContent value="suggestions" className="mt-6">
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mx-auto mb-4">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Em breve</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Estamos desenvolvendo um fluxo dedicado de sugestões inteligentes de conteúdo.
                Em breve esta funcionalidade estará disponível.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}
