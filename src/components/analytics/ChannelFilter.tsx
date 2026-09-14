import { Instagram, Facebook, Linkedin, Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChannelType } from "@/types/analytics";

interface ChannelFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

const CHANNEL_OPTIONS = [
  { value: "all", label: "Todos os canais", icon: Globe },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
] as const;

export function ChannelFilter({ value, onValueChange }: ChannelFilterProps) {
  const selectedOption = CHANNEL_OPTIONS.find(opt => opt.value === value) || CHANNEL_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <div className="flex items-center gap-2">
          <SelectedIcon className="h-4 w-4" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {CHANNEL_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {opt.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}