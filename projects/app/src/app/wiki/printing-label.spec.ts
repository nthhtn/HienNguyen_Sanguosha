import { printingLabel } from './printing-label';

describe('printingLabel', () => {
  it('shows the suit symbol and the rank, with face ranks as letters', () => {
    expect(printingLabel({ suit: 'spade', rank: 1 })).toBe('♠A');
    expect(printingLabel({ suit: 'heart', rank: 11 })).toBe('♥J');
    expect(printingLabel({ suit: 'club', rank: 12 })).toBe('♣Q');
    expect(printingLabel({ suit: 'diamond', rank: 13 })).toBe('♦K');
    expect(printingLabel({ suit: 'spade', rank: 7 })).toBe('♠7');
    expect(printingLabel({ suit: 'heart', rank: 10 })).toBe('♥10');
  });
});
