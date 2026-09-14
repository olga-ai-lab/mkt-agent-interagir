// Facebook SDK TypeScript Definitions

export type FacebookLoginStatus = 'connected' | 'not_authorized' | 'unknown';

export interface FacebookAuthResponse {
  accessToken: string;
  userID: string;
  expiresIn: number;
  signedRequest?: string;
  graphDomain?: string;
  data_access_expiration_time?: number;
}

export interface FacebookLoginResponse {
  authResponse: FacebookAuthResponse | null;
  status: FacebookLoginStatus;
}

export interface FacebookLoginOptions {
  scope?: string;
  return_scopes?: boolean;
  enable_profile_selector?: boolean;
  auth_type?: 'rerequest' | 'reauthenticate' | 'reauthorize';
}

export interface FacebookInitParams {
  appId: string;
  cookie?: boolean;
  xfbml?: boolean;
  version: string;
  status?: boolean;
  autoLogAppEvents?: boolean;
}

export interface FacebookSDK {
  init(params: FacebookInitParams): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options?: FacebookLoginOptions
  ): void;
  logout(callback?: (response: unknown) => void): void;
  getLoginStatus(
    callback: (response: FacebookLoginResponse) => void,
    force?: boolean
  ): void;
  api(
    path: string,
    method: 'get' | 'post' | 'delete',
    params: Record<string, unknown>,
    callback: (response: unknown) => void
  ): void;
  api(
    path: string,
    callback: (response: unknown) => void
  ): void;
  AppEvents: {
    logPageView(): void;
    logEvent(eventName: string, valueToSum?: number, parameters?: Record<string, unknown>): void;
  };
}

declare global {
  interface Window {
    FB: FacebookSDK;
    fbAsyncInit: () => void;
  }
}
