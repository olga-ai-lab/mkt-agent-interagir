import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { SocialConnection, SocialProvider } from '@/types/social';

export function useSocialConnections(workspaceId: string | undefined) {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<SocialProvider | null>(null);
  const { toast } = useToast();

  const fetchConnections = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const { data, error } = await supabase
        .from('mkt_social_connections')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections((data || []) as unknown as SocialConnection[]);
    } catch (error) {
      console.error('Error fetching social connections:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const initiateOAuth = useCallback(async (provider: SocialProvider) => {
    if (!workspaceId) return;

    setConnecting(provider);

    try {
      const { data, error } = await supabase.functions.invoke('interagir-oauth-init', {
        body: { provider, workspace_id: workspaceId },
      });

      if (error || !data?.auth_url) {
        throw new Error(error?.message || 'Não foi possível iniciar o fluxo OAuth.');
      }

      const width = 600, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.auth_url,
        'oauth-popup',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Realtime: detectar quando a conta for inserida/atualizada no banco
      const realtimeChannel = supabase
        .channel(`social_connections:${workspaceId}:${provider}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'social_connections',
            filter: `workspace_id=eq.${workspaceId}`,
          },
          (payload: any) => {
            if (payload.new?.provider === provider) {
              realtimeChannel.unsubscribe();
              clearInterval(pollTimer);
              popup?.close();
              setConnecting(null);
              fetchConnections();
              toast({ title: 'Conexão realizada!', description: 'Conta conectada com sucesso.' });
            }
          }
        )
        .subscribe();

      // Timeout de segurança: 10 minutos
      let pollTimer: ReturnType<typeof setInterval>;

      const timeout = setTimeout(() => {
        realtimeChannel.unsubscribe();
        clearInterval(pollTimer);
        setConnecting(null);
      }, 10 * 60 * 1000);

      // Polling de fallback: detecta fechamento manual do popup
      pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          clearTimeout(timeout);
          realtimeChannel.unsubscribe();
          setConnecting(null);
        }
      }, 500);

    } catch (error: any) {
      setConnecting(null);
      toast({
        title: 'Erro ao iniciar conexão',
        description: error.message || 'Não foi possível iniciar o fluxo OAuth.',
        variant: 'destructive',
      });
    }
  }, [workspaceId, fetchConnections, toast]);

  const disconnectProvider = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('mkt_social_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;
      setConnections(prev => prev.filter(c => c.id !== connectionId));
      toast({ title: 'Desconectado', description: 'Conta removida com sucesso.' });
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Erro ao desconectar',
        description: error.message || 'Não foi possível remover a conexão.',
        variant: 'destructive',
      });
    }
  };

  const getConnectionByProvider = (provider: SocialProvider) => {
    return connections.find(c => c.provider === provider && c.is_active);
  };

  return {
    connections,
    loading,
    connecting,
    initiateOAuth,
    disconnectProvider,
    getConnectionByProvider,
    refetch: fetchConnections,
  };
}
