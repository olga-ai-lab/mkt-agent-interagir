import { PostVersion } from '@/types/marketing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VersionTimelineProps {
  versions: PostVersion[];
  currentVersion?: number;
  onViewVersion?: (version: PostVersion) => void;
}

export function VersionTimeline({ versions, currentVersion, onViewVersion }: VersionTimelineProps) {
  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Histórico de Versões
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma versão registrada
          </p>
        ) : (
          <ScrollArea className="h-[200px] pr-4">
            <div className="relative">
              {/* Linha vertical */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

              {/* Versões */}
              <div className="space-y-4">
                {sortedVersions.map((version, index) => {
                  const isCurrent = version.version_number === currentVersion;
                  
                  return (
                    <div key={version.id} className="relative flex gap-4 pl-8">
                      {/* Dot */}
                      <div
                        className={`absolute left-1.5 top-1.5 h-3 w-3 rounded-full border-2 ${
                          isCurrent
                            ? 'bg-primary border-primary'
                            : 'bg-background border-muted-foreground'
                        }`}
                      />

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                isCurrent ? 'text-primary' : 'text-foreground'
                              }`}
                            >
                              Versão {version.version_number}
                            </span>
                            {isCurrent && (
                              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                Atual
                              </span>
                            )}
                          </div>
                          {onViewVersion && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => onViewVersion(version)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {version.author_name && (
                            <>
                              <User className="h-3 w-3" />
                              <span>{version.author_name}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>
                            {format(new Date(version.created_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>

                        {version.content && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {version.content.slice(0, 60)}...
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
