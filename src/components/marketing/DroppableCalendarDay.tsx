import { useDrop } from 'react-dnd';
import { format, isSameDay, setHours, setMinutes } from 'date-fns';
import { SocialPost } from '@/types/marketing';
import { DraggableCalendarCard, DRAG_TYPE } from './DraggableCalendarCard';
import { cn } from '@/lib/utils';

interface DroppableCalendarDayProps {
  day: Date;
  posts: SocialPost[];
  isToday: boolean;
  onPostClick: (post: SocialPost) => void;
  onPostDrop: (post: SocialPost, newDate: Date) => void;
}

export function DroppableCalendarDay({
  day,
  posts,
  isToday,
  onPostClick,
  onPostDrop,
}: DroppableCalendarDayProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPE,
    canDrop: (item: { post: SocialPost }) => {
      // Can't drop on the same day
      const postDate = item.post.scheduled_at || item.post.published_at;
      if (postDate && isSameDay(new Date(postDate), day)) {
        return false;
      }
      // Can only drop scheduled posts
      return item.post.status === 'SCHEDULED';
    },
    drop: (item: { post: SocialPost }) => {
      // Preserve the original time when moving to a new day
      const originalDate = item.post.scheduled_at ? new Date(item.post.scheduled_at) : new Date();
      const newDate = setMinutes(setHours(day, originalDate.getHours()), originalDate.getMinutes());
      onPostDrop(item.post, newDate);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={drop}
      className={cn(
        "min-h-24 rounded-lg border border-border/50 p-1.5 transition-all",
        isToday ? 'bg-accent/20 border-accent' : 'bg-card/30 hover:bg-card/50',
        isOver && canDrop && 'ring-2 ring-primary bg-primary/10',
        isOver && !canDrop && 'ring-2 ring-destructive/50 bg-destructive/10'
      )}
    >
      <div className={cn(
        "text-xs font-medium mb-1",
        isToday ? 'text-accent-foreground' : 'text-muted-foreground'
      )}>
        {format(day, 'd')}
      </div>
      <div className="space-y-1 max-h-20 overflow-y-auto">
        {posts.slice(0, 3).map(post => (
          <DraggableCalendarCard
            key={post.id}
            post={post}
            onClick={() => onPostClick(post)}
          />
        ))}
        {posts.length > 3 && (
          <div className="text-xs text-muted-foreground text-center">
            +{posts.length - 3} mais
          </div>
        )}
      </div>
    </div>
  );
}
