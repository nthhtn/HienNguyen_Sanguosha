import { printingIsRed, printingLabel } from './printing-label';

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

describe('printingIsRed', () => {
  it('is true for hearts and diamonds, false for spades and clubs', () => {
    expect(printingIsRed({ suit: 'heart', rank: 4 })).toBe(true);
    expect(printingIsRed({ suit: 'diamond', rank: 4 })).toBe(true);
    expect(printingIsRed({ suit: 'spade', rank: 4 })).toBe(false);
    expect(printingIsRed({ suit: 'club', rank: 4 })).toBe(false);
  });
});
