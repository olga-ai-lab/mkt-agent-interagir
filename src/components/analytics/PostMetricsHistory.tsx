import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";
import type { DailyMetricSnapshot } from "@/types/analytics";

interface PostMetricsHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string | null;
  postTitle: string;
}

const chartConfig = {
  reach: { label: "Alcance", color: "hsl(var(--chart-2))" },
  likes: { label: "Curtidas", color: "hsl(var(--chart-3))" },
  comments: { label: "Comentários", color: "hsl(var(--chart-4))" },
  saves: { label: "Salvos", color: "hsl(var(--chart-5))" },
  plays: { label: "Reproduções", color: "hsl(220 70% 50%)" },
};

export function PostMetricsHistory({ open, onOpenChange, postId, postTitle }: PostMetricsHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DailyMetricSnapshot[]>([]);

  useEffect(() => {
    if (open && postId) {
      fetchHistory();
    }
  }, [open, postId]);

  const fetchHistory = async () => {
    if (!postId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("post_analytics")
        .select("recorded_date, impressions, reach, likes, comments, shares, saves, plays, engagements")
        .eq("post_id", postId)
        .order("recorded_date", { ascending: true });

      if (error) {
        console.error("Error fetching post history:", error);
        return;
      }

      setHistory(data as DailyMetricSnapshot[]);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDelta = (current: number, previous: number) => {
    const delta = current - previous;
    const percentChange = previous > 0 ? ((delta / previous) * 100) : (current > 0 ? 100 : 0);
    return { delta, percentChange };
  };

  const getLatestMetrics = () => {
    if (history.length < 1) return null;
    const latest = history[history.length - 1];
    const previous = history.length >= 2 ? history[history.length - 2] : null;
    
    return {
      reach: { current: latest.reach, ...getDelta(latest.reach, previous?.reach || 0) },
      likes: { current: latest.likes, ...getDelta(latest.likes, previous?.likes || 0) },
      comments: { current: latest.comments, ...getDelta(latest.comments, previous?.comments || 0) },
      saves: { current: latest.saves, ...getDelta(latest.saves, previous?.saves || 0) },
      plays: { current: latest.plays, ...getDelta(latest.plays, previous?.plays || 0) },
    };
  };

  const latestMetrics = getLatestMetrics();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="line-clamp-2">{postTitle}</SheetTitle>
          <SheetDescription>
            Histórico de métricas ao longo do tempo
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-[200px] w-full" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="mt-6 flex h-[200px] items-center justify-center text-muted-foreground">
            Nenhum histórico disponível para este post
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Delta Cards */}
            {latestMetrics && (
              <div className="grid grid-cols-2 gap-3">
                <DeltaCard 
                  label="Alcance" 
                  current={latestMetrics.reach.current} 
                  delta={latestMetrics.reach.delta}
                  percentChange={latestMetrics.reach.percentChange}
                />
                <DeltaCard 
                  label="Curtidas" 
                  current={latestMetrics.likes.current} 
                  delta={latestMetrics.likes.delta}
                  percentChange={latestMetrics.likes.percentChange}
                />
                <DeltaCard 
                  label="Comentários" 
                  current={latestMetrics.comments.current} 
                  delta={latestMetrics.comments.delta}
                  percentChange={latestMetrics.comments.percentChange}
                />
                <DeltaCard 
                  label="Salvos" 
                  current={latestMetrics.saves.current} 
                  delta={latestMetrics.saves.delta}
                  percentChange={latestMetrics.saves.percentChange}
                />
              </div>
            )}

            {/* Evolution Chart */}
            <div className="rounded-lg border p-4">
              <h4 className="mb-4 text-sm font-medium">Evolução Diária</h4>
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="recorded_date" 
                    tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: ptBR })}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <ChartTooltip 
                    content={<ChartTooltipContent />}
                    labelFormatter={(value) => format(new Date(value), "dd 'de' MMMM", { locale: ptBR })}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="reach" 
                    name="Alcance"
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="likes" 
                    name="Curtidas"
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ChartContainer>
            </div>

            {/* History Table */}
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Alcance</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Likes</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Salvos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice().reverse().map((snapshot, index, arr) => {
                      const previous = arr[index + 1];
                      return (
                        <tr key={snapshot.recorded_date} className="border-b border-border/50">
                          <td className="px-3 py-2 font-medium">
                            {format(new Date(snapshot.recorded_date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <MetricWithDelta 
                              current={snapshot.reach} 
                              previous={previous?.reach} 
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <MetricWithDelta 
                              current={snapshot.likes} 
                              previous={previous?.likes} 
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <MetricWithDelta 
                              current={snapshot.saves} 
                              previous={previous?.saves} 
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DeltaCardProps {
  label: string;
  current: number;
  delta: number;
  percentChange: number;
}

function DeltaCard({ label, current, delta, percentChange }: DeltaCardProps) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-lg font-bold">{current.toLocaleString()}</span>
        {!isNeutral && (
          <Badge 
            variant="outline" 
            className={`gap-1 text-xs ${isPositive ? 'border-green-500/50 text-green-600 dark:text-green-400' : 'border-red-500/50 text-red-600 dark:text-red-400'}`}
          >
            {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta)}
          </Badge>
        )}
        {isNeutral && (
          <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
            <Minus className="h-3 w-3" />
            0
          </Badge>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {isPositive ? '+' : ''}{percentChange.toFixed(1)}% vs ontem
      </div>
    </div>
  );
}

interface MetricWithDeltaProps {
  current: number;
  previous?: number;
}

function MetricWithDelta({ current, previous }: MetricWithDeltaProps) {
  if (previous === undefined) {
    return <span>{current.toLocaleString()}</span>;
  }

  const delta = current - previous;
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <div className="flex items-center justify-end gap-1">
      <span>{current.toLocaleString()}</span>
      {!isNeutral && (
        <span className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isPositive ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
        </span>
      )}
    </div>
  );
}
