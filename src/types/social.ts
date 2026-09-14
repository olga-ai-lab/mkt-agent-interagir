// Social OAuth Connection Types

export type SocialProvider = 'instagram' | 'facebook' | 'linkedin' | 'twitter';

export interface SocialConnection {
  id: string;
  workspace_id: string;
  provider: SocialProvider;
  account_id: string;
  account_name: string | null;
  account_username: string | null;
  profile_picture_url: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  page_id: string | null;
  page_name: string | null;
  is_active: boolean;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OAuthInitResponse {
  auth_url: string;
  state: string;
  error?: string;
  missing_config?: string;
}

export interface SocialProviderConfig {
  name: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  scopes: string[];
  setupUrl: string;
}

export const SOCIAL_PROVIDER_CONFIG: Record<SocialProvider, SocialProviderConfig> = {
  instagram: {
    name: 'Instagram',
    description: 'Publique fotos e carrosséis automaticamente.',
    icon: 'Instagram',
    color: 'text-pink-500',
    bgColor: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
    setupUrl: 'https://developers.facebook.com/docs/instagram-api/getting-started',
  },
  facebook: {
    name: 'Facebook',
    description: 'Publique em Páginas do Facebook.',
    icon: 'Facebook',
    color: 'text-blue-600',
    bgColor: 'bg-[#1877F2]',
    scopes: ['pages_manage_posts', 'pages_read_engagement'],
    setupUrl: 'https://developers.facebook.com/docs/pages-api/getting-started',
  },
  linkedin: {
    name: 'LinkedIn',
    description: 'Compartilhe posts no seu perfil profissional.',
    icon: 'Linkedin',
    color: 'text-sky-600',
    bgColor: 'bg-[#0A66C2]',
    scopes: ['w_member_social', 'r_liteprofile'],
    setupUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing/',
  },
  twitter: {
    name: 'X (Twitter)',
    description: 'Publique tweets e threads automaticamente.',
    icon: 'X',
    color: 'text-white',
    bgColor: 'bg-[#000000]',
    scopes: [],
    setupUrl: 'https://developer.twitter.com/en/docs',
  },
};
