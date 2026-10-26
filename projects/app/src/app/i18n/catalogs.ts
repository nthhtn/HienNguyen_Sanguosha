import { InjectionToken } from '@angular/core';
import { en } from './en';
import { vi } from './vi';
import type { LocaleCode } from './locales';
import type { Messages } from './messages';

export type CatalogLoader = () => Promise<Messages>;
export type CatalogLoaders = Record<LocaleCode, CatalogLoader>;

// Both languages ship in the main bundle, so the first render is already in the visitor's language
// (Vietnamese is the default; a lazy chunk showed English until it arrived). A language added later
// that is too large to bundle goes back to a lazy loader here and out of INITIAL_CATALOGS.
export const DEFAULT_CATALOG_LOADERS: CatalogLoaders = {
  en: () => Promise.resolve(en),
  vi: () => Promise.resolve(vi),
};

// The catalogs the app starts with, before any loader runs. A spec can start with fewer.
export const INITIAL_CATALOGS = new InjectionToken<Partial<Record<LocaleCode, Messages>>>('INITIAL_CATALOGS', {
  providedIn: 'root',
  factory: () => ({ en, vi }),
});

// An injection token so specs can supply slow, failing or tiny catalogs.
export const CATALOG_LOADERS = new InjectionToken<CatalogLoaders>('CATALOG_LOADERS', {
  providedIn: 'root',
  factory: () => DEFAULT_CATALOG_LOADERS,
});
