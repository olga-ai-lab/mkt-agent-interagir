import { Trophy, TrendingUp, Eye, MousePointerClick, Share2, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { PostVariant, ABTestResult } from "@/types/marketing";

interface ABTestResultsProps {
  variants: PostVariant[];
  results: ABTestResult[];
}

export function ABTestResults({ variants, results }: ABTestResultsProps) {
  if (variants.length === 0) {
    return null;
  }

  // Group results by variant
  const resultsByVariant = results.reduce((acc, result) => {
    if (!acc[result.variant_id]) {
      acc[result.variant_id] = {
        impressions: 0,
        clicks: 0,
        engagements: 0,
        shares: 0,
      };
    }
    acc[result.variant_id].impressions += result.impressions;
    acc[result.variant_id].clicks += result.clicks;
    acc[result.variant_id].engagements += result.engagements;
    acc[result.variant_id].shares += result.shares;
    return acc;
  }, {} as Record<string, { impressions: number; clicks: number; engagements: number; shares: number }>);

  // Calculate engagement rates and find winner
  const variantsWithStats = variants.map((variant) => {
    const stats = resultsByVariant[variant.id] || {
      impressions: 0,
      clicks: 0,
      engagements: 0,
      shares: 0,
    };
    const engagementRate = stats.impressions > 0
      ? ((stats.clicks + stats.engagements + stats.shares) / stats.impressions) * 100
      : 0;
    return {
      ...variant,
      stats,
      engagementRate,
    };
  });

  const maxEngagement = Math.max(...variantsWithStats.map((v) => v.engagementRate));
  const winner = variantsWithStats.find((v) => v.engagementRate === maxEngagement && maxEngagement > 0);

  const getVariantColor = (name: string) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      A: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
      B: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400" },
      C: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
      D: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
    };
    return colors[name] || { bg: "bg-muted", border: "border-border", text: "text-muted-foreground" };
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Resultados do Teste A/B
          </CardTitle>
          {winner && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <Trophy className="h-3 w-3 mr-1" />
              Variante {winner.variant_name} vencendo
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {variantsWithStats.map((variant) => {
          const colors = getVariantColor(variant.variant_name);
          const isWinner = winner?.id === variant.id;
          const progressValue = maxEngagement > 0 ? (variant.engagementRate / maxEngagement) * 100 : 0;

          return (
            <div
              key={variant.id}
              className={`rounded-lg border p-4 ${colors.bg} ${colors.border} ${
                isWinner ? "ring-2 ring-amber-500/30" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge className={`${colors.bg} ${colors.text} border ${colors.border}`}>
                    Variante {variant.variant_name}
                  </Badge>
                  {isWinner && (
                    <Trophy className="h-4 w-4 text-amber-400" />
                  )}
                </div>
                <span className={`text-lg font-bold ${colors.text}`}>
                  {variant.engagementRate.toFixed(1)}%
                </span>
              </div>

              <Progress value={progressValue} className="h-2 mb-4" />

              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Eye className="h-3 w-3" />
                    <span className="text-xs">Impressões</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatNumber(variant.stats.impressions)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <MousePointerClick className="h-3 w-3" />
                    <span className="text-xs">Cliques</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatNumber(variant.stats.clicks)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Heart className="h-3 w-3" />
                    <span className="text-xs">Engajamentos</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatNumber(variant.stats.engagements)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Share2 className="h-3 w-3" />
                    <span className="text-xs">Shares</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {formatNumber(variant.stats.shares)}
                  </span>
                </div>
              </div>

              {variant.content && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {variant.content}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Os resultados serão exibidos após a publicação do post.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
