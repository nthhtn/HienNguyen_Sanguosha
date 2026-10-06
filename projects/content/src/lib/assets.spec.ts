import { cardArtUrl, HIDDEN_GENERAL_ART_URL, hpImageUrl } from './assets';

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

describe('hpImageUrl', () => {
  it('shows the image for HP 1 to 4', () => {
    expect([1, 2, 3, 4].map(hpImageUrl)).toEqual([1, 2, 3, 4].map((n) => `/card-art/misc/hp_${n}.jpg`));
  });
  it('uses the 4 HP image above 4', () => {
    expect(hpImageUrl(6)).toBe('/card-art/misc/hp_4.jpg');
  });
  it('shows none at 0 HP or below', () => {
    expect(hpImageUrl(0)).toBeNull();
    expect(hpImageUrl(-2)).toBeNull();
  });
});
