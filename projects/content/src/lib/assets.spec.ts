import { cardArtUrl, HIDDEN_GENERAL_ART_URL } from './assets';

describe('cardArtUrl', () => {
  it('returns the /card-art/ URL for a crawled id', () => {
    expect(cardArtUrl('cao-cao')).toBe('/card-art/generals/wei/cao-cao.jpg');
  });

  it('serves Tool art from the tool folder', () => {
    expect(cardArtUrl('duel')).toBe('/card-art/cards/tool/duel.jpg');
  });

  it('returns null for an id with no crawled art', () => {
    expect(cardArtUrl('does-not-exist')).toBeNull();
  });

  it('returns null for the "hidden" redaction sentinel', () => {
    expect(cardArtUrl('hidden')).toBeNull();
  });
});

describe('HIDDEN_GENERAL_ART_URL', () => {
  it('points at the General card back that ships with the content assets', () => {
    expect(HIDDEN_GENERAL_ART_URL).toBe('/card-art/generals/unnamed.jpg');
  });
});
