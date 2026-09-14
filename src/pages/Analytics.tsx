import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XAxis, YAxis, CartesianGrid, Bar, Legend, ComposedChart, Line } from "recharts";
import { Users, Heart, TrendingUp, TrendingDown, RefreshCw, Send, Award, ExternalLink, BarChart3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ChannelTabs } from "@/components/analytics/ChannelTabs";
import AIInsights from "@/pages/AIInsights";

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

const chartConfig = {
  impressions: { label: "Impressões", color: "hsl(var(--chart-1))" },
  reach: { label: "Alcance", color: "hsl(var(--chart-2))" },
  likes: { label: "Curtidas", color: "hsl(var(--chart-3))" },
  comments: { label: "Comentários", color: "hsl(var(--chart-4))" },
  engagements: { label: "Engajamentos", color: "hsl(var(--chart-5))" },
  plays: { label: "Reproduções", color: "hsl(220 70% 50%)" },
};

// Payload de mkt-socialbu-overview — API de Insights do SocialBu
// (https://socialbu.com/openapi.yaml), separada da API pública de
// posting/scheduling. Ver comentário no topo da edge function para o porquê
// dessa distinção.
interface SocialBuOverview {
  period: { start: string; end: string; days: number };
  totals: { posts: number; engagements: number; engagementPerPost: number; audience: number | null };
  previous: { posts: number; engagements: number; engagementPerPost: number };
  daily: { date: string; posts: number; engagements: number }[];
  topPost: {
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
  } | null;
  topNetwork: { network: string; engagements: number } | null;
  topAccount: { account_id: number; name: string | null; engagements: number } | null;
  topPosts: {
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
  }[];
  publishingBehavior: { format: string; posts: number; engagements: number; engagementsPerPost: number }[];
}

