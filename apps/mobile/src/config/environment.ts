const fallbackApiBaseUrl = 'http://localhost:8000/api/v1';

export const environment = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? fallbackApiBaseUrl,
} as const;
