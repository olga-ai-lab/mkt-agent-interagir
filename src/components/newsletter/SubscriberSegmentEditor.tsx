import { useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import type { NewsletterSegment } from "@/types/marketing";

interface SubscriberSegmentEditorProps {
  subscriberSegments: string[];
  availableSegments: NewsletterSegment[];
  onSave: (segments: string[]) => Promise<void>;
  disabled?: boolean;
}

export function SubscriberSegmentEditor({
  subscriberSegments,
  availableSegments,
  onSave,
  disabled = false,
}: SubscriberSegmentEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(subscriberSegments);
  const [saving, setSaving] = useState(false);

  const handleOpen = (open: boolean) => {
    if (open) {
      setSelectedSegments(subscriberSegments);
    }
    setIsOpen(open);
  };

  const toggleSegment = (segmentName: string) => {
    setSelectedSegments((prev) =>
      prev.includes(segmentName)
        ? prev.filter((s) => s !== segmentName)
        : [...prev, segmentName]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedSegments);
      setIsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const getSegmentColor = (segmentName: string) => {
    const segment = availableSegments.find((s) => s.name === segmentName);
    return segment?.color || "#6366f1";
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-1 px-2 text-left justify-start"
          disabled={disabled}
        >
          {subscriberSegments.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {subscriberSegments.map((segment) => (
                <Badge
                  key={segment}
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: getSegmentColor(segment),
                    color: getSegmentColor(segment),
                  }}
                >
                  {segment}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">Adicionar segmentos...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Segmentos</p>
          {availableSegments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum segmento disponível. Crie segmentos primeiro.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableSegments.map((segment) => (
                <label
                  key={segment.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                >
                  <Checkbox
                    checked={selectedSegments.includes(segment.name)}
                    onCheckedChange={() => toggleSegment(segment.name)}
                  />
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-sm">{segment.name}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
