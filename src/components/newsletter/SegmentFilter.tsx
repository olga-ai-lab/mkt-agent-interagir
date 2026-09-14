import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NewsletterSegment } from "@/types/marketing";

interface SegmentFilterProps {
  segments: NewsletterSegment[];
  selectedSegments: string[];
  onChange: (segments: string[]) => void;
}

export function SegmentFilter({
  segments,
  selectedSegments,
  onChange,
}: SegmentFilterProps) {
  const toggleSegment = (segmentName: string) => {
    if (selectedSegments.includes(segmentName)) {
      onChange(selectedSegments.filter((s) => s !== segmentName));
    } else {
      onChange([...selectedSegments, segmentName]);
    }
  };

  const clearFilter = () => {
    onChange([]);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtrar por Segmento
            {selectedSegments.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedSegments.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Segmentos</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {segments.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Nenhum segmento disponível
            </div>
          ) : (
            segments.map((segment) => (
              <DropdownMenuCheckboxItem
                key={segment.id}
                checked={selectedSegments.includes(segment.name)}
                onCheckedChange={() => toggleSegment(segment.name)}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span>{segment.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {segment.subscriber_count}
                  </span>
                </div>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedSegments.length > 0 && (
        <div className="flex items-center gap-1">
          {selectedSegments.map((segmentName) => {
            const segment = segments.find((s) => s.name === segmentName);
            return (
              <Badge
                key={segmentName}
                variant="outline"
                className="pl-2"
                style={{
                  borderColor: segment?.color || "#6366f1",
                  color: segment?.color || "#6366f1",
                }}
              >
                {segmentName}
                <button
                  onClick={() => toggleSegment(segmentName)}
                  className="ml-1 hover:bg-muted/50 rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="h-6 px-2 text-xs"
          >
            Limpar
          </Button>
        </div>
      )}
    </div>
  );
}
