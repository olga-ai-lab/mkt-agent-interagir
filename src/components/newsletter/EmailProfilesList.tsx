import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Mail } from "lucide-react";
import {
  useEmailProfiles,
  useCreateEmailProfile,
  useUpdateEmailProfile,
  useDeleteEmailProfile,
  EmailProfile,
} from "@/hooks/useEmailProfiles";
import { EmailProfileEditor } from "./EmailProfileEditor";
import { EmailGenerationSettings } from "@/lib/emailTemplates";
import { toast } from "sonner";

interface EmailProfilesListProps {
  workspaceId: string;
  onNewCampaign?: () => void;
}

export function EmailProfilesList({ workspaceId, onNewCampaign }: EmailProfilesListProps) {
  const [editing, setEditing] = useState<EmailProfile | null | "new">(null);

  const { data: profiles = [], isLoading } = useEmailProfiles(workspaceId);
  const createProfile = useCreateEmailProfile();
  const updateProfile = useUpdateEmailProfile();
  const deleteProfile = useDeleteEmailProfile();

  const isSaving = createProfile.isPending || updateProfile.isPending;

  const handleSave = async (name: string, settings: EmailGenerationSettings) => {
    try {
      if (editing === "new") {
        await createProfile.mutateAsync({ workspaceId, name, settings });
        toast.success("Modelo criado!", {
          action: onNewCampaign
            ? { label: "Criar campanha", onClick: onNewCampaign }
            : undefined,
        });
      } else if (editing) {
        await updateProfile.mutateAsync({ id: editing.id, workspaceId, name, settings });
        toast.success("Modelo atualizado!");
      }
      setEditing(null);
    } catch {
      toast.error("Erro ao salvar modelo");
    }
  };

  const handleDelete = async (profile: EmailProfile) => {
    if (!confirm(`Excluir o modelo "${profile.name}"?`)) return;
    try {
      await deleteProfile.mutateAsync({ id: profile.id, workspaceId });
      toast.success("Modelo excluído");
    } catch {
      toast.error("Erro ao excluir modelo");
    }
  };

  // Show editor
  if (editing !== null) {
    return (
      <EmailProfileEditor
        profile={editing === "new" ? null : editing}
        workspaceId={workspaceId}
        isSaving={isSaving}
        onBack={() => setEditing(null)}
        onSave={handleSave}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Modelos de Circular</h3>
          <p className="text-sm text-muted-foreground">
            Crie perfis de branding reutilizáveis para seus emails. Ao criar uma campanha, escolha qual modelo usar.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Novo Modelo
        </Button>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum modelo criado</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Crie um modelo com logos, cores e dados da empresa para usar nas campanhas de circular.
            </p>
            <Button onClick={() => setEditing("new")} className="mt-6 gap-2">
              <Plus className="h-4 w-4" />
              Criar primeiro modelo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onEdit={() => setEditing(profile)}
              onDelete={() => handleDelete(profile)}
              isDeleting={deleteProfile.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
  isDeleting,
}: {
  profile: EmailProfile;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const s = profile.settings;
  const color = s.primary_color ?? "#1a6b5a";

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Color strip + logos preview */}
      <div
        className="h-16 flex items-center px-4 gap-3"
        style={{ backgroundColor: color }}
      >
        {s.logo_livonius_url ? (
          <img
            src={s.logo_livonius_url}
            alt="Logo"
            className="h-8 max-w-[90px] object-contain"
          />
        ) : (
          <div className="h-8 w-20 rounded bg-white/20 flex items-center justify-center">
            <span className="text-white/60 text-[10px]">sem logo</span>
          </div>
        )}
        {s.logo_livo_url && (
          <img
            src={s.logo_livo_url}
            alt="Logo Livo"
            className="h-6 max-w-[50px] object-contain"
          />
        )}
      </div>

      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base leading-tight">{profile.name}</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 pb-4 space-y-2">
        {s.company_name && (
          <p className="text-xs text-muted-foreground">{s.company_name}</p>
        )}
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full border border-border"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-mono text-muted-foreground">{color}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
