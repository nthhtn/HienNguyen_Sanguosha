import { makeTranslator, englishTranslator, localeOf } from './translator';
import type { Messages } from './messages';

describe('translator', () => {
  it('englishTranslator reads the English catalog', () => {
    expect(englishTranslator('nav.language')).toBe('Language');
  });

  it('makeTranslator reads the catalog it is given and fills placeholders', () => {
    const tr = makeTranslator({ 'nav.language': '{a} and {b}' } as Messages);
    expect(tr('nav.language', { a: 1, b: 'x' })).toBe('1 and x');
  });

  it('leaves a placeholder visible when its param is missing', () => {
    const tr = makeTranslator({ 'nav.language': '{a} and {b}' } as Messages);
    expect(tr('nav.language', { a: 1 })).toBe('1 and {b}');
  });
  it('carries the locale it was made for, and English when it says nothing', () => {
    expect(englishTranslator.locale).toBe('en');
    expect(makeTranslator({ 'nav.language': 'x' } as Messages).locale).toBe('en');
    expect(makeTranslator({ 'nav.language': 'x' } as Messages, 'vi').locale).toBe('vi');
    expect(localeOf(makeTranslator({ 'nav.language': 'x' } as Messages, 'vi'))).toBe('vi');
    expect(localeOf((key) => key)).toBe('en');
  });
});
