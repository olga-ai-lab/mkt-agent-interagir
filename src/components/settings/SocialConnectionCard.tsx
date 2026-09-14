import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Instagram, 
  Facebook, 
  Linkedin, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Trash2,
  Zap,
  RefreshCw,
  ShieldCheck,
  
} from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SocialConnection, SocialProvider } from '@/types/social';
import { SOCIAL_PROVIDER_CONFIG } from '@/types/social';
import { DeleteConfirmDialog } from '@/components/ui/delete-confirm-dialog';

interface SocialConnectionCardProps {
  provider: SocialProvider;
  connection?: SocialConnection;
  connecting: boolean;
  hasActiveSession?: boolean;
  onConnect: () => void;
  onDisconnect: (id: string) => void;
}

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: XIcon,
};

export function SocialConnectionCard({
  provider,
  connection,
  connecting,
  hasActiveSession,
  onConnect,
  onDisconnect,
}: SocialConnectionCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const config = SOCIAL_PROVIDER_CONFIG[provider];
  const Icon = ICONS[provider];

  const expiresAt = connection?.token_expires_at ? new Date(connection.token_expires_at) : null;
  const daysUntilExpiry = expiresAt ? differenceInDays(expiresAt, new Date()) : null;
  
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
  const willAutoRenew = daysUntilExpiry !== null && daysUntilExpiry <= 7 && !isExpired;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-4">
            {/* Provider Icon */}
            <div className={`p-3 rounded-lg ${config.bgColor} text-white shrink-0`}>
              <Icon className="h-6 w-6" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{config.name}</h3>
                {connection?.is_active && !isExpired ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Conectado
                  </Badge>
                ) : connection && isExpired ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Expirado
                  </Badge>
                ) : (
                  <Badge variant="secondary">Não conectado</Badge>
                )}
              </div>

              {connection?.is_active ? (
                <div className="space-y-2">
                  {/* Account info */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={connection.profile_picture_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {(connection.account_name || connection.account_username || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {connection.account_username || connection.account_name}
                    </span>
                    {connection.page_name && (
                      <span className="text-xs text-muted-foreground">
                        via {connection.page_name}
                      </span>
                    )}
                  </div>

                  {/* Status info */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {connection.last_used_at && (
                      <span>
                        Último uso: {formatDistanceToNow(new Date(connection.last_used_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    )}
                    {expiresAt && !isExpired && (
                      <span className={isExpiringSoon ? 'text-amber-500' : ''}>
                        Expira: {formatDistanceToNow(expiresAt, { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    )}
                  </div>

                  {/* Auto-renewal status */}
                  {willAutoRenew && !connection.last_error && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <RefreshCw className="h-3 w-3" />
                      <span>Renovação automática em breve</span>
                    </div>
                  )}
                  {!isExpired && !isExpiringSoon && connection.is_active && !connection.last_error && (
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Token renova automaticamente</span>
                    </div>
                  )}

                  {/* Error message */}
                  {connection.last_error && (
                    <div className="space-y-1">
                      <p className="text-xs text-destructive flex items-start gap-1">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>Token inválido ou expirado. Reconecte a conta para resolver.</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                  
                  {hasActiveSession && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Sessão ativa no Facebook - conexão rápida disponível
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>


          {/* Actions */}
          <div className="mt-4 pt-4 border-t mx-4 mb-4">
            {connection?.is_active ? (
              <div className="space-y-3">
                {(isExpired || isExpiringSoon || !!connection.last_error) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onConnect}
                    disabled={connecting}
                  >
                    {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Reconectar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={onConnect}
                  disabled={connecting}
                >
                  {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Conectar {config.name}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={config.setupUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Configurar App
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <DeleteConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={`Desconectar ${config.name}`}
        description={`Tem certeza que deseja desconectar a conta ${connection?.account_username || connection?.account_name}? Você precisará reconectar para publicar novamente.`}
        onConfirm={() => connection && onDisconnect(connection.id)}
      />
    </>
  );
}
