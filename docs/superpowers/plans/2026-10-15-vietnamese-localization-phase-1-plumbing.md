# Vietnamese Localization, Phase 1 (Plumbing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the presentation-layer i18n plumbing (locale signal, typed catalogs, `t` pipe, lazy Vietnamese catalog) and flag buttons in the Navigation panel that switch the locale and remember the choice. No existing screen text changes.

**Architecture:** An `I18n` service in `projects/app/src/app/i18n/` holds the current locale as a signal and a map of loaded catalogs. English is bundled and is the key set; other catalogs load lazily through an injectable loader map. `t(key, params)` falls back from the current locale to English to the key itself. A `LanguageSwitcher` component renders one flag button per entry in a single `LOCALES` list, and sits in the toolbar. Nothing outside `projects/app` is touched.

**Tech Stack:** Angular 22 (standalone, signals, zoneless), Jest with `jest-preset-angular` (the `app` project), TypeScript strict with `noPropertyAccessFromIndexSignature`.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` (this plan is its phase 1; phases 2 to 5 get their own plans)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Always `git add` explicit paths. Never `git commit -a`. The user has unrelated uncommitted work in `docs/architecture/frontend.md`, `projects/app/src/app/app.css`, `game-board/action-list.ts`, `game-board/hand-view.ts`, `game.service.ts`, `labels.ts`, `online/online-result.ts`, `projects/server/`, plus untracked `game-board/target-label.*` and `projects/server/src/auth/devAccount.*`. None of these may be edited or staged. The switcher therefore uses its own component styles and must not touch `app.css`.
- Work on branch `feat/vietnamese-localization`.
- Localization is presentation only: no change under `projects/engine`, `bots`, `content`, `protocol`, `server`, `sim`.
- English output is unchanged. All existing app specs must pass without edits (adding tests to `app.spec.ts` is allowed).
- The locale is never stored in game state and never sent to the server. The only persistence is `localStorage` key `locale`.
- Language buttons: one per locale, a flag, `aria-pressed` on the active one, `aria-label` and `title` in the locale's own language ("English", "Tiếng Việt"). Flags are image files, not flag emoji. English uses the UK flag.
- Adding a language later means one `LOCALES` entry, one flag file, one catalog and one loader, with no template change.
- Lookup order: current locale, then English, then the key itself.
- UI text style (CLAUDE.md): Title Case for names and labels in English. Vietnamese uses sentence case.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`.

## Review Focus

- A saved `locale` value that is unknown, empty or not a string code (`fr`, ``, `{"a":1}`): the app starts in English.
- `localStorage` throwing on read or write (private window, blocked storage): the switcher still works for the session, with no crash.
- The Vietnamese catalog failing to load (offline): the locale stays as it was and the saved value is not changed. A saved `vi` whose load fails falls back to English.
- Clicking Vietnamese then English quickly, with the Vietnamese load still pending: the last click wins.
- A message whose param is missing, or whose value contains `$&` or the name `constructor`: the placeholder stays visible and nothing is mangled.

---

## File Structure

| File | Responsibility |
|---|---|
| `projects/app/src/app/i18n/locales.ts` | The `LOCALES` list, `LocaleCode`, `DEFAULT_LOCALE`, `isLocaleCode`. Data only. |
| `projects/app/src/app/i18n/en.ts` | English catalog. Its keys define `MessageKey`. |
| `projects/app/src/app/i18n/vi.ts` | Vietnamese catalog, typed to have exactly the English keys. Loaded lazily. |
| `projects/app/src/app/i18n/messages.ts` | Types: `MessageKey`, `Messages`, `MessageParams`. |
| `projects/app/src/app/i18n/catalogs.ts` | `DEFAULT_CATALOG_LOADERS` and the `CATALOG_LOADERS` injection token (replaceable in tests). |
| `projects/app/src/app/i18n/i18n.service.ts` | `I18n` service and the pure `format` function. |
| `projects/app/src/app/i18n/t.pipe.ts` | The `t` pipe. |
| `projects/app/src/app/i18n/language-switcher.ts` | The flag buttons component. |
| `projects/app/public/flags/gb.svg`, `vn.svg` | The two flags. |
| `projects/app/src/app/app.ts`, `app.html` | Import and place the switcher in the toolbar. |

