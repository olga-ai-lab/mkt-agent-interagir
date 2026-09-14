import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSocialConnections } from '@/hooks/useSocialConnections';
import { SocialConnectionCard } from './SocialConnectionCard';
import { Info } from 'lucide-react';
import type { SocialProvider } from '@/types/social';

const PROVIDERS: SocialProvider[] = ['instagram', 'linkedin', 'facebook', 'twitter'];

export function SocialConnectionsSection() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    connections,
    loading,
    connecting,
    initiateOAuth,
    disconnectProvider,
    getConnectionByProvider,
    refetch,
  } = useSocialConnections(currentWorkspace?.id);

  // Processar apenas providers não gerenciados pelo SocialBu via postback
  useEffect(() => {
    const successProvider = searchParams.get('oauth_success');
    const error = searchParams.get('oauth_error');
    const account = searchParams.get('account');

    if (successProvider &&
        !['linkedin', 'facebook', 'instagram', 'twitter'].includes(successProvider)) {
      toast({
        title: 'Conta conectada!',
        description: `${successProvider} conectado como ${account || 'conta vinculada'}.`,
      });
      refetch();
      searchParams.delete('oauth_success');
      searchParams.delete('account');
      setSearchParams(searchParams, { replace: true });
    }

    if (error) {
      toast({
        title: 'Erro na conexão',
        description: decodeURIComponent(error),
        variant: 'destructive',
      });
      searchParams.delete('oauth_error');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, refetch]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const connectedCount = connections.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Contas Conectadas</h2>
        <p className="text-sm text-muted-foreground">
          Conecte suas redes sociais para publicar diretamente do painel.
        </p>
      </div>

      {connectedCount === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Nenhuma conta conectada. Conecte suas redes sociais para publicar automaticamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map(provider => {
          const connection = getConnectionByProvider(provider);
          return (
            <SocialConnectionCard
              key={provider}
              provider={provider}
              connection={connection}
              connecting={connecting === provider}
              onConnect={() => initiateOAuth(provider)}
              onDisconnect={disconnectProvider}
            />
          );
        })}
      </div>
    </div>
  );
}
