import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, TrendingUp, Heart, Share2, Bookmark, MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIPostInsight } from '@/types/ai-insights';

interface PostWithAnalytics {
  id: string;
  title: string;
  content: string | null;
  channels: string[];
  media_urls: string[] | null;
  published_at: string | null;
  analytics: Array<{
    impressions: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    engagement_rate: number | null;
  }>;
  insight: AIPostInsight | null;
}

interface PostRankingCardProps {
  post: PostWithAnalytics;
  rank: number;
  onViewDetails: (postId: string) => void;
  onCreateSimilar: (postId: string) => void;
}

export function PostRankingCard({ post, rank, onViewDetails, onCreateSimilar }: PostRankingCardProps) {
  const totalAnalytics = post.analytics.reduce(
    (acc, a) => ({
      impressions: acc.impressions + (a.impressions || 0),
      reach: acc.reach + (a.reach || 0),
      likes: acc.likes + (a.likes || 0),
      comments: acc.comments + (a.comments || 0),
      shares: acc.shares + (a.shares || 0),
      saves: acc.saves + (a.saves || 0),
    }),
    { impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  );

  // engagement_rate é numeric no Postgres — supabase-js devolve como string,
  // então "+" sem Number() concatenava texto em vez de somar.
  const avgEngagement = post.analytics.length > 0
    ? post.analytics.reduce((acc, a) => acc + Number(a.engagement_rate || 0), 0) / post.analytics.length
    : 0;

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-yellow-950';
    if (rank === 2) return 'bg-gray-300 text-gray-800';
    if (rank === 3) return 'bg-amber-600 text-amber-50';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="relative w-32 h-32 flex-shrink-0 bg-muted">
            {post.media_urls?.[0] ? (
              <img
                src={post.media_urls[0]}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl text-muted-foreground/30">📷</span>
              </div>
            )}
            <Badge className={cn('absolute top-2 left-2 text-xs font-bold', getRankBadgeColor(rank))}>
              #{rank}
            </Badge>
          </div>

          {/* Content */}
          <div className="flex-1 py-3 pr-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 className="font-semibold text-sm line-clamp-1">{post.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {post.content?.slice(0, 80)}...
                </p>
              </div>
              {avgEngagement > 0 && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {avgEngagement.toFixed(1)}%
                </Badge>
              )}
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {totalAnalytics.reach.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {totalAnalytics.likes.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {totalAnalytics.comments}
              </span>
              <span className="flex items-center gap-1">
                <Share2 className="h-3 w-3" /> {totalAnalytics.shares}
              </span>
              <span className="flex items-center gap-1">
                <Bookmark className="h-3 w-3" /> {totalAnalytics.saves}
              </span>
            </div>

            {/* Insight preview */}
            {post.insight && (
              <div className="flex items-start gap-2 mb-3 p-2 bg-muted/50 rounded-md">
                <Sparkles className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {post.insight.summary || post.insight.strengths?.[0] || 'Análise disponível'}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onViewDetails(post.id)}>
                Ver Detalhes
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onCreateSimilar(post.id)}>
                <Sparkles className="h-3 w-3 mr-1" />
                Criar Similar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
