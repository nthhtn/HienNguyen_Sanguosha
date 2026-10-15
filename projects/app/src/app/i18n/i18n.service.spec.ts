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