export default function Analytics() {
  const { currentWorkspace } = useWorkspace();
  const [period, setPeriod] = useState("30");
  const [channelFilter, setChannelFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [sbOverview, setSbOverview] = useState<SocialBuOverview | null>(null);
  const [sbLoading, setSbLoading] = useState(true);
  const [sbError, setSbError] = useState<string | null>(null);

  const fetchSocialBuOverview = async () => {
    setSbLoading(true);
    setSbError(null);
    try {
      const { data, error } = await supabase.functions.invoke("mkt-socialbu-overview", {
        body: {
          days_back: parseInt(period, 10),
          network: channelFilter !== "all" ? channelFilter : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSbOverview(data as SocialBuOverview);
    } catch (error) {
      setSbOverview(null);
      setSbError(error instanceof Error ? error.message : "Não foi possível carregar os dados do SocialBu.");
    } finally {
      setSbLoading(false);
    }
  };

  const handleRefreshInsights = async () => {
    if (!currentWorkspace || refreshing) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mkt-fetch-social-insights", {
        body: { workspace_id: currentWorkspace.id, days_back: parseInt(period, 10) },
      });
      if (error) throw error;
      const success = data?.success ?? 0;
      const skipped = data?.skipped ?? 0;
      if (success > 0) {
        toast.success(`${success} métrica(s) atualizada(s).`);
      } else if (skipped > 0) {
        // Posts marcados PUBLISHED sem publicação confirmada no destino (SocialBu)
        // não têm métrica para buscar — não é falha da chamada, é ausência de dado.
        toast.info("Nenhuma métrica nova ainda — os posts publicados recentemente podem não ter dados de insights disponíveis.");
      } else {
        toast.info("Nenhum post publicado no período para atualizar.");
      }
      await fetchSocialBuOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar as métricas.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSocialBuOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, channelFilter]);


  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-6 p-6"
    >
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Métricas de performance dos seus posts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshInsights}
              disabled={refreshing || !currentWorkspace}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar do Meta/LinkedIn
            </Button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Channel Tabs */}
        <ChannelTabs value={channelFilter} onValueChange={setChannelFilter} />
      </motion.div>

      {/* SocialBu Overview — dados reais vindos da API de Insights do SocialBu,
          não da nossa tabela mkt_post_analytics (essa pipeline própria segue
          abaixo, na seção "Metric Cards"). AI Insights foi movido pra cá
          (antes era uma página separada na barra lateral) porque os dois se
          complementam: aqui é o dado bruto, lá é a leitura/recomendação em
          cima desse dado. */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Tabs defaultValue="overview">
          <TabsList className="grid w-full max-w-sm grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Meta &amp; LinkedIn</h2>
          {sbOverview && (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              {format(new Date(sbOverview.period.start), "dd/MM", { locale: ptBR })} –{" "}
              {format(new Date(sbOverview.period.end), "dd/MM", { locale: ptBR })}
            </Badge>
          )}
        </div>

        {sbError ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Não foi possível carregar os dados do SocialBu: {sbError}
            </CardContent>
          </Card>
        ) : sbLoading && !sbOverview ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] w-full" />
            ))}
          </div>
        ) : sbOverview ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Posts"
                value={sbOverview.totals.posts}
                previousValue={sbOverview.previous.posts}
                icon={Send}
                description="Publicados no período"
              />
              <MetricCard
                title="Engajamentos"
                value={sbOverview.totals.engagements}
                previousValue={sbOverview.previous.engagements}
                icon={Heart}
                description="Curtidas, comentários, shares..."
              />
              <MetricCard
                title="Engajamento por post"
                value={Number(sbOverview.totals.engagementPerPost.toFixed(2))}
                previousValue={Number(sbOverview.previous.engagementPerPost.toFixed(2))}
                icon={TrendingUp}
                description="Média de engajamentos por post"
              />
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Audiência</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <span className="text-2xl font-bold">
                    {sbOverview.totals.audience !== null ? sbOverview.totals.audience.toLocaleString("pt-BR") : "—"}
                  </span>
                  <p className="text-xs text-muted-foreground">Total de seguidores em todas as contas conectadas</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Posts e engajamentos</CardTitle>
                  <CardDescription>Volume de posts e engajamentos por dia</CardDescription>
                </CardHeader>
                <CardContent>
                  {sbOverview.daily.every((d) => d.posts === 0 && d.engagements === 0) ? (
                    <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                      Nenhum dado disponível para o período selecionado
                    </div>
                  ) : (
                    <ChartContainer
                      config={{ posts: { label: "Posts", color: "hsl(var(--chart-1))" }, engagements: { label: "Engajamentos", color: "hsl(var(--chart-5))" } }}
                      className="h-[280px] w-full"
                    >
                      <ComposedChart data={sbOverview.daily}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: ptBR })}
                          className="text-xs"
                        />
                        <YAxis yAxisId="posts" className="text-xs" allowDecimals={false} />
                        <YAxis yAxisId="engagements" orientation="right" className="text-xs" allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => format(new Date(value as string), "dd/MM/yyyy", { locale: ptBR })} />} />
                        <Legend />
                        <Bar yAxisId="posts" dataKey="posts" fill="var(--color-posts)" radius={4} />
                        <Line yAxisId="engagements" type="monotone" dataKey="engagements" stroke="var(--color-engagements)" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4">
                {sbOverview.topAccount && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Top conta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold">{sbOverview.topAccount.name ?? `#${sbOverview.topAccount.account_id}`}</p>
                      <p className="text-xs text-muted-foreground">{sbOverview.topAccount.engagements} engajamentos</p>
                    </CardContent>
                  </Card>
                )}
                {sbOverview.topNetwork && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Top rede</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold">{sbOverview.topNetwork.network}</p>
                      <p className="text-xs text-muted-foreground">{sbOverview.topNetwork.engagements} engajamentos</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {sbOverview.topPost && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Award className="h-4 w-4" />
                    Melhor post do período
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row">
                  {sbOverview.topPost.thumbnail && (
                    <img
                      src={sbOverview.topPost.thumbnail}
                      alt=""
                      className="h-24 w-24 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{sbOverview.topPost.account_name ?? sbOverview.topPost.account_type}</span>
                      <span>·</span>
                      <span>{sbOverview.topPost.account_type}</span>
                    </div>
                    <p className="line-clamp-2 text-sm">{sbOverview.topPost.content}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Engajamento: {sbOverview.topPost.engagement_rate}%</span>
                      <span>Alcance: {sbOverview.topPost.reach}</span>
                      <span>Curtidas: {sbOverview.topPost.likes}</span>
                      {sbOverview.topPost.comments > 0 && <span>Comentários: {sbOverview.topPost.comments}</span>}
                    </div>
                    {sbOverview.topPost.permalink && (
                      <a
                        href={sbOverview.topPost.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Ver post <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {sbOverview.topPosts.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Top posts ({sbOverview.topPosts.length})</CardTitle>
                    <CardDescription>Posts de maior engajamento no período, ordenados do melhor para o pior</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {sbOverview.topPosts.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-md border p-2">
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
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {sbOverview.publishingBehavior.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Formato de publicação</CardTitle>
                    <CardDescription>Posts e engajamento por tipo de conteúdo</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {sbOverview.publishingBehavior.map((fmt) => (
                      <div key={fmt.format} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-medium capitalize">{fmt.format}</p>
                          <p className="text-xs text-muted-foreground">{fmt.posts} post{fmt.posts !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{fmt.engagementsPerPost.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">eng./post</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : null}
          </TabsContent>

          <TabsContent value="ai-insights" className="mt-4">
            <AIInsights embedded socialBuTopPosts={sbOverview?.topPosts} />
          </TabsContent>
        </Tabs>
      </motion.div>

    </motion.div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  previousValue?: number;
  icon: React.ElementType;
  description: string;
}

function MetricCard({ title, value, previousValue, icon: Icon, description }: MetricCardProps) {
  const delta = previousValue !== undefined ? value - previousValue : null;
  const percentChange = previousValue && previousValue > 0 
    ? ((delta ?? 0) / previousValue) * 100 
    : (value > 0 ? 100 : 0);
  
  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;
  const isNeutral = delta === null || delta === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value.toLocaleString()}</span>
          {!isNeutral && (
            <span className={`flex items-center text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? (
                <TrendingUp className="mr-0.5 h-3 w-3" />
              ) : (
                <TrendingDown className="mr-0.5 h-3 w-3" />
              )}
              {Math.abs(percentChange).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {description}
          {delta !== null && previousValue !== undefined && (
            <span className="ml-1">
              ({isPositive ? '+' : ''}{delta.toLocaleString()} vs período anterior)
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
