import { defaultLocale, type LocaleKey } from './locales';

const ASSETS = {
  badge14ZileRetur: {
    ro: '/badges/14-zile-retur-txt.png',
    en: '/badges/14-zile-retur-txt-en.png',
  },
  badgePlataSecurizata: {
    ro: '/badges/plata-securizata-txt.png',
    en: '/badges/plata-securizata-txt-en.png',
  },
  badgeLivrareRapida: {
    ro: '/badges/livrare-rapida-txt.png',
    en: '/badges/livrare-rapida-txt-en.png',
  },
} as const satisfies Record<string, Record<LocaleKey, string>>;

export type AssetKey = keyof typeof ASSETS;

export function getAsset(key: AssetKey, locale: LocaleKey): string {
  return ASSETS[key][locale] ?? ASSETS[key][defaultLocale];
}
