import { format } from 'date-fns';
import { SocialPost } from '@/types/marketing';
import { ChannelIcons } from './ChannelIcons';

interface PostCalendarCardProps {
  post: SocialPost;
  onClick: () => void;
}

export function PostCalendarCard({ post, onClick }: PostCalendarCardProps) {
  const isScheduled = post.status === 'SCHEDULED';
  const postDate = post.scheduled_at || post.published_at;
  const time = postDate ? format(new Date(postDate), 'HH:mm') : '';

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-1.5 py-1 rounded text-xs transition-all
        hover:scale-[1.02] cursor-pointer
        ${isScheduled 
          ? 'bg-cyan-500/20 border-l-2 border-cyan-500 hover:bg-cyan-500/30' 
          : 'bg-green-500/20 border-l-2 border-green-500 hover:bg-green-500/30'
        }
      `}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px] text-muted-foreground">{time}</span>
        <ChannelIcons channels={post.channels} size="xs" />
      </div>
      <div className="font-medium truncate text-foreground/90">
        {post.title}
      </div>
    </button>
  );
}
