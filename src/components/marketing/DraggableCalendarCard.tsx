import { useDrag } from 'react-dnd';
import { format } from 'date-fns';
import { GripVertical } from 'lucide-react';
import { SocialPost } from '@/types/marketing';
import { ChannelIcons } from './ChannelIcons';
import { cn } from '@/lib/utils';

export const DRAG_TYPE = 'CALENDAR_POST';

interface DraggableCalendarCardProps {
  post: SocialPost;
  onClick: () => void;
}

export function DraggableCalendarCard({ post, onClick }: DraggableCalendarCardProps) {
  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: { post },
    canDrag: () => post.status === 'SCHEDULED',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const isScheduled = post.status === 'SCHEDULED';
  const postDate = post.scheduled_at || post.published_at;
  const time = postDate ? format(new Date(postDate), 'HH:mm') : '';

  return (
    <div
      ref={preview}
      onClick={onClick}
      className={cn(
        "w-full text-left px-1.5 py-1 rounded text-xs transition-all cursor-pointer",
        isScheduled 
          ? 'bg-cyan-500/20 border-l-2 border-cyan-500 hover:bg-cyan-500/30' 
          : 'bg-green-500/20 border-l-2 border-green-500 hover:bg-green-500/30',
        isDragging && 'opacity-50 scale-95',
        isScheduled && 'group'
      )}
    >
      <div className="flex items-center gap-1">
        {isScheduled && (
          <div
            ref={drag}
            className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-muted-foreground">{time}</span>
            <ChannelIcons channels={post.channels} size="xs" />
          </div>
          <div className="font-medium truncate text-foreground/90">
            {post.title}
          </div>
        </div>
      </div>
    </div>
  );
}
