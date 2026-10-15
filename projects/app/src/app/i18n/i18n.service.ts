import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { CATALOG_LOADERS } from './catalogs';
import { en } from './en';
import { DEFAULT_LOCALE, LocaleCode, isLocaleCode } from './locales';
import type { MessageKey, MessageParams, Messages } from './messages';

const LOCALE_KEY = 'locale';

function readLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    return isLocaleCode(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function writeLocale(code: LocaleCode): void {
  try {
    localStorage.setItem(LOCALE_KEY, code);
  } catch {
    // Storage is blocked: the choice lasts for this session only.
  }
}

// Fills {name} placeholders. A missing param leaves its placeholder visible, and
// a function replacer keeps '$&' and friends in a value from being interpreted.
export function format(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
  );
}

// The app's language. Presentation only: nothing here reaches the engine, the
// game state or the server.
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly loaders = inject(CATALOG_LOADERS);
  private readonly document = inject(DOCUMENT);
  private readonly catalogs = signal<Partial<Record<LocaleCode, Messages>>>({ en });
  // The newest setLocale call; an older, slower one must not overwrite it.
  private latest = 0;

  readonly locale = signal<LocaleCode>(readLocale());

  constructor() {
    const saved = this.locale();
    this.syncDocument();
    if (this.catalogs()[saved]) return;
    // English shows until the saved language's catalog arrives; if it never
    // does, go back to English rather than claim a language we cannot show.
    void this.load(saved).then((loaded) => {
      if (!loaded && !this.catalogs()[this.locale()]) {
        this.locale.set(DEFAULT_LOCALE);
        this.syncDocument();
      }
    });
  }

  t(key: MessageKey, params?: MessageParams): string {
    return format(this.catalogs()[this.locale()]?.[key] ?? en[key] ?? key, params);
  }

  // Switches once the language's catalog is ready. Never rejects: a failed load
  // leaves the current language, and the saved choice, as they were.
  async setLocale(code: LocaleCode): Promise<void> {
    const ticket = ++this.latest;
    const loaded = await this.load(code);
    if (!loaded || ticket !== this.latest) return;
    this.locale.set(code);
    writeLocale(code);
    this.syncDocument();
  }

  private async load(code: LocaleCode): Promise<boolean> {
    if (this.catalogs()[code]) return true;
    try {
      const messages = await this.loaders[code]();
      this.catalogs.update((loaded) => ({ ...loaded, [code]: messages }));
      return true;
    } catch {
      return false;
    }
  }

  private syncDocument(): void {
    this.document.documentElement.lang = this.locale();
  }
}
