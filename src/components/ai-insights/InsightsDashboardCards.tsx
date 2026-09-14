import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  Clock, 
  Hash, 
  Bookmark,
  LayoutGrid,
} from 'lucide-react';
import type { AITrendPlaybook } from '@/types/ai-insights';

interface InsightsDashboardCardsProps {
  playbook: AITrendPlaybook | null;
  isLoading?: boolean;
}

export function InsightsDashboardCards({ playbook, isLoading }: InsightsDashboardCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Melhor Formato',
      value: playbook?.best_formats?.[0] || '-',
      icon: LayoutGrid,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Melhor Horário',
      value: playbook?.best_posting_times?.[0] || '-',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      label: 'Top Hashtag',
      value: playbook?.top_hashtags?.[0] ? `#${playbook.top_hashtags[0]}` : '-',
      icon: Hash,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      label: 'Taxa de Salvamento',
      value: playbook?.avg_save_rate ? `${playbook.avg_save_rate.toFixed(1)}%` : '-',
      icon: Bookmark,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <Card key={idx}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-lg font-bold truncate">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
