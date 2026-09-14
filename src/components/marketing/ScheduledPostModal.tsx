import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, X, Play, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SocialPost } from '@/types/marketing';
import { ChannelIcons } from './ChannelIcons';
import { StatusBadge } from './StatusBadge';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ScheduledPostModalProps {
  post: SocialPost;
  open: boolean;
  onClose: () => void;
  onPostUpdated: () => void;
}

export function ScheduledPostModal({ post, open, onClose, onPostUpdated }: ScheduledPostModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(
    post.scheduled_at ? new Date(post.scheduled_at) : undefined
  );
  const [newTime, setNewTime] = useState(
    post.scheduled_at ? format(new Date(post.scheduled_at), 'HH:mm') : '12:00'
  );

  const isScheduled = post.status === 'SCHEDULED';
  const postDate = post.scheduled_at || post.published_at;

  const handleCancelSchedule = async () => {
    if (!confirm('Tem certeza que deseja cancelar o agendamento? O post voltará para Rascunho.')) {
      return;
    }

    setLoading('cancel');
    try {
      await api.cancelSchedule(post.id);
      toast.success('Agendamento cancelado. Post voltou para Rascunho.');
      onPostUpdated();
    } catch (error) {
      toast.error('Erro ao cancelar agendamento');
    } finally {
      setLoading(null);
    }
  };

  const handleReschedule = async () => {
    if (!newDate) {
      toast.error('Selecione uma data');
      return;
    }

    const [h, m] = newTime.split(':').map(Number);
    const scheduled = new Date(newDate);
    scheduled.setHours(h, m, 0, 0);
    const minTime = new Date();
    minTime.setMinutes(minTime.getMinutes() + 60);
    if (scheduled <= minTime) {
      toast.error('O horário deve ser pelo menos 1 hora no futuro');
      return;
    }

    setLoading('reschedule');
    try {
      const [hours, minutes] = newTime.split(':');
      const scheduled = new Date(newDate);
      scheduled.setHours(parseInt(hours), parseInt(minutes));

      await api.reschedulePost(post.id, scheduled.toISOString());
      toast.success(`Post reagendado para ${format(scheduled, "dd/MM 'às' HH:mm")}`);
      onPostUpdated();
    } catch (error) {
      toast.error('Erro ao reagendar post');
    } finally {
      setLoading(null);
    }
  };

  const handlePublishNow = async () => {
    if (!confirm('Tem certeza que deseja publicar este post agora?')) {
      return;
    }

    setLoading('publish');
    try {
      // Call trigger-publish without scheduled_at to publish immediately
      const { error } = await supabase.functions.invoke('mkt-trigger-publish', {
        body: {
          post_id: post.id,
          channels: post.channels,
        },
      });

      if (error) throw error;

      toast.success('Post publicado com sucesso!');
      onPostUpdated();
    } catch (error) {
      toast.error('Erro ao publicar post');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes do Post
            <StatusBadge status={post.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Post Info */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-lg">{post.title}</h3>
              {post.excerpt && (
                <p className="text-sm text-muted-foreground mt-1">{post.excerpt}</p>
              )}
            </div>

            {/* Media Preview */}
            {post.media_urls && post.media_urls.length > 0 && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img 
                  src={post.media_urls[0]} 
                  alt={post.title}
                  className="w-full h-40 object-cover"
                />
              </div>
            )}

            {/* Channels */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Canais:</span>
              <ChannelIcons channels={post.channels} size="sm" />
            </div>

            {/* Date/Time */}
            {postDate && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span>
                  {isScheduled ? 'Agendado para' : 'Publicado em'}:{' '}
                  <strong>{format(new Date(postDate), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Actions for Scheduled Posts */}
          {isScheduled && (
            <>
              {!showReschedule ? (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => setShowReschedule(true)}
                    className="w-full"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reagendar
                  </Button>
                  <Button
                    onClick={handlePublishNow}
                    disabled={loading === 'publish'}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {loading === 'publish' ? 'Publicando...' : 'Publicar Agora'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelSchedule}
                    disabled={loading === 'cancel'}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {loading === 'cancel' ? 'Cancelando...' : 'Cancelar Agendamento'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-border">
                  <Label>Nova data e hora</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !newDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newDate ? format(newDate, 'dd/MM/yyyy') : 'Selecione'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newDate}
                          onSelect={setNewDate}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date < today;
                          }}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="relative w-28">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowReschedule(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleReschedule}
                      disabled={loading === 'reschedule' || !newDate}
                      className="flex-1"
                    >
                      {loading === 'reschedule' ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info for Published Posts */}
          {post.status === 'PUBLISHED' && (
            <div className="text-center py-3 border-t border-border">
              <p className="text-sm text-green-500">✓ Este post já foi publicado</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
