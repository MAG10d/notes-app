import { en, es } from './locales';

export type Language = 'en' | 'es';
export const languages: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

export const translations = {
  en,
  es,
};

// Helper to access nested keys with dot notation
export function getTranslation(lang: Language, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let current: any = translations[lang];

  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return key; // Fallback to key if not found
    }
  }

  if (typeof current === 'string' && params) {
    let text = current;
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(`{${paramKey}}`, String(paramValue));
    }
    return text;
  }

  return typeof current === 'string' ? current : key;
}
