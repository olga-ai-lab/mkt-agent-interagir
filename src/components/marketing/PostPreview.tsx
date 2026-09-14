import { SocialPost } from '@/types/marketing';
import ReactMarkdown from "react-markdown";
import { StatusBadge } from './StatusBadge';
import { ChannelIcons } from './ChannelIcons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Clock, Tag } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { countPartnerLogos, hasRegulatoryNotes } from '@/lib/brandComposition';

interface PostPreviewProps {
  post: SocialPost;
}

export function PostPreview({ post }: PostPreviewProps) {
  const allImages = post.media_urls && post.media_urls.length > 0 ? post.media_urls : [];
  const mainImage = post.thumbnail_url || post.image_urls?.[0] || allImages[0] || null;
  const partnerLogoCount = countPartnerLogos(post.media_composition);
  const composed = Boolean(post.base_media_urls?.length || post.rendered_media_urls?.length || post.media_composition?.slides?.length);
  const hasRegulatory = hasRegulatoryNotes(post.media_composition, post.regulatory_notes);

  return (
    <div className="space-y-6">
      {/* Status e Canais */}
      <div className="flex items-center justify-between">
        <StatusBadge status={post.status} />
        <ChannelIcons channels={post.channels} showLabels />
      </div>

      {/* Imagem Principal */}
      {mainImage && (
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={mainImage}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}


      {/* Título */}
      <h2 className="text-2xl font-bold text-foreground">{post.title}</h2>

      <div className="flex flex-wrap gap-2">
        {composed && <Badge variant="outline">Arte composta</Badge>}
        {partnerLogoCount > 0 && <Badge variant="outline">{partnerLogoCount} logo(s) parceira(s)</Badge>}
        {hasRegulatory && <Badge variant="outline">Com nota regulatória</Badge>}
      </div>

      {/* Conteúdo */}
      {post.content && (
        <Card className="bg-muted/50">
          <CardContent className="p-4 prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-strong:text-foreground prose-p:text-foreground/80">
            <ReactMarkdown>{post.content || ""}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* Excerpt */}
      {post.excerpt && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Resumo</p>
          <p className="text-foreground/70">{post.excerpt}</p>
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {post.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Metadados */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {post.author_name && (
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span>{post.author_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>
            {post.created_at && isValid(new Date(post.created_at))
            ? `Criado em ${format(new Date(post.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`
            : 'Data não disponível'}
          </span>
        </div>
        {post.scheduled_at && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>
              Agendado para {format(new Date(post.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        )}
      </div>

      {/* Preview Mockup Instagram */}
      {post.channels.includes('instagram') && mainImage && (() => {
        const igProfile = post.connection_profiles?.find(c => c.channel === 'instagram');
        const igName = igProfile?.name || 'seu_perfil';
        const igAvatar = igProfile?.avatar_url;
        return (
          <div className="mt-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">Preview Instagram</p>
            <div className="w-[460px] max-w-full mx-auto border border-border rounded-xl overflow-hidden bg-card">
              <div className="flex items-center gap-3 p-3 border-b border-border">
                {igAvatar ? (
                  <img src={igAvatar} alt={igName} className="h-8 w-8 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{igName}</span>
              </div>
              <div className="aspect-square">
                <img src={mainImage} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <p className="text-sm line-clamp-2">
                  <span className="font-medium">{igName}</span>{' '}
                  {post.content?.slice(0, 100)}...
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Preview Mockup LinkedIn */}
      {post.channels.includes('linkedin') && (() => {
        const liProfile = post.connection_profiles?.find(c => c.channel === 'linkedin');
        const liName = liProfile?.name || 'Sua Empresa';
        const liAvatar = liProfile?.avatar_url;
        return (
          <div className="mt-6">
            <p className="text-sm font-medium text-muted-foreground mb-3">Preview LinkedIn</p>
            <div className="w-[460px] max-w-full mx-auto border border-border rounded-xl overflow-hidden bg-card">
              <div className="flex items-center gap-3 p-4 border-b border-border">
                {liAvatar ? (
                  <img src={liAvatar} alt={liName} className="h-12 w-12 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-sky-500 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium text-sm">{liName}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm whitespace-pre-wrap line-clamp-4">{post.content}</p>
              </div>
              {mainImage && (
                <div className="aspect-video">
                  <img src={mainImage} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
