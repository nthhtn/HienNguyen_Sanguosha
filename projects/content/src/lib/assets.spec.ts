import { CARD_BACK_ART_URL, cardArtUrl, generalDeathVoiceUrl, HIDDEN_GENERAL_ART_URL, hpIconUrls } from './assets';

describe('cardArtUrl', () => {
  it('returns the /card-art/ URL for a crawled id', () => {
    expect(cardArtUrl('cao-cao')).toBe('/card-art/generals/cards/wei/cao-cao.jpg');
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

describe('CARD_BACK_ART_URL', () => {
  it('points at the playing-card back that ships with the content assets', () => {
    expect(CARD_BACK_ART_URL).toBe('/card-art/cards/back.jpg');
  });
});

describe('HIDDEN_GENERAL_ART_URL', () => {
  it('points at the General card back that ships with the content assets', () => {
    expect(HIDDEN_GENERAL_ART_URL).toBe('/card-art/generals/hidden.jpg');
  });
});

describe('hpIconUrls', () => {
  const icon = (n: number) => `/card-art/misc/hp${n}.png`;
  it('shows one icon per HP, from hp1 up to the current HP', () => {
    expect(hpIconUrls(1)).toEqual([icon(1)]);
    expect(hpIconUrls(2)).toEqual([icon(1), icon(2)]);
    expect(hpIconUrls(4)).toEqual([1, 2, 3, 4].map(icon));
  });
  it('stops at the 4 icons above 4 HP', () => {
    expect(hpIconUrls(6)).toEqual([1, 2, 3, 4].map(icon));
  });
  it('shows none at 0 HP or below', () => {
    expect(hpIconUrls(0)).toEqual([]);
    expect(hpIconUrls(-2)).toEqual([]);
  });
});

describe('generalDeathVoiceUrl', () => {
  it('is named by the General’s skin file', () => {
    expect(generalDeathVoiceUrl('cao-cao')).toBe('/audio/death/caocao.ogg');
    expect(generalDeathVoiceUrl('fire-zhuge-liang')).toBe('/audio/death/wolong.ogg');
  });

  it('is null for a General with no skin or no recording', () => {
    expect(generalDeathVoiceUrl('does-not-exist')).toBeNull();
    expect(generalDeathVoiceUrl('zuo-ci')).toBeNull();
  });
});
