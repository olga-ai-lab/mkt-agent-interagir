import { useState, useEffect, useCallback } from 'react';
import type { FacebookAuthResponse, FacebookLoginResponse, FacebookLoginStatus } from '@/types/facebook';

const INSTAGRAM_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
];

const FACEBOOK_SCOPES = [
  'pages_manage_posts',
  'pages_read_engagement',
  'pages_show_list',
];

const isHttps = () => window.location.protocol === 'https:';

export function useFacebookSDK() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginStatus, setLoginStatus] = useState<FacebookLoginStatus | null>(null);
  const [authResponse, setAuthResponse] = useState<FacebookAuthResponse | null>(null);

  useEffect(() => {
    // Check if SDK already loaded
    if (window.FB) {
      setIsReady(true);
      setIsLoading(false);
      // Check login status immediately (HTTPS only — Facebook blocks on HTTP)
      if (isHttps()) {
        window.FB.getLoginStatus((response: FacebookLoginResponse) => {
          setLoginStatus(response.status);
          if (response.authResponse) {
            setAuthResponse(response.authResponse);
          }
        });
      }
      return;
    }

    // Wait for async SDK load
    const checkReady = () => {
      if (window.FB) {
        setIsReady(true);
        setIsLoading(false);
        // Check login status when SDK becomes ready (HTTPS only)
        if (isHttps()) {
          window.FB.getLoginStatus((response: FacebookLoginResponse) => {
            setLoginStatus(response.status);
            if (response.authResponse) {
              setAuthResponse(response.authResponse);
            }
          });
        }
      }
    };

    // Store original callback if exists
    const originalInit = window.fbAsyncInit;
    
    window.fbAsyncInit = function() {
      originalInit?.();
      checkReady();
    };

    // Fallback check in case SDK already loaded before our listener
    const timeoutId = setTimeout(() => {
      if (window.FB) {
        checkReady();
      } else {
        setIsLoading(false); // SDK failed to load
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, []);

  const login = useCallback((provider: 'instagram' | 'facebook'): Promise<FacebookAuthResponse> => {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        reject(new Error('Facebook SDK não carregado'));
        return;
      }

      const scopes = provider === 'instagram' ? INSTAGRAM_SCOPES : FACEBOOK_SCOPES;

      window.FB.login(
        (response: FacebookLoginResponse) => {
          if (response.authResponse) {
            setLoginStatus('connected');
            setAuthResponse(response.authResponse);
            resolve(response.authResponse);
          } else {
            setLoginStatus(response.status);
            reject(new Error(
              response.status === 'not_authorized' 
                ? 'Autorização negada pelo usuário'
                : 'Login cancelado'
            ));
          }
        },
        { scope: scopes.join(','), return_scopes: true }
      );
    });
  }, []);

  const checkLoginStatus = useCallback((): Promise<FacebookAuthResponse | null> => {
    return new Promise((resolve) => {
      if (!window.FB || !isHttps()) {
        resolve(null);
        return;
      }

      window.FB.getLoginStatus((response: FacebookLoginResponse) => {
        setLoginStatus(response.status);
        if (response.authResponse) {
          setAuthResponse(response.authResponse);
        }
        resolve(response.authResponse);
      });
    });
  }, []);

  const refreshStatus = useCallback(() => {
    if (window.FB && isHttps()) {
      window.FB.getLoginStatus((response: FacebookLoginResponse) => {
        setLoginStatus(response.status);
        if (response.authResponse) {
          setAuthResponse(response.authResponse);
        } else {
          setAuthResponse(null);
        }
      });
    }
  }, []);

  return { 
    isReady, 
    isLoading, 
    login, 
    checkLoginStatus,
    loginStatus,
    authResponse,
    refreshStatus,
  };
}
