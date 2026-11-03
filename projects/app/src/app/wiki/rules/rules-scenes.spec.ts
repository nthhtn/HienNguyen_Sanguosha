import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { cardIds, generalIds } from 'content';
import { routes } from '../../app.routes';
import { I18n } from '../../i18n/i18n.service';

const PAGES = ['overview', 'card-types', 'setup', 'turn', 'distance', 'response', 'damage', 'judgment', 'chains', 'glossary'] as const;
const LOCALES = ['en', 'vi'] as const;
const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

// Every hyphenated id the game knows (cao-cao, hail-of-arrows, ...), so a new picture on a page is guarded without editing a list here.
const HYPHEN_IDS = [...generalIds(), ...cardIds()].filter((id) => id.includes('-'));
const ID_LEAK = new RegExp(`\\bseat-\\d|\\b(${HYPHEN_IDS.join('|')})\\b`);
// What a screen reader gets from a page's pictures and labelled parts, in page order.
const named = (el: Element) => [...el.querySelectorAll('img, [aria-label], [title]')].flatMap((e) => ['alt', 'aria-label', 'title'].map((a) => e.getAttribute(a)).filter((v): v is string => !!v));

// What every scene on the rules pages must hold, in both languages: real art, a name for each picture, and no
// internal id or placeholder in anything a reader or a screen reader gets.
describe.each(LOCALES)('the rules scenes in %s', (locale) => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function open(page: string) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    await TestBed.inject(I18n).setLocale(locale);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/wiki/rules/${page}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it.each(PAGES)('%s: every scene image has real art and a name', async (page) => {
    const el = await open(page);
    const images = [...el.querySelectorAll('img.scene-card, img.scene-avatar, img.scene-chain')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect([page, img.getAttribute('src')]).toEqual([page, expect.stringMatching(/^\/card-art\/.+\.(jpg|png)$/)]);
      expect(img.getAttribute('src')).not.toMatch(/placeholder|unknown/);
      expect(img.getAttribute('alt')!.trim()).not.toBe('');
    }
    for (const mark of el.querySelectorAll('img.scene-mark')) expect(mark.getAttribute('src')).toMatch(/^\/card-art\//);
    expect(el.querySelector('.card-art-placeholder')).toBeNull();
  });

  it.each(PAGES)('%s: every card, General and seat component shows its picture', async (page) => {
    const el = await open(page);
    expect(el.querySelectorAll('img.scene-card').length).toBe(el.querySelectorAll('app-scene-card, app-scene-general').length);
    expect(el.querySelectorAll('img.scene-avatar').length).toBe(el.querySelectorAll('app-scene-seat').length);
  });

  it.each(PAGES)('%s: no id or placeholder text is shown or read out', async (page) => {
    const el = await open(page);
    const alts = [...el.querySelectorAll('img')].map((img) => img.getAttribute('alt') ?? '');
    const shown = [text(el), ...alts, ...[...el.querySelectorAll('[aria-label], [title]')].flatMap((e) => [e.getAttribute('aria-label'), e.getAttribute('title')].filter((v): v is string => !!v))].join(' | ');
    expect(shown).not.toMatch(ID_LEAK);
    expect(shown).not.toMatch(/undefined|\bnull\b|\[object|NaN/);
  });
});

describe('a scene follows a language switch', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function openIn(page: string, locale: 'en' | 'vi') {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    await TestBed.inject(I18n).setLocale(locale);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/wiki/rules/${page}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness;
  }

  it.each(PAGES)('%s: picture names, labels and titles all change with the language, as on a fresh load', async (page) => {
    const harness = await openIn(page, 'en');
    const english = named(harness.routeNativeElement as HTMLElement);
    await TestBed.inject(I18n).setLocale('vi');
    harness.detectChanges();
    const switched = named(harness.routeNativeElement as HTMLElement);

    const fresh = named((await openIn(page, 'vi')).routeNativeElement as HTMLElement);
    expect(switched).toEqual(fresh);
    expect(switched.length).toBe(english.length);
    switched.forEach((value, i) => expect([page, i, value]).not.toEqual([page, i, english[i]]));
  });
});
