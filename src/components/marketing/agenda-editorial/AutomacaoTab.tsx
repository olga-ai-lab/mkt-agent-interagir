import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleCard } from "./ScheduleCard";
import type { AutomationSchedule } from "@/hooks/useAutomationSchedules";

interface AutomacaoTabProps {
  schedules: AutomationSchedule[];
  loading: boolean;
  onToggle: (workflowName: string, isActive: boolean) => void;
  onUpdateInterval: (workflowName: string, value: number, unit: string) => void;
}

export function AutomacaoTab({ schedules, loading, onToggle, onUpdateInterval }: AutomacaoTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Intervalos mais curtos aumentam o consumo de recursos e os custos operacionais de geração. Recomendamos no mínimo 3 horas para geração automática e 1 dia para criação pelas pautas.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onToggle={onToggle}
              onUpdateInterval={onUpdateInterval}
            />
          ))}
        </div>
      )}
    </div>
  );
}
