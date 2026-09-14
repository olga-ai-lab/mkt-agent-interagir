import { AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useRejectionReasons } from '@/hooks/useAIInsights';
import { REJECTION_REASONS } from '@/types/ai-insights';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RejectionReasonsAlertProps {
  postId: string;
  compact?: boolean;
}

export function RejectionReasonsAlert({ postId, compact = false }: RejectionReasonsAlertProps) {
  const { data: rejections, isLoading } = useRejectionReasons(postId);

  if (isLoading || !rejections || rejections.length === 0) return null;

  // Get the most recent rejection
  const latest = rejections[0];
  const reasons = latest.reasons || [];

  // Map reason keys to labels
  const getReasonLabel = (key: string) => {
    const found = REJECTION_REASONS.find(r => r.key === key);
    return found?.label || key;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>{reasons.length} ajuste{reasons.length !== 1 ? 's' : ''} solicitado{reasons.length !== 1 ? 's' : ''}</span>
      </div>
    );
  }

  return (
    <Alert className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        Ajustes Solicitados
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="flex flex-wrap gap-1.5 mt-2">
          {reasons.map((reason: string) => (
            <Badge
              key={reason}
              variant="outline"
              className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-300 text-xs"
            >
              {getReasonLabel(reason)}
            </Badge>
          ))}
        </div>

        {latest.additional_comment && (
          <p className="text-sm text-amber-700 dark:text-amber-400 italic border-l-2 border-amber-300 pl-3">
            "{latest.additional_comment}"
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {format(new Date(latest.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
        </p>
      </AlertDescription>
    </Alert>
  );
}
