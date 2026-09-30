import { cardArtUrl } from './assets';

describe('cardArtUrl', () => {
  it('returns the /card-art/ URL for a crawled id', () => {
    expect(cardArtUrl('cao-cao')).toBe('/card-art/generals/wei/cao-cao.jpg');
  });

  it('returns null for an id with no crawled art', () => {
    expect(cardArtUrl('does-not-exist')).toBeNull();
  });

  it('returns null for the "hidden" redaction sentinel', () => {
    expect(cardArtUrl('hidden')).toBeNull();
  });
});
