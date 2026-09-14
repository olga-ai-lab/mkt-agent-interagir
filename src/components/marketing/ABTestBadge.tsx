import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ABTestBadgeProps {
  variantCount?: number;
  className?: string;
}

export function ABTestBadge({ variantCount = 2, className = "" }: ABTestBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`bg-violet-500/10 text-violet-400 border-violet-500/30 ${className}`}
          >
            <FlaskConical className="h-3 w-3 mr-1" />
            A/B
            {variantCount > 0 && (
              <span className="ml-1 text-xs opacity-80">({variantCount})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Teste A/B ativo com {variantCount} variante{variantCount !== 1 ? "s" : ""}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
