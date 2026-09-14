import { Instagram, Facebook, Linkedin, BookOpen, Building2, User } from 'lucide-react';

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { SocialChannel } from '@/types/marketing';
import type { SocialConnection, SocialProvider } from '@/types/social';

// ─── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS: SocialProvider[] = ['instagram', 'linkedin', 'facebook', 'twitter'];

const PROVIDER_META: Record<SocialProvider, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = {
  instagram: { label: 'Instagram', Icon: Instagram, color: 'text-pink-400' },
  facebook: { label: 'Facebook', Icon: Facebook, color: 'text-blue-500' },
  linkedin: { label: 'LinkedIn', Icon: Linkedin, color: 'text-sky-400' },
  twitter: { label: 'X (Twitter)', Icon: XIcon, color: 'text-foreground' },
};

function resolveDisplayName(conn: SocialConnection): {
  name: string;
  SubIcon: React.ComponentType<{ className?: string }> | null;
  isOrg: boolean;
} {
  if (conn.provider === 'linkedin') {
    if (conn.page_id) {
      return { name: conn.page_name || conn.account_name || 'LinkedIn Organização', SubIcon: Building2, isOrg: true };
    }
    return { name: conn.account_name || conn.account_username || 'LinkedIn Perfil pessoal', SubIcon: User, isOrg: false };
  }
  if (conn.provider === 'facebook') {
    return { name: conn.page_name || conn.account_name || conn.account_username || 'Facebook', SubIcon: null, isOrg: false };
  }
  return { name: conn.account_username || conn.account_name || conn.provider, SubIcon: null, isOrg: false };
}

// ─── New mode: real connected accounts ───────────────────────────────────────

interface ConnectedModeProps {
  connections: SocialConnection[];
  selectedConnectionIds: string[];
  onConnectionsChange: (ids: string[]) => void;
  includeBlog?: boolean;
  blogSelected?: boolean;
  onBlogToggle?: (selected: boolean) => void;
  disabled?: boolean;
}

