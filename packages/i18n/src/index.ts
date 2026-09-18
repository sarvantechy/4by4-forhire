const english = {
  'home.heroTitle': 'What do you need today?',
  'home.nearbyEmpty': 'No active listings yet',
  'home.popularCategories': 'Popular categories',
} as const;

const tamil: Record<MessageKey, string> = {
  'home.heroTitle': 'இன்று உங்களுக்கு என்ன தேவை?',
  'home.nearbyEmpty': 'செயலில் உள்ள பட்டியல்கள் இன்னும் இல்லை',
  'home.popularCategories': 'பிரபலமான வகைகள்',
};

export type Locale = 'en' | 'ta';
export type MessageKey = keyof typeof english;

const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: english,
  ta: tamil,
};

export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key];
}
