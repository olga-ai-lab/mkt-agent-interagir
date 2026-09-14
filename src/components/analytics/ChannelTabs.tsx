import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Instagram, Linkedin, Facebook, Globe } from "lucide-react";

interface ChannelTabsProps {
  value: string;
  onValueChange: (value: string) => void;
}

const CHANNEL_TABS = [
  { value: "all", label: "Geral", icon: Globe },
  { value: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "#1877F2" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "#0A66C2" },
] as const;

export function ChannelTabs({ value, onValueChange }: ChannelTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-4">
        {CHANNEL_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-2 data-[state=active]:text-foreground"
            >
              <Icon 
                className="h-4 w-4" 
                style={value === tab.value && 'color' in tab ? { color: tab.color } : undefined}
              />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
