import { useState } from "react";
import { Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AutomationSchedule } from "@/hooks/useAutomationSchedules";

interface ScheduleCardProps {
  schedule: AutomationSchedule;
  onToggle: (workflowName: string, isActive: boolean) => void;
  onUpdateInterval: (workflowName: string, value: number, unit: string) => void;
}

export function ScheduleCard({ schedule, onToggle, onUpdateInterval }: ScheduleCardProps) {
  const [intervalValue, setIntervalValue] = useState(schedule.interval_value);
  const [intervalUnit, setIntervalUnit] = useState(schedule.interval_unit);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onUpdateInterval(schedule.workflow_name, intervalValue, intervalUnit);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${schedule.is_active ? "bg-primary/10" : "bg-muted"}`}>
            <Zap className={`w-5 h-5 ${schedule.is_active ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{schedule.display_name}</h3>
            <p className="text-sm text-muted-foreground">{schedule.description}</p>
          </div>
        </div>
        <Switch
          checked={schedule.is_active}
          onCheckedChange={(checked) => onToggle(schedule.workflow_name, checked)}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Executar a cada</span>
        <Input
          type="number"
          value={intervalValue}
          onChange={(e) => setIntervalValue(Number(e.target.value))}
          className="w-16 text-center"
          min={1}
        />
        <Select value={intervalUnit} onValueChange={setIntervalUnit}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">min</SelectItem>
            <SelectItem value="hours">horas</SelectItem>
            <SelectItem value="days">dias</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleSave}
          className={`ml-auto ${saved ? "bg-emerald-500 hover:bg-emerald-500 text-white" : ""}`}
        >
          {saved ? "✓" : "Salvar"}
        </Button>
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
        {schedule.posts_generated_this_week} posts esta semana
      </div>
    </div>
  );
}
