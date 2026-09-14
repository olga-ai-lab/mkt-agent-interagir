import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, Integration } from "@/services/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { SocialConnectionsSection } from "./SocialConnectionsSection";
import { 
  Loader2, 
  MessageSquare, 
  Instagram, 
  Linkedin, 
  Facebook, 
  FileText,
  Workflow
} from "lucide-react";

const INTEGRATION_INFO: Record<string, { 
  name: string; 
  description: string; 
  icon: React.ElementType;
  color: string;
}> = {
  slack: {
    name: "Slack",
    description: "Receba notificações de aprovações e publicações no Slack.",
    icon: MessageSquare,
    color: "bg-[#4A154B]",
  },
  whatsapp: {
    name: "WhatsApp",
    description: "Envie notificações de aprovação via WhatsApp Business.",
    icon: MessageSquare,
    color: "bg-[#25D366]",
  },
  instagram: {
    name: "Instagram",
    description: "Publique automaticamente posts no Instagram via API.",
    icon: Instagram,
    color: "bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737]",
  },
  linkedin: {
    name: "LinkedIn",
    description: "Publique automaticamente posts no LinkedIn.",
    icon: Linkedin,
    color: "bg-[#0A66C2]",
  },
  facebook: {
    name: "Facebook",
    description: "Publique automaticamente posts no Facebook.",
    icon: Facebook,
    color: "bg-[#1877F2]",
  },
  blog: {
    name: "Blog Interno",
    description: "Publique posts diretamente no blog do site.",
    icon: FileText,
    color: "bg-primary",
  },
  n8n: {
    name: "n8n Workflows",
    description: "Automação de workflows com n8n.",
    icon: Workflow,
    color: "bg-[#FF6D5A]",
  },
};

export default function IntegrationsSettings() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, [currentWorkspace?.id]);

  async function loadIntegrations() {
    if (!currentWorkspace?.id) return;
    
    try {
      const data = await api.getIntegrations(currentWorkspace.id);
      setIntegrations(data);
    } catch (error) {
      console.error("Error loading integrations:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleToggle = async (integration: Integration) => {
    setToggling(integration.id);
    try {
      const updated = await api.updateIntegration(integration.id, {
        is_active: !integration.is_active,
      });
      if (updated) {
        setIntegrations(prev => prev.map(i => i.id === integration.id ? updated : i));
        toast({
          title: updated.is_active ? "Integração ativada" : "Integração desativada",
          description: `${INTEGRATION_INFO[integration.type]?.name || integration.type} foi ${updated.is_active ? "ativada" : "desativada"}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar a integração.",
        variant: "destructive",
      });
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Group integrations by category
  const socialIntegrations = integrations.filter(i => 
    ['instagram', 'linkedin', 'facebook'].includes(i.type)
  );
  const notificationIntegrations = integrations.filter(i => 
    ['slack', 'whatsapp'].includes(i.type)
  );
  const otherIntegrations = integrations.filter(i => 
    ['blog'].includes(i.type)
  );

  const IntegrationCard = ({ integration }: { integration: Integration }) => {
    const info = INTEGRATION_INFO[integration.type];
    if (!info) return null;

    const Icon = info.icon;

    return (
      <Card key={integration.id} className="overflow-hidden">
        <div className="flex items-start p-4 gap-4">
          <div className={`p-3 rounded-lg ${info.color} text-white shrink-0`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{info.name}</h3>
              <Badge variant={integration.is_active ? "default" : "secondary"}>
                {integration.is_active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{info.description}</p>
          </div>
          <Switch
            checked={integration.is_active}
            onCheckedChange={() => handleToggle(integration)}
            disabled={toggling === integration.id}
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* OAuth Social Connections */}
      <SocialConnectionsSection />

      {/* Social Media */}
      {socialIntegrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Redes Sociais</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {socialIntegrations.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {notificationIntegrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Notificações</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {notificationIntegrations.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      )}

      {/* Other */}
      {otherIntegrations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Outras Integrações</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {otherIntegrations.map(integration => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>
      )}


    </div>
  );
}
