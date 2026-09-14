const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

export const HR_APP_URL = trimTrailingSlash(
  import.meta.env.VITE_HR_APP_URL?.trim() || "https://livo.olga-ai.com"
);

export const PASSWORD_RESET_URL =
  import.meta.env.VITE_PASSWORD_RESET_REDIRECT_URL?.trim() ||
  `${HR_APP_URL}/auth/reset-password`;