`angular.json` already copies `projects/app/public/**/*` to the site root, so `flags/gb.svg` is served at `flags/gb.svg`, the same way `card-art/misc/logo.png` is referenced in `app.html`.

---

### Task 1: Locales, catalogs and the `I18n` service

**Files:**
- Create: `projects/app/src/app/i18n/locales.ts`, `messages.ts`, `en.ts`, `vi.ts`, `catalogs.ts`, `i18n.service.ts`
- Test: `projects/app/src/app/i18n/i18n.service.spec.ts`, `projects/app/src/app/i18n/catalogs.spec.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `LOCALES`, `LocaleCode`, `DEFAULT_LOCALE`, `isLocaleCode(v: unknown): v is LocaleCode` from `locales.ts`.
  - `MessageKey`, `Messages`, `MessageParams` from `messages.ts`.
  - `en` from `en.ts`; `vi` from `vi.ts`.
  - `CatalogLoader`, `CatalogLoaders`, `DEFAULT_CATALOG_LOADERS`, `CATALOG_LOADERS` from `catalogs.ts`.
  - `I18n` with `locale: WritableSignal<LocaleCode>` (read it as `locale()`), `t(key: MessageKey, params?: MessageParams): string`, `setLocale(code: LocaleCode): Promise<void>` (never rejects); and `format(template: string, params?: MessageParams): string` from `i18n.service.ts`.

- [ ] **Step 1: Write the data and type files**

`projects/app/src/app/i18n/locales.ts`:

```ts
// The languages the app offers, in the order their buttons appear. `flag` is a
// file under projects/app/public; `nativeName` is the button's label in its own
// language.
export const LOCALES = [
  { code: 'en', nativeName: 'English', flag: 'flags/gb.svg' },
  { code: 'vi', nativeName: 'Tiếng Việt', flag: 'flags/vn.svg' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const isLocaleCode = (value: unknown): value is LocaleCode => LOCALES.some((l) => l.code === value);
```

`projects/app/src/app/i18n/en.ts`:

```ts
// The English catalog is the source of truth for the key set: every other
// catalog must have exactly these keys (checked by the compiler and by
// catalogs.spec.ts). Messages use {name} placeholders.
export const en = {
  'nav.language': 'Language',
} satisfies Record<string, string>;
```

`projects/app/src/app/i18n/messages.ts`:

```ts
import type { en } from './en';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type MessageParams = Record<string, string | number>;
```

`projects/app/src/app/i18n/vi.ts`:

```ts
import type { Messages } from './messages';

export const vi: Messages = {
  'nav.language': 'Ngôn ngữ',
};
```

`projects/app/src/app/i18n/catalogs.ts`:

```ts
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
```

- [ ] **Step 2: Write the failing parity spec**

`projects/app/src/app/i18n/catalogs.spec.ts`:

```ts
import { DEFAULT_CATALOG_LOADERS } from './catalogs';
import { en } from './en';
import { LOCALES } from './locales';
import type { MessageKey } from './messages';

const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(en) as MessageKey[];

describe.each(LOCALES.map((l) => l.code))('catalog %s', (code) => {
  it('has exactly the English keys', async () => {
    const messages = await DEFAULT_CATALOG_LOADERS[code]();
    expect(Object.keys(messages).sort()).toEqual([...keys].sort());
  });

  it('keeps every placeholder of the English message', async () => {
    const messages = await DEFAULT_CATALOG_LOADERS[code]();
    for (const key of keys) {
      expect({ key, placeholders: placeholders(messages[key]) }).toEqual({ key, placeholders: placeholders(en[key]) });
    }
  });

  it('has no empty messages', async () => {
    const messages = await DEFAULT_CATALOG_LOADERS[code]();
    for (const key of keys) expect({ key, empty: messages[key].trim() === '' }).toEqual({ key, empty: false });
  });
});
```

- [ ] **Step 3: Write the failing service spec**

`projects/app/src/app/i18n/i18n.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { CATALOG_LOADERS, CatalogLoaders } from './catalogs';
import { en } from './en';
import { I18n, format } from './i18n.service';
import type { MessageKey, Messages } from './messages';

const VI: Messages = { 'nav.language': 'Ngôn ngữ' };
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function setup(loaders: Partial<CatalogLoaders> = {}): I18n {
  TestBed.configureTestingModule({
    providers: [{ provide: CATALOG_LOADERS, useValue: { en: () => Promise.resolve(en), vi: () => Promise.resolve(VI), ...loaders } }],
  });
  return TestBed.inject(I18n);
}

describe('I18n', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });
  afterEach(() => jest.restoreAllMocks());

  it('starts in English when nothing is saved', () => {
    const i18n = setup();
    expect(i18n.locale()).toBe('en');
    expect(i18n.t('nav.language')).toBe('Language');
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches language, remembers it and sets the page language', async () => {
    const i18n = setup();
    await i18n.setLocale('vi');
    expect(i18n.locale()).toBe('vi');
    expect(i18n.t('nav.language')).toBe('Ngôn ngữ');
    expect(localStorage.getItem('locale')).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('restores a saved language once its catalog has loaded', async () => {
    localStorage.setItem('locale', 'vi');
    const i18n = setup();
    expect(i18n.locale()).toBe('vi');
    expect(i18n.t('nav.language')).toBe('Language'); // English until the catalog arrives
    await flush();
    expect(i18n.t('nav.language')).toBe('Ngôn ngữ');
  });

  it.each(['fr', '', '{"a":1}', 'VI'])('starts in English when the saved value is %j', (saved) => {
    localStorage.setItem('locale', saved);
    expect(setup().locale()).toBe('en');
  });

  it('still works when localStorage throws', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const i18n = setup();
    expect(i18n.locale()).toBe('en');
    await i18n.setLocale('vi');
    expect(i18n.locale()).toBe('vi');
  });

  it('keeps the current language and saves nothing when a catalog fails to load', async () => {
    const i18n = setup({ vi: () => Promise.reject(new Error('offline')) });
    await expect(i18n.setLocale('vi')).resolves.toBeUndefined();
    expect(i18n.locale()).toBe('en');
    expect(localStorage.getItem('locale')).toBeNull();
  });

  it('falls back to English when a saved language fails to load', async () => {
    localStorage.setItem('locale', 'vi');
    const i18n = setup({ vi: () => Promise.reject(new Error('offline')) });
    await flush();
    expect(i18n.locale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('lets the last click win when an earlier load finishes late', async () => {
    let release!: (messages: Messages) => void;
    const i18n = setup({ vi: () => new Promise<Messages>((resolve) => (release = resolve)) });
    const toVi = i18n.setLocale('vi');
    await i18n.setLocale('en');
    release(VI);
    await toVi;
    expect(i18n.locale()).toBe('en');
    expect(localStorage.getItem('locale')).toBe('en');
  });

  it('falls back to English for a key the catalog lacks, then to the key itself', async () => {
    const i18n = setup({ vi: () => Promise.resolve({} as Messages) });
    await i18n.setLocale('vi');
    expect(i18n.t('nav.language')).toBe('Language');
    expect(i18n.t('no.such.key' as MessageKey)).toBe('no.such.key');
  });
});

describe('format', () => {
  it('fills {name} placeholders with strings and numbers', () => {
    expect(format('{who} drew {n} cards', { who: 'Hing', n: 2 })).toBe('Hing drew 2 cards');
  });

  it('leaves a placeholder visible when its param is missing', () => {
    expect(format('{who} drew {n} cards', { who: 'Hing' })).toBe('Hing drew {n} cards');
    expect(format('{who}')).toBe('{who}');
  });

  it('does not treat param values as replacement patterns', () => {
    expect(format('{a}', { a: '$& $1 $$' })).toBe('$& $1 $$');
  });

  it('does not read inherited properties', () => {
    expect(format('{constructor}', {})).toBe('{constructor}');
  });
});
```

- [ ] **Step 4: Run both specs to verify they fail**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: `i18n.service.spec.ts` FAILS ("Cannot find module './i18n.service'"). `catalogs.spec.ts` PASSES, since the files from Step 1 already exist. That is intended, because the parity spec guards the catalogs from here on.

- [ ] **Step 5: Write the service**

`projects/app/src/app/i18n/i18n.service.ts`:

```ts
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
      if (!loaded && this.latest === 0) {
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
```

- [ ] **Step 6: Run both specs to verify they pass**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS (all tests in both files).

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/locales.ts projects/app/src/app/i18n/messages.ts projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/i18n/catalogs.ts projects/app/src/app/i18n/i18n.service.ts projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/i18n/catalogs.spec.ts
git commit -m "feat(app): i18n service with lazy catalogs and catalog parity tests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The `t` pipe

**Files:**
- Create: `projects/app/src/app/i18n/t.pipe.ts`
- Test: `projects/app/src/app/i18n/t.pipe.spec.ts`

**Interfaces:**
- Consumes: `I18n`, `MessageKey`, `MessageParams`, `CATALOG_LOADERS`, `en`.
- Produces: `TPipe` (pipe name `t`): `'some.key' | t` and `'some.key' | t: { n: 2 }`.

- [ ] **Step 1: Write the failing test**

The test must NOT call `fixture.detectChanges()` after switching language. In a zoneless fixture, `whenStable()` only flushes a change detection that the signal change itself scheduled, so this proves the pipe's signal reads are tracked by the template.

`projects/app/src/app/i18n/t.pipe.spec.ts`:

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CATALOG_LOADERS } from './catalogs';
import { en } from './en';
import { I18n } from './i18n.service';
import type { Messages } from './messages';
import { TPipe } from './t.pipe';

const VI: Messages = { 'nav.language': 'Ngôn ngữ' };

@Component({ imports: [TPipe], template: `<p>{{ 'nav.language' | t }}</p>` })
class Host {}

describe('t pipe', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: CATALOG_LOADERS, useValue: { en: () => Promise.resolve(en), vi: () => Promise.resolve(VI) } }],
    });
  });

  it('renders the current language and re-renders when it changes', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).querySelector('p')!.textContent;
    expect(text()).toBe('Language');

    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(text()).toBe('Ngôn ngữ');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/t.pipe.spec.ts`
Expected: FAIL ("Cannot find module './t.pipe'").

- [ ] **Step 3: Write the pipe**

`projects/app/src/app/i18n/t.pipe.ts`:

```ts
import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18n } from './i18n.service';
import type { MessageKey, MessageParams } from './messages';

// {{ 'some.key' | t }} or {{ 'some.key' | t: { n: 2 } }}. Impure on purpose: a
// pure pipe would not run again when only the language changes, and the signal
// read inside I18n.t is what schedules the re-render.
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/t.pipe.spec.ts`
Expected: PASS. If the second assertion fails with the English text, the template is not tracking the signal read: stop and report it, because the switcher and every later phase depend on this.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/i18n/t.pipe.ts projects/app/src/app/i18n/t.pipe.spec.ts
git commit -m "feat(app): t pipe that re-renders on language change

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Flag buttons in the Navigation panel

**Files:**
- Create: `projects/app/public/flags/gb.svg`, `projects/app/public/flags/vn.svg`, `projects/app/src/app/i18n/language-switcher.ts`
- Modify: `projects/app/src/app/app.ts` (imports), `projects/app/src/app/app.html` (add the element before the music button)
- Test: `projects/app/src/app/i18n/language-switcher.spec.ts`, `projects/app/src/app/app.spec.ts` (add one test)

**Interfaces:**
- Consumes: `I18n` (`locale`, `setLocale`), `LOCALES`, `LocaleCode`, `TPipe`.
- Produces: `LanguageSwitcher`, selector `app-language-switcher`.

- [ ] **Step 1: Write the flags**

`projects/app/public/flags/gb.svg` (3:2, so it fits the 24×16 button image without letterboxing):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">
  <clipPath id="gb-s"><path d="M0,0 v40 h60 v-40 z"/></clipPath>
  <clipPath id="gb-t"><path d="M30,20 h30 v20 z v20 h-30 z h-30 v-20 z v-20 h30 z"/></clipPath>
  <g clip-path="url(#gb-s)">
    <path d="M0,0 v40 h60 v-40 z" fill="#012169"/>
    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" stroke-width="6"/>
    <path d="M0,0 L60,40 M60,0 L0,40" clip-path="url(#gb-t)" stroke="#C8102E" stroke-width="4"/>
    <path d="M30,0 v40 M0,20 h60" stroke="#fff" stroke-width="10"/>
    <path d="M30,0 v40 M0,20 h60" stroke="#C8102E" stroke-width="6"/>
  </g>
</svg>
```

`projects/app/public/flags/vn.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
  <rect width="30" height="20" fill="#DA251D"/>
  <polygon fill="#FFFF00" points="15.00,4.10 16.46,8.59 21.18,8.59 17.36,11.37 18.82,15.86 15.00,13.08 11.18,15.86 12.64,11.37 8.82,8.59 13.54,8.59"/>
</svg>
```

- [ ] **Step 2: Write the failing switcher spec**

`projects/app/src/app/i18n/language-switcher.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { I18n } from './i18n.service';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function render() {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => [...el.querySelectorAll('button')] as HTMLButtonElement[];
    return { fixture, el, buttons };
  }

  it('has one flag button per language, labelled in its own language', async () => {
    const { buttons } = await render();
    expect(buttons().map((b) => [b.getAttribute('aria-label'), b.getAttribute('title'), b.querySelector('img')!.getAttribute('src')])).toEqual([
      ['English', 'English', 'flags/gb.svg'],
      ['Tiếng Việt', 'Tiếng Việt', 'flags/vn.svg'],
    ]);
    for (const b of buttons()) expect(b.querySelector('img')!.getAttribute('alt')).toBe('');
  });

  it('marks the current language as pressed', async () => {
    const { buttons } = await render();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('switches to Vietnamese, remembers it and relabels the group', async () => {
    const { el, buttons, fixture } = await render();
    const group = el.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Language');

    buttons()[1].click();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(TestBed.inject(I18n).locale()).toBe('vi');
    expect(localStorage.getItem('locale')).toBe('vi');
    expect(group.getAttribute('aria-label')).toBe('Ngôn ngữ');
  });

  it('switches back to English', async () => {
    const { buttons, fixture } = await render();
    buttons()[1].click();
    await fixture.whenStable();
    await fixture.whenStable();
    buttons()[0].click();
    await fixture.whenStable();
    await fixture.whenStable();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(localStorage.getItem('locale')).toBe('en');
  });
});
```

Note: the click handler starts an async `setLocale`, so the spec waits on `whenStable()` twice (the catalog import, then the re-render). If a test is flaky on timing, add `await new Promise((r) => setTimeout(r))` before the final `whenStable()`. Do not call `setLocale` from the test instead of clicking, because that would hide a broken click handler.

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/language-switcher.spec.ts`
Expected: FAIL ("Cannot find module './language-switcher'").

- [ ] **Step 4: Write the component**

`projects/app/src/app/i18n/language-switcher.ts`:

```ts
import { Component, inject } from '@angular/core';
import { I18n } from './i18n.service';
import { LOCALES, LocaleCode } from './locales';
import { TPipe } from './t.pipe';

// One flag button per language, in the toolbar. The label is the language's own
// name, since a flag alone is neither accessible nor a reliable symbol.
@Component({
  selector: 'app-language-switcher',
  imports: [TPipe],
  template: `
    <div class="switcher" role="group" [attr.aria-label]="'nav.language' | t">
      @for (l of locales; track l.code) {
        <button
          type="button"
          class="lang"
          [class.active]="i18n.locale() === l.code"
          [attr.data-locale]="l.code"
          [attr.aria-label]="l.nativeName"
          [attr.aria-pressed]="i18n.locale() === l.code"
          [attr.title]="l.nativeName"
          (click)="choose(l.code)"
        >
          <img [src]="l.flag" alt="" width="24" height="16" />
        </button>
      }
    </div>
  `,
  styles: `
    .switcher {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .lang {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 32px;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 6px;
      background: none;
      cursor: pointer;
      opacity: 0.7;
    }
    .lang:hover,
    .lang:focus-visible {
      opacity: 1;
    }
    .lang.active {
      opacity: 1;
      border-color: var(--mat-sys-on-primary);
    }
    img {
      display: block;
      border-radius: 2px;
    }
  `,
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18n);
  protected readonly locales = LOCALES;

  protected choose(code: LocaleCode): void {
    void this.i18n.setLocale(code);
  }
}
```

- [ ] **Step 5: Run the switcher spec to verify it passes**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/language-switcher.spec.ts`
Expected: PASS (all four tests).

- [ ] **Step 6: Write the failing toolbar test**

Check first that the files are clean: `git diff --stat projects/app/src/app/app.ts projects/app/src/app/app.html projects/app/src/app/app.spec.ts` must print nothing. If it prints anything, stop and ask the user.

In `projects/app/src/app/app.spec.ts`, add this test directly after the `'has a separate sound effects on/off button in the toolbar'` test:

```ts
  it('has a flag button for each language in the toolbar, before the sound buttons', async () => {
    localStorage.clear();
    const { el } = await render();
    const buttons = [...el.querySelectorAll('mat-toolbar app-language-switcher button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['English', 'Tiếng Việt']);
    const switcher = el.querySelector('app-language-switcher')!;
    const music = el.querySelector('button.music-toggle')!;
    expect(switcher.compareDocumentPosition(music) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    localStorage.clear();
  });
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/app.spec.ts -t "flag button"`
Expected: FAIL (`buttons` is empty).

- [ ] **Step 8: Put the switcher in the toolbar**

In `projects/app/src/app/app.ts`, add the import and list it in the component's `imports`:

```ts
import { LanguageSwitcher } from './i18n/language-switcher';
```

```ts
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, LanguageSwitcher],
```

In `projects/app/src/app/app.html`, add the element on its own line directly before the music button:

```html
  <app-language-switcher />
  <button
    mat-icon-button
    type="button"
    class="music-toggle"
```

(Only the `<app-language-switcher />` line is new; the music button lines are shown for position.)

- [ ] **Step 9: Run the whole app project**

Run: `npx jest --selectProjects app`
Expected: PASS, every app spec including the existing ones unchanged. If an existing spec fails, the cause is the new element: fix the new code, never the old spec.

- [ ] **Step 10: Build to confirm the lazy chunk and the flags are published**

Run: `npx ng build app --configuration development 2>&1 | tail -25`
Expected: the build succeeds, the output lists a separate lazy chunk containing the Vietnamese catalog (a small `chunk-*.js`), and the output directory has `flags/gb.svg` and `flags/vn.svg`. Check with `ls dist/app/browser/flags`.

- [ ] **Step 11: Check it in the running app**

Use the `run` skill (or `npm start`) to open the app, then confirm:
1. Two flag buttons (UK and Vietnam) sit at the right of the toolbar, left of the music button, with the English one outlined.
2. Clicking the Vietnam flag outlines it, and a reload keeps it (`localStorage.locale` is `vi`).
3. The tooltips read "English" and "Tiếng Việt".
4. At a phone width (under 600px) the toolbar still fits with no horizontal scroll.
5. Nothing else on any screen changed.

Report what you saw. If the toolbar overflows at phone width, shrink only the switcher's own styles (button width and gap); do not edit `app.css`.

- [ ] **Step 12: Commit**

```bash
git add projects/app/public/flags/gb.svg projects/app/public/flags/vn.svg projects/app/src/app/i18n/language-switcher.ts projects/app/src/app/i18n/language-switcher.spec.ts projects/app/src/app/app.ts projects/app/src/app/app.html projects/app/src/app/app.spec.ts
git commit -m "feat(app): flag buttons in the toolbar switch the language

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (phase 1 only, as the spec's phases list defines it):
- `I18n` service, locale in a signal, saved in local storage, default English, lookup order: Task 1.
- `en` catalog skeleton, `vi` lazy-loaded: Task 1 (`catalogs.ts`, `vi.ts`).
- `t` pipe: Task 2.
- Flag buttons in the Navigation panel, `aria-pressed`, labels in own language, image flags not emoji, UK flag, one `LOCALES` list: Task 3.
- Parity test harness (keys and placeholders): `catalogs.spec.ts` in Task 1.
- Fallback spec: Task 1 (key missing from the catalog).
- Locale never in game state or sent to the server: no file outside `projects/app/src/app/i18n/`, the toolbar and `public/flags` is touched.
- Not in this plan, by design: structured lines (phase 2), templates (phase 3), content and glossary (phase 4), the Vietnamese catalog, the visual check and the style rule in `CLAUDE.md` (phase 5). The `vi` catalog holds one key, `nav.language`.

**Placeholder scan:** none. The one conditional in Step 3 of Task 3 gives the exact fallback.

**Type consistency:** `I18n.locale` is a signal read as `locale()` in every task. `setLocale(code: LocaleCode): Promise<void>` is called in Task 1's spec, Task 2's spec and Task 3's component. `DEFAULT_CATALOG_LOADERS` is defined in `catalogs.ts`, used by `catalogs.spec.ts` and by the token's factory. `MessageKey` is derived from `en` only.

**Review Focus:** each line has a test: unknown saved value (the `it.each` in `i18n.service.spec.ts`), throwing storage, failed load plus failed saved load, last click wins, missing params plus `$&` plus `constructor` (the `format` block).
