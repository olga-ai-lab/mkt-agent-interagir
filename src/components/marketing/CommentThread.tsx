import { useState } from 'react';
import { PostComment } from '@/types/marketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Send, Lock, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommentThreadProps {
  comments: PostComment[];
  onAddComment: (content: string, isInternal: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function CommentThread({ comments, onAddComment, isLoading }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const sortedComments = [...comments].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    setIsSending(true);
    try {
      await onAddComment(newComment.trim(), isInternal);
      setNewComment('');
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Comentários ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de Comentários */}
        <ScrollArea className="h-[250px] pr-4">
          {sortedComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum comentário ainda
            </p>
          ) : (
            <div className="space-y-4">
              {sortedComments.map((comment) => (
                <div
                  key={comment.id}
                  className={`flex gap-3 p-3 rounded-lg ${
                    comment.is_internal
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'bg-purple-500/10 border border-purple-500/20'
                  }`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                      className={`text-xs ${
                        comment.is_internal
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                      }`}
                    >
                      {getInitials(comment.author_name, comment.author_email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {comment.author_name || comment.author_email || 'Anônimo'}
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          comment.is_internal
                            ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                            : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {comment.is_internal ? (
                          <>
                            <Lock className="h-3 w-3" /> Interno
                          </>
                        ) : (
                          <>
                            <Globe className="h-3 w-3" /> Externo
                          </>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "dd/MM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input de Novo Comentário */}
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex gap-2">
            <Button
              variant={isInternal ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsInternal(true)}
              className="flex items-center gap-1"
            >
              <Lock className="h-3 w-3" />
              Interno
            </Button>
            <Button
              variant={!isInternal ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsInternal(false)}
              className="flex items-center gap-1"
            >
              <Globe className="h-3 w-3" />
              Externo
            </Button>
          </div>

          <div className="flex gap-2">
            <Textarea
              placeholder="Escreva um comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
              disabled={isSending}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || isSending}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending ? 'Enviando...' : 'Enviar Comentário'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