function ConnectedAccountSelector({
  connections,
  selectedConnectionIds,
  onConnectionsChange,
  includeBlog = true,
  blogSelected = false,
  onBlogToggle,
  disabled = false,
}: ConnectedModeProps) {
  const toggle = (id: string) => {
    if (disabled) return;
    const isSelected = selectedConnectionIds.includes(id);
    onConnectionsChange(
      isSelected
        ? selectedConnectionIds.filter(c => c !== id)
        : [...selectedConnectionIds, id]
    );
  };

  return (
    <div className="space-y-4">
      {PROVIDERS.map(provider => {
        const { label, Icon, color } = PROVIDER_META[provider];
        const providerConns = connections.filter(c => c.provider === provider && c.is_active);
        const hasConnections = providerConns.length > 0;

        return (
          <div key={provider} className="space-y-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>

            {!hasConnections ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 opacity-50 cursor-not-allowed select-none">
                <Checkbox checked={false} disabled />
                <span className="text-sm text-muted-foreground">Nenhuma conta conectada</span>
              </div>
            ) : (
              providerConns.map(conn => {
                const isSelected = selectedConnectionIds.includes(conn.id);
                const { name, SubIcon, isOrg } = resolveDisplayName(conn);

                return (
                  <div
                    key={conn.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={() => toggle(conn.id)}
                  >
                    <Checkbox
                      id={conn.id}
                      checked={isSelected}
                      disabled={disabled}
                      onCheckedChange={() => toggle(conn.id)}
                    />

                    <div className="relative shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={conn.profile_picture_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {name[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                        <Icon className={`h-3 w-3 ${color}`} />
                      </span>
                    </div>

                    <Label htmlFor={conn.id} className="flex-1 cursor-pointer">
                      <span className="font-medium">{name}</span>
                      {SubIcon && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <SubIcon className="h-3 w-3" />
                        </span>
                      )}
                    </Label>

                    {conn.provider === 'linkedin' && isOrg && (
                      <Badge variant="secondary" className="text-xs">Organização</Badge>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      {includeBlog && (
        <div
          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
            blogSelected
              ? 'border-primary bg-primary/10'
              : 'border-border bg-muted/30 hover:bg-muted/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && onBlogToggle?.(!blogSelected)}
        >
          <Checkbox
            id="blog"
            checked={blogSelected}
            disabled={disabled}
            onCheckedChange={v => onBlogToggle?.(!!v)}
          />
          <BookOpen className="h-5 w-5 text-emerald-400 shrink-0" />
          <Label htmlFor="blog" className="flex-1 cursor-pointer font-medium">
            Blog
          </Label>
        </div>
      )}
    </div>
  );
}

// ─── Legacy mode: static channel list (backward compat) ──────────────────────

interface LegacyModeProps {
  selectedChannels: SocialChannel[];
  onChange: (channels: SocialChannel[]) => void;
  includeBlog?: boolean;
  disabled?: boolean;
}

const STATIC_CHANNELS: Array<{ id: string; label: string; color: string }> = [
  { id: 'instagram', label: 'Instagram', color: 'text-pink-400' },
  { id: 'linkedin', label: 'LinkedIn', color: 'text-sky-400' },
  { id: 'facebook', label: 'Facebook', color: 'text-blue-500' },
  { id: 'twitter', label: 'X (Twitter)', color: 'text-foreground' },
];

const STATIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: XIcon,
  blog: BookOpen,
};

function StaticChannelSelector({ selectedChannels, onChange, includeBlog = true, disabled = false }: LegacyModeProps) {
  const allChannels = includeBlog
    ? [...STATIC_CHANNELS, { id: 'blog', label: 'Blog', color: 'text-emerald-400' }]
    : STATIC_CHANNELS;

  const handleToggle = (channelId: string) => {
    if (disabled) return;
    const isSelected = selectedChannels.includes(channelId as SocialChannel);
    onChange(
      isSelected
        ? selectedChannels.filter(c => c !== channelId) as SocialChannel[]
        : [...selectedChannels, channelId] as SocialChannel[]
    );
  };

  return (
    <div className="space-y-3">
      {allChannels.map(channel => {
        const Icon = STATIC_ICONS[channel.id];
        const isSelected = selectedChannels.includes(channel.id as SocialChannel);

        return (
          <div
            key={channel.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              isSelected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-muted/30 hover:bg-muted/50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleToggle(channel.id)}
          >
            <Checkbox
              id={channel.id}
              checked={isSelected}
              disabled={disabled}
              onCheckedChange={() => handleToggle(channel.id)}
            />
            <Icon className={`h-5 w-5 ${channel.color}`} />
            <Label htmlFor={channel.id} className="flex-1 cursor-pointer font-medium">
              {channel.label}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface ChannelSelectorProps {
  // New mode: real connected accounts
  connections?: SocialConnection[];
  selectedConnectionIds?: string[];
  onConnectionsChange?: (ids: string[]) => void;
  blogSelected?: boolean;
  onBlogToggle?: (selected: boolean) => void;
  // Legacy mode: static channels
  selectedChannels?: SocialChannel[];
  onChange?: (channels: SocialChannel[]) => void;
  // Common
  includeBlog?: boolean;
  disabled?: boolean;
}

export function ChannelSelector({
  connections,
  selectedConnectionIds,
  onConnectionsChange,
  blogSelected,
  onBlogToggle,
  selectedChannels,
  onChange,
  includeBlog = true,
  disabled = false,
}: ChannelSelectorProps) {
  if (connections !== undefined && onConnectionsChange) {
    return (
      <ConnectedAccountSelector
        connections={connections}
        selectedConnectionIds={selectedConnectionIds ?? []}
        onConnectionsChange={onConnectionsChange}
        includeBlog={includeBlog}
        blogSelected={blogSelected}
        onBlogToggle={onBlogToggle}
        disabled={disabled}
      />
    );
  }

  return (
    <StaticChannelSelector
      selectedChannels={selectedChannels ?? []}
      onChange={onChange ?? (() => {})}
      includeBlog={includeBlog}
      disabled={disabled}
    />
  );
}
