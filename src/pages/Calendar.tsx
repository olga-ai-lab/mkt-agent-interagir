import { useState, useEffect, useMemo } from 'react';
import { PageTransition } from "@/components/ui/page-transition";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, SocialPost } from '@/services/api';
import { DroppableCalendarDay } from '@/components/marketing/DroppableCalendarDay';
import { ScheduledPostModal } from '@/components/marketing/ScheduledPostModal';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function CalendarContent() {
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadPosts = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const data = await api.getCalendarPosts(
        currentWorkspace.id,
        format(start, 'yyyy-MM-dd'),
        format(end, 'yyyy-MM-dd')
      );
      setPosts(data);
    } catch (error) {
      console.error('Error loading calendar posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace) {
      loadPosts();
    }
  }, [currentMonth, currentWorkspace]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOfMonth = startOfMonth(currentMonth);
  const startPadding = firstDayOfMonth.getDay();

  const getPostsForDay = (day: Date): SocialPost[] => {
    return posts.filter(post => {
      const postDate = post.scheduled_at || post.published_at;
      if (!postDate) return false;
      return isSameDay(new Date(postDate), day);
    });
  };

  const handlePostClick = (post: SocialPost) => {
    setSelectedPost(post);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPost(null);
  };

  const handlePostUpdated = () => {
    loadPosts();
    handleModalClose();
  };

  const handlePostDrop = async (post: SocialPost, newDate: Date) => {
    try {
      await api.reschedulePost(post.id, newDate.toISOString());
      toast.success(`Post reagendado para ${format(newDate, "dd 'de' MMMM", { locale: ptBR })}`);
      loadPosts();
    } catch (error) {
      console.error('Error rescheduling post:', error);
      toast.error('Erro ao reagendar post');
    }
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6" />
            Calendário de Posts
          </h1>
          <p className="text-muted-foreground mt-1">
            Arraste posts agendados para reagendar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={loadPosts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="h-24 rounded-lg bg-muted/20" />
              ))}

              {days.map(day => (
                <DroppableCalendarDay
                  key={day.toISOString()}
                  day={day}
                  posts={getPostsForDay(day)}
                  isToday={isSameDay(day, new Date())}
                  onPostClick={handlePostClick}
                  onPostDrop={handlePostDrop}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
          <span>Agendado (arraste para reagendar)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Publicado</span>
        </div>
      </div>

      {selectedPost && (
        <ScheduledPostModal
          post={selectedPost}
          open={modalOpen}
          onClose={handleModalClose}
          onPostUpdated={handlePostUpdated}
        />
      )}
    </div>
    </PageTransition>
  );
}

export default function Calendar() {
  return (
    <DndProvider backend={HTML5Backend}>
      <CalendarContent />
    </DndProvider>
  );
}
