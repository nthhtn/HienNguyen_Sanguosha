import { InjectionToken } from '@angular/core';
import { en } from './en';
import type { LocaleCode } from './locales';
import type { Messages } from './messages';

export type CatalogLoader = () => Promise<Messages>;
export type CatalogLoaders = Record<LocaleCode, CatalogLoader>;

// English ships in the main bundle; every other language is its own lazy chunk.
export const DEFAULT_CATALOG_LOADERS: CatalogLoaders = {
  en: () => Promise.resolve(en),
  vi: () => import('./vi').then((m) => m.vi),
};

// An injection token so specs can supply slow, failing or tiny catalogs.
export const CATALOG_LOADERS = new InjectionToken<CatalogLoaders>('CATALOG_LOADERS', {
  providedIn: 'root',
  factory: () => DEFAULT_CATALOG_LOADERS,
});
