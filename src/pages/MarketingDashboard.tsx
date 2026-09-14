import { useEffect, useState } from "react";
import { PageTransition } from "@/components/ui/page-transition";
import { Link } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle,
  Calendar,
  Send,
  TrendingUp,
  Plus,
  ArrowRight,
  Newspaper,
  Eye,
  Users,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/marketing/StatusBadge";
import { ChannelIcons } from "@/components/marketing/ChannelIcons";
import { ActivityTimeline } from "@/components/marketing/ActivityTimeline";
import { RecommendationsWidget } from "@/components/marketing/RecommendationsWidget";
import { GlobalSearch, useGlobalSearch } from "@/components/GlobalSearch";
import { api, DashboardStats, SocialPost } from "@/services/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

interface BlogStats {
  publishedArticles: number;
  totalViews: number;
  newsletterSubscribers: number;
}

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_title: string | null;
  details: Record<string, any>;
  created_at: string;
  user_id: string | null;
}

export default function MarketingDashboard() {
  const { currentWorkspace } = useWorkspace();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [blogStats, setBlogStats] = useState<BlogStats | null>(null);
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Fetch marketing stats and posts
        const [statsData, postsData] = await Promise.all([
          api.getDashboardStats(currentWorkspace.id),
          api.getPosts(currentWorkspace.id),
        ]);
        setStats(statsData);
        setRecentPosts(postsData.slice(0, 5));

        // Fetch blog stats
        const [
          { count: articlesCount },
          { data: viewsData },
          { count: subscribersCount },
        ] = await Promise.all([
          supabase.from("mkt_articles").select("*", { count: "exact", head: true }).eq("status", "published"),
          supabase.from("mkt_articles").select("view_count").eq("status", "published"),
          supabase.from("mkt_newsletter_subscribers").select("*", { count: "exact", head: true }).eq("is_active", true),
        ]);

        const totalViews = viewsData?.reduce((acc, a) => acc + (a.view_count || 0), 0) || 0;
        setBlogStats({
          publishedArticles: articlesCount || 0,
          totalViews,
          newsletterSubscribers: subscribersCount || 0,
        });

        // Fetch recent activities
        const { data: activitiesData } = await supabase
          .from("mkt_activity_log")
          .select("*")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(10);

        setActivities((activitiesData || []).map(a => ({
          ...a,
          details: (a.details || {}) as Record<string, any>,
        })));
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Realtime: refresh KPIs whenever social_posts changes for this workspace
    const channel = supabase
      .channel(`dashboard-social-posts-${currentWorkspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        async () => {
          const [statsData, postsData] = await Promise.all([
            api.getDashboardStats(currentWorkspace.id),
            api.getPosts(currentWorkspace.id),
          ]);
          setStats(statsData);
          setRecentPosts(postsData.slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWorkspace]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const marketingCards = [
    {
      label: "Rascunhos",
      value: stats?.drafts || 0,
      icon: FileText,
      color: "text-slate-400",
      bgColor: "bg-slate-500/10",
    },
    {
      label: "Pendentes",
      value: stats?.pendingApproval || 0,
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Aprovados",
      value: stats?.approved || 0,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Agendados",
      value: stats?.scheduled || 0,
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Publicados",
      value: stats?.published || 0,
      icon: Send,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  const blogCards = [
    {
      label: "Artigos Publicados",
      value: blogStats?.publishedArticles || 0,
      icon: Newspaper,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Visualizações",
      value: blogStats?.totalViews || 0,
      icon: Eye,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
    },
    {
      label: "Inscritos Newsletter",
      value: blogStats?.newsletterSubscribers || 0,
      icon: Users,
      color: "text-pink-400",
      bgColor: "bg-pink-500/10",
    },
  ];

  return (
    <PageTransition>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu conteúdo de marketing e blog
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSearchOpen(true)}>
            <Search className="mr-2 h-4 w-4" />
            Buscar
            <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          <Button asChild>
            <Link to="/app/posts/new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Post
            </Link>
          </Button>
        </div>
      </div>

      {/* Marketing Stats Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Marketing</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {marketingCards.map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`rounded-full p-3 ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Blog Stats Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Blog</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {blogCards.map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`rounded-full p-3 ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* AI Recommendations Widget */}
      {currentWorkspace && (
        <RecommendationsWidget workspaceId={currentWorkspace.id} />
      )}

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Posts */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Posts Recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/posts" className="text-primary">
                Ver todos
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentPosts.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8" />
                <p>Nenhum post ainda</p>
                <Button variant="link" asChild className="mt-2">
                  <Link to="/app/posts/new">Criar primeiro post</Link>
                </Button>
              </div>
            ) : (
              recentPosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/app/posts/${post.id}`}
                  className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-accent"
                >
                  {post.media_urls?.[0] ? (
                    <img
                      src={post.media_urls[0]}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {post.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={post.status} />
                      <ChannelIcons channels={post.channels} size="sm" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <ActivityTimeline activities={activities} loading={loading} />
      </div>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/app/posts/new">
                <Plus className="mr-2 h-4 w-4" />
                Criar novo post
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/app/calendar">
                <Calendar className="mr-2 h-4 w-4" />
                Ver calendário
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/app/posts?status=IN_REVIEW_INTERNAL">
                <Clock className="mr-2 h-4 w-4" />
                Revisar pendentes
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/app/articles">
                <Newspaper className="mr-2 h-4 w-4" />
                Gerenciar artigos
              </Link>
            </Button>
          </div>

          {/* Tip Card */}
          <div className="mt-6 rounded-lg bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Dica do dia</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Posts com imagens têm 2.3x mais engajamento. Adicione visuais
                  atraentes ao seu conteúdo!
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Schedule */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Próximos Agendamentos</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/calendar" className="text-primary">
              Ver calendário
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentPosts
              .filter((p) => p.scheduled_at && p.status === "SCHEDULED")
              .slice(0, 3)
              .map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-primary">
                        {format(new Date(post.scheduled_at!), "dd")}
                      </p>
                      <p className="text-xs uppercase text-muted-foreground">
                        {format(new Date(post.scheduled_at!), "MMM", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{post.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <ChannelIcons channels={post.channels} size="sm" />
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(post.scheduled_at!), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={post.status} />
                </div>
              ))}
            {!recentPosts.some((p) => p.scheduled_at && p.status === "SCHEDULED") && (
              <div className="py-8 text-center text-muted-foreground">
                <Calendar className="mx-auto mb-2 h-8 w-8" />
                <p>Nenhum post agendado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
    </PageTransition>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="mt-2 h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
