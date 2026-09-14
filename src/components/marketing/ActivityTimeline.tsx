import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Edit,
  Trash,
  MessageSquare,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_title: string | null;
  details: Record<string, any>;
  created_at: string;
  user_id: string | null;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  loading?: boolean;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  created: { icon: FileText, color: "text-blue-500", label: "criou" },
  updated: { icon: Edit, color: "text-amber-500", label: "atualizou" },
  deleted: { icon: Trash, color: "text-red-500", label: "excluiu" },
  sent_to_review: { icon: Send, color: "text-purple-500", label: "enviou para aprovação" },
  approved: { icon: CheckCircle, color: "text-green-500", label: "aprovou" },
  changes_requested: { icon: XCircle, color: "text-orange-500", label: "solicitou alterações em" },
  scheduled: { icon: Calendar, color: "text-cyan-500", label: "agendou" },
  published: { icon: Send, color: "text-green-600", label: "publicou" },
  commented: { icon: MessageSquare, color: "text-indigo-500", label: "comentou em" },
};

const ENTITY_LABELS: Record<string, string> = {
  post: "post",
  article: "artigo",
  approver: "aprovador",
  integration: "integração",
};

export function ActivityTimeline({ activities, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/4 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 h-8 w-8" />
            <p>Nenhuma atividade recente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Atividade Recente</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const config = ACTION_CONFIG[activity.action] || {
                icon: FileText,
                color: "text-muted-foreground",
                label: activity.action,
              };
              const Icon = config.icon;
              const entityLabel = ENTITY_LABELS[activity.entity_type] || activity.entity_type;

              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="relative">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-muted ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {index < activities.length - 1 && (
                      <div className="absolute left-4 top-8 h-full w-px bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="text-sm">
                      <span className="font-medium">Usuário</span>{" "}
                      <span className="text-muted-foreground">{config.label}</span>{" "}
                      <span className="font-medium">{entityLabel}</span>
                      {activity.entity_title && (
                        <>
                          {" "}
                          <span className="text-primary">"{activity.entity_title}"</span>
                        </>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
