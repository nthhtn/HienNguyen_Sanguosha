import { makeTranslator, englishTranslator } from './translator';
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
});
