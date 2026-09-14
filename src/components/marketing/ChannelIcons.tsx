import { Instagram, Facebook, Linkedin, BookOpen } from "lucide-react";

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
import { cn } from "@/lib/utils";
import { SocialChannel, CHANNEL_CONFIG } from "@/types/marketing";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ChannelIconsProps {
  channels: SocialChannel[];
  size?: "xs" | "sm" | "md" | "lg";
  showTooltip?: boolean;
  showLabels?: boolean;
  className?: string;
}

const iconMap = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: XIcon,
  blog: BookOpen,
};

const sizeMap = {
  xs: "h-2.5 w-2.5",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function ChannelIcons({ channels, size = "md", showTooltip = true, showLabels = false, className }: ChannelIconsProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {channels.map((channel) => {
        const Icon = iconMap[channel];
        const config = CHANNEL_CONFIG[channel];
        
        const content = (
          <div className={cn("rounded p-1 flex items-center gap-1.5", config.bgColor)}>
            <Icon className={cn(sizeMap[size], config.color)} />
            {showLabels && (
              <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
            )}
          </div>
        );
        
        if (showTooltip && !showLabels) {
          return (
            <Tooltip key={channel}>
              <TooltipTrigger asChild>
                {content}
              </TooltipTrigger>
              <TooltipContent>{config.label}</TooltipContent>
            </Tooltip>
          );
        }
        
        return <div key={channel}>{content}</div>;
      })}
    </div>
  );
}
