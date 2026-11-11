import { botRules } from './registry';

describe('bot rules', () => {
  it('rejects a repeated id', () => {
    expect(() => botRules([{ id: 'x' }, { id: 'x' }])).toThrow('Duplicate bot rule "x"');
  });

  it('keeps insertion order', () => {
    expect([...botRules([{ id: 'a' }, { id: 'b' }]).keys()]).toEqual(['a', 'b']);
  });
});
