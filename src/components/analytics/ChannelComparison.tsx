import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from "recharts";
import { Instagram, Facebook, Linkedin, Trophy, TrendingUp, Users, Heart, MessageCircle, Share2 } from "lucide-react";
import type { PostChannelComparison, ChannelMetrics, ChannelType } from "@/types/analytics";

interface ChannelComparisonProps {
  posts: PostChannelComparison[];
}

const CHANNEL_COLORS: Record<ChannelType, string> = {
  instagram: "#E4405F",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
};

const CHANNEL_LABELS: Record<ChannelType, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

const CHANNEL_ICONS: Record<ChannelType, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
};

const chartConfig = {
  instagram: { label: "Instagram", color: "#E4405F" },
  facebook: { label: "Facebook", color: "#1877F2" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
};

export function ChannelComparison({ posts }: ChannelComparisonProps) {
  const [selectedPostId, setSelectedPostId] = useState<string>(posts[0]?.post_id || "");

  const selectedPost = useMemo(() => 
    posts.find(p => p.post_id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const radarData = useMemo(() => {
    if (!selectedPost) return [];
    
    const maxValues = {
      reach: Math.max(...selectedPost.channels.map(c => c.reach), 1),
      likes: Math.max(...selectedPost.channels.map(c => c.likes), 1),
      comments: Math.max(...selectedPost.channels.map(c => c.comments), 1),
      shares: Math.max(...selectedPost.channels.map(c => c.shares), 1),
      saves: Math.max(...selectedPost.channels.map(c => c.saves), 1),
    };

    const metrics = [
      { metric: "Alcance", key: "reach" },
      { metric: "Curtidas", key: "likes" },
      { metric: "Comentários", key: "comments" },
      { metric: "Compartilhamentos", key: "shares" },
      { metric: "Salvos", key: "saves" },
    ];

    return metrics.map(({ metric, key }) => {
      const data: Record<string, string | number> = { metric };
      selectedPost.channels.forEach(channel => {
        const value = channel[key as keyof ChannelMetrics] as number;
        const maxValue = maxValues[key as keyof typeof maxValues];
        data[channel.channel] = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
      });
      return data;
    });
  }, [selectedPost]);

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center">
          <p className="text-muted-foreground">
            Nenhum post com dados em múltiplos canais disponível
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Post Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo entre Canais</CardTitle>
          <CardDescription>
            Compare a performance do mesmo post em diferentes plataformas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPostId} onValueChange={setSelectedPostId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um post" />
            </SelectTrigger>
            <SelectContent>
              {posts.map((post) => (
                <SelectItem key={post.post_id} value={post.post_id}>
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[300px]">{post.post_title}</span>
                    <Badge variant="outline" className="text-xs">
                      {post.channels.length} canais
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPost && (
        <>
          {/* Channel Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {selectedPost.channels.map((channel) => {
              const Icon = CHANNEL_ICONS[channel.channel];
              const isBest = selectedPost.best_channel === channel.channel;
              
              return (
                <motion.div
                  key={channel.channel}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className={isBest ? "ring-2 ring-primary" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                            style={{ backgroundColor: `${CHANNEL_COLORS[channel.channel]}20` }}
                          >
                            <Icon 
                              className="h-4 w-4" 
                              style={{ color: CHANNEL_COLORS[channel.channel] }}
                            />
                          </div>
                          <CardTitle className="text-base">
                            {CHANNEL_LABELS[channel.channel]}
                          </CardTitle>
                        </div>
                        {isBest && (
                          <Badge className="gap-1 bg-primary">
                            <Trophy className="h-3 w-3" />
                            Melhor
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <MetricItem 
                          icon={Users} 
                          label="Alcance" 
                          value={channel.reach} 
                        />
                        <MetricItem 
                          icon={Heart} 
                          label="Curtidas" 
                          value={channel.likes} 
                        />
                        <MetricItem 
                          icon={MessageCircle} 
                          label="Comentários" 
                          value={channel.comments} 
                        />
                        <MetricItem 
                          icon={Share2} 
                          label="Compartilh." 
                          value={channel.shares} 
                        />
                      </div>
                      <div className="flex items-center justify-between border-t pt-3">
                        <span className="text-sm text-muted-foreground">Taxa de Engajamento</span>
                        <span className="font-bold" style={{ color: CHANNEL_COLORS[channel.channel] }}>
                          {(channel.engagement_rate * 100).toFixed(2)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Radar Chart */}
          {radarData.length > 0 && selectedPost.channels.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comparativo Visual</CardTitle>
                <CardDescription>
                  Performance relativa entre canais (normalizado em %)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <RadarChart data={radarData} outerRadius="80%">
                    <PolarGrid className="stroke-muted" />
                    <PolarAngleAxis 
                      dataKey="metric" 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <PolarRadiusAxis 
                      angle={30} 
                      domain={[0, 100]}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    />
                    {selectedPost.channels.map((channel) => (
                      <Radar
                        key={channel.channel}
                        name={CHANNEL_LABELS[channel.channel]}
                        dataKey={channel.channel}
                        stroke={CHANNEL_COLORS[channel.channel]}
                        fill={CHANNEL_COLORS[channel.channel]}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend />
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </RadarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabela Comparativa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left font-medium text-muted-foreground">Métrica</th>
                      {selectedPost.channels.map((channel) => {
                        const Icon = CHANNEL_ICONS[channel.channel];
                        return (
                          <th 
                            key={channel.channel} 
                            className="pb-3 text-right font-medium"
                            style={{ color: CHANNEL_COLORS[channel.channel] }}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <Icon className="h-4 w-4" />
                              {CHANNEL_LABELS[channel.channel]}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "reach", label: "Alcance" },
                      { key: "impressions", label: "Impressões" },
                      { key: "likes", label: "Curtidas" },
                      { key: "comments", label: "Comentários" },
                      { key: "shares", label: "Compartilhamentos" },
                      { key: "saves", label: "Salvos" },
                      { key: "plays", label: "Reproduções" },
                      { key: "engagements", label: "Engajamentos" },
                    ].map(({ key, label }) => {
                      const values = selectedPost.channels.map(c => c[key as keyof ChannelMetrics] as number);
                      const maxValue = Math.max(...values);
                      
                      return (
                        <tr key={key} className="border-b border-border/50">
                          <td className="py-3 font-medium">{label}</td>
                          {selectedPost.channels.map((channel) => {
                            const value = channel[key as keyof ChannelMetrics] as number;
                            const isBest = value === maxValue && maxValue > 0;
                            return (
                              <td 
                                key={channel.channel} 
                                className={`py-3 text-right ${isBest ? 'font-bold' : ''}`}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  {value.toLocaleString()}
                                  {isBest && <TrendingUp className="h-3 w-3 text-green-500" />}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/50">
                      <td className="py-3 font-bold">Taxa de Engajamento</td>
                      {selectedPost.channels.map((channel) => {
                        const maxRate = Math.max(...selectedPost.channels.map(c => c.engagement_rate));
                        const isBest = channel.engagement_rate === maxRate && maxRate > 0;
                        return (
                          <td 
                            key={channel.channel} 
                            className={`py-3 text-right ${isBest ? 'font-bold' : ''}`}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {(channel.engagement_rate * 100).toFixed(2)}%
                              {isBest && <TrendingUp className="h-3 w-3 text-green-500" />}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

interface MetricItemProps {
  icon: React.ElementType;
  label: string;
  value: number;
}

function MetricItem({ icon: Icon, label, value }: MetricItemProps) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-semibold">{value.toLocaleString()}</div>
      </div>
    </div>
  );
}