import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  Clock, 
  Target, 
  CheckCircle2,
  AlertTriangle,
  Info
} from "lucide-react";

interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  priority: 'high' | 'medium' | 'low';
}

interface RecommendationsWidgetProps {
  workspaceId: string;
}

export function RecommendationsWidget({ workspaceId }: RecommendationsWidgetProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch playbook data
        const { data: playbook } = await supabase
          .from('ai_trend_playbook')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        // Fetch recent posts with analytics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: posts } = await supabase
          .from('social_posts')
          .select(`
            id,
            status,
            published_at,
            post_analytics (
              engagement_rate,
              saves,
              impressions
            )
          `)
          .eq('workspace_id', workspaceId)
          .eq('status', 'PUBLISHED')
          .gte('published_at', thirtyDaysAgo.toISOString())
          .order('published_at', { ascending: false });

        const generatedRecs = generateRecommendations(playbook, posts || []);
        setRecommendations(generatedRecs);
      } catch (error) {
        console.error('Error loading recommendations:', error);
      } finally {
        setLoading(false);
      }
    }

    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  function generateRecommendations(playbook: any, posts: any[]): Recommendation[] {
    const recs: Recommendation[] = [];
    
    // Calculate posts per week
    const postsPerWeek = posts.length / 4; // Last 30 days ≈ 4 weeks
    
    if (postsPerWeek < 3) {
      recs.push({
        id: 'freq-low',
        type: 'warning',
        title: 'Aumente a frequência para pelo menos 3 posts/semana',
        priority: 'high',
      });
    } else if (postsPerWeek >= 5) {
      recs.push({
        id: 'freq-good',
        type: 'success',
        title: 'Frequência de posts excelente!',
        priority: 'low',
      });
    }

    // Check best posting times
    if (playbook?.best_posting_times?.length > 0) {
      recs.push({
        id: 'timing',
        type: 'info',
        title: `Melhor horário: ${playbook.best_posting_times[0]}`,
        priority: 'medium',
      });
    }

    // Check save rate
    const avgSaveRate = playbook?.avg_save_rate || 0;
    if (avgSaveRate > 0 && avgSaveRate < 2) {
      recs.push({
        id: 'saves-low',
        type: 'warning',
        title: 'Taxa de salvamento baixa - adicione mais CTAs',
        priority: 'high',
      });
    } else if (avgSaveRate >= 5) {
      recs.push({
        id: 'saves-good',
        type: 'success',
        title: `Taxa de salvamento excelente (${avgSaveRate.toFixed(1)}%)`,
        priority: 'low',
      });
    }

    // Check engagement patterns
    const postsWithAnalytics = posts.filter(p => p.post_analytics?.length > 0);
    if (postsWithAnalytics.length > 0) {
      const avgEngagement = postsWithAnalytics.reduce((sum, p) => {
        const rate = p.post_analytics?.[0]?.engagement_rate || 0;
        return sum + rate;
      }, 0) / postsWithAnalytics.length;

      if (avgEngagement < 3) {
        recs.push({
          id: 'engagement-low',
          type: 'warning',
          title: 'Engajamento abaixo da média - teste novos formatos',
          priority: 'high',
        });
      } else if (avgEngagement >= 5) {
        recs.push({
          id: 'engagement-good',
          type: 'success',
          title: `Engajamento acima da média (${avgEngagement.toFixed(1)}%)`,
          priority: 'low',
        });
      }
    }

    // Add format recommendation if available
    if (playbook?.best_formats?.length > 0) {
      recs.push({
        id: 'format',
        type: 'info',
        title: `Formato recomendado: ${playbook.best_formats[0]}`,
        priority: 'medium',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]).slice(0, 4);
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="text-xs">Alta</Badge>;
      case 'medium': return <Badge variant="secondary" className="text-xs">Média</Badge>;
      default: return <Badge variant="outline" className="text-xs">Baixa</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Recomendações da IA
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link to="/app/ai-insights" className="flex items-center gap-1">
              Ver todas
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Publique mais posts para receber recomendações personalizadas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <div 
                key={rec.id} 
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                {getIcon(rec.type)}
                <span className="flex-1 text-sm">{rec.title}</span>
                {getPriorityBadge(rec.priority)}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
