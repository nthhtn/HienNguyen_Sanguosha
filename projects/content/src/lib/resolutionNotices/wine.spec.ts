import { wineNotice } from './wine';
import { played, span, view } from './helpers.testing';

describe('Wine notice', () => {
  it('says the next Sha deals 1 extra damage', () => {
    const n = wineNotice.describe(span('wine', 'a', [], [played('wine', 'a', [])]), view())!;
    expect(n.seatIds).toEqual(['a']);
    expect(n.outcome).toMatchObject({ tone: 'good', headline: { key: 'notice.wine.drunk' }, text: { key: 'notice.wine.text' } });
  });
});
