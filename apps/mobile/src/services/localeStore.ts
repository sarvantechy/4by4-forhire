import type { Locale } from '@4by4/i18n';
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

const LOCALE_KEY = 'forhire_locale';
let currentLocale: Locale = 'en';
let loaded = false;
const listeners = new Set<(locale: Locale) => void>();

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'ta';
}

export async function loadStoredLocale(): Promise<Locale> {
  if (!loaded) {
    const stored = await SecureStore.getItemAsync(LOCALE_KEY);
    if (isLocale(stored)) currentLocale = stored;
    loaded = true;
  }
  return currentLocale;
}

export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  loaded = true;
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
  for (const listener of listeners) listener(locale);
}

export function getLocale(): Locale {
  return currentLocale;
}

/** Re-renders the calling component whenever the app-wide locale changes. */
export function useLocale(): Locale {
  const [activeLocale, setActiveLocale] = useState(currentLocale);
  useEffect(() => {
    let active = true;
    loadStoredLocale().then((next) => active && setActiveLocale(next));
    const listener = (next: Locale) => setActiveLocale(next);
    listeners.add(listener);
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);
  return activeLocale;
}
