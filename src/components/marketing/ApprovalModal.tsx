import { useState } from 'react';
import { SocialChannel } from '@/types/marketing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ChannelSelector } from './ChannelSelector';
import { CalendarIcon, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSocialConnections } from '@/hooks/useSocialConnections';

interface ApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: ApprovalData) => Promise<void>;
  isLoading?: boolean;
}

export interface ApprovalData {
  channels: SocialChannel[];
  connection_ids?: string[];
  blog_selected?: boolean;
  comment?: string;
  scheduleForLater: boolean;
  scheduledAt?: Date;
  scheduledTime?: string;
}

export function ApprovalModal({ open, onClose, onConfirm, isLoading }: ApprovalModalProps) {
  const { currentWorkspace } = useWorkspace();
  const { connections } = useSocialConnections(currentWorkspace?.id);

  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [blogSelected, setBlogSelected] = useState(false);
  const [comment, setComment] = useState('');
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState('12:00');

  const handleConfirm = async () => {
    if (scheduleForLater && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduled = new Date(scheduledDate);
      scheduled.setHours(hours, minutes, 0, 0);
      const minTime = new Date();
      minTime.setMinutes(minTime.getMinutes() + 60);
      if (scheduled <= minTime) {
        toast.error('O horário deve ser pelo menos 1 hora no futuro');
        return;
      }
    }

    const selectedConnections = connections.filter((connection) => selectedConnectionIds.includes(connection.id));
    const connectionChannels = [...new Set(selectedConnections.map((connection) => connection.provider))] as SocialChannel[];
    const derivedChannels: SocialChannel[] = blogSelected
      ? [...connectionChannels, 'blog' as SocialChannel]
      : connectionChannels;

    await onConfirm({
      channels: derivedChannels,
      connection_ids: selectedConnectionIds,
      blog_selected: blogSelected,
      comment: comment.trim() || undefined,
      scheduleForLater,
      scheduledAt: scheduledDate,
      scheduledTime: scheduleForLater ? scheduledTime : undefined,
    });

    setSelectedConnectionIds([]);
    setBlogSelected(false);
    setComment('');
    setScheduleForLater(false);
    setScheduledDate(undefined);
    setScheduledTime('12:00');
  };

  const canConfirm = (selectedConnectionIds.length > 0 || blogSelected) && (!scheduleForLater || scheduledDate);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex max-h-[min(92vh,860px)] w-[calc(100vw-2rem)] max-w-[500px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" />
            Aprovar e Escolher Destino
          </DialogTitle>
          <DialogDescription>
            Selecione os canais onde deseja publicar este conteúdo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Canais de Publicação</Label>
              <div className="max-h-[min(38vh,360px)] overflow-y-auto pr-1">
                <ChannelSelector
                  connections={connections}
                  selectedConnectionIds={selectedConnectionIds}
                  onConnectionsChange={setSelectedConnectionIds}
                  blogSelected={blogSelected}
                  onBlogToggle={setBlogSelected}
                  includeBlog
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="schedule" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Agendar para depois
                </Label>
                <Switch
                  id="schedule"
                  checked={scheduleForLater}
                  onCheckedChange={setScheduleForLater}
                  disabled={isLoading}
                />
              </div>

              {scheduleForLater && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'flex-1 justify-start text-left font-normal',
                          !scheduledDate && 'text-muted-foreground',
                        )}
                        disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? (
                          format(scheduledDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        ) : (
                          'Selecione uma data'
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full sm:w-32"
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Comentário (opcional)</Label>
              <Textarea
                id="comment"
                placeholder="Adicione uma observação sobre a aprovação..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[96px] resize-none"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="w-full whitespace-normal text-center sm:w-auto bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? 'Aprovando...' : 'Confirmar Aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
