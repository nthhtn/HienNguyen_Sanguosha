import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { I18n } from '../../i18n/i18n.service';

const PAGES = ['overview', 'card-types', 'setup', 'turn', 'distance', 'judgment'] as const;
const LOCALES = ['en', 'vi'] as const;
const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

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
    const images = [...el.querySelectorAll('img.scene-card, img.scene-avatar')];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect([page, img.getAttribute('src')]).toEqual([page, expect.stringMatching(/^\/card-art\/.+\.(jpg|png)$/)]);
      expect(img.getAttribute('src')).not.toMatch(/placeholder|unknown/);
      expect(img.getAttribute('alt')!.trim()).not.toBe('');
    }
    expect(el.querySelector('.card-art-placeholder')).toBeNull();
  });

  it.each(PAGES)('%s: no id or placeholder text is shown or read out', async (page) => {
    const el = await open(page);
    const alts = [...el.querySelectorAll('img')].map((img) => img.getAttribute('alt') ?? '');
    const shown = [text(el), ...alts, ...[...el.querySelectorAll('[aria-label], [title]')].flatMap((e) => [e.getAttribute('aria-label'), e.getAttribute('title')].filter((v): v is string => !!v))].join(' | ');
    expect(shown).not.toMatch(/\bseat-\d|\b(cao-cao|zhang-liao|zhang-jiao|guo-jia|liu-bei|guan-yu|sun-quan|gan-ning|hail-of-arrows|peach-garden|eight-trigrams|red-hare|shadow-runner)\b/);
    expect(shown).not.toMatch(/undefined|\bnull\b|\[object|NaN/);
  });
});

describe('a scene follows a language switch', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('the Setup scenes change caption, seat names and picture names with the language', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/wiki/rules/setup');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect([...el.querySelectorAll('.cap')].map(text)).toContain('Different Force');
    expect(text(el)).toContain('Seat 2');
    expect([...el.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toContain('Zhang Jiao');

    await TestBed.inject(I18n).setLocale('vi');
    harness.detectChanges();
    expect([...el.querySelectorAll('.cap')].map(text)).toContain('Khác thế lực');
    expect(text(el)).toContain('Người chơi 2');
    expect([...el.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toContain('Trương Giác');
  });
});
