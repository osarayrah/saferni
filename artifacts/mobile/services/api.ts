import { setBaseUrl } from '@workspace/api-client-react';

/**
 * Point the generated API client at the API server.
 * The generated client uses paths like `/api/...`; on native (and in the
 * Expo web preview) those must be absolute, so the full base URL — including
 * scheme — comes from EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:8080 for
 * LAN dev, https://api.example.com in production).
 */
export function configureApiClient(): void {
  const url = process.env.EXPO_PUBLIC_API_URL ?? (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : undefined);
  if (url) {
    setBaseUrl(url.replace(/\/$/, ''));
  }
}
