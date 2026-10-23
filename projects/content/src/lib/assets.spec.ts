import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { generalsData } from '../../data/generals';
import { alternateGeneralIds } from './alternateGenerals';
import { alternateGeneralId } from './generalIds';
import { CARD_BACK_ART_URL, cardArtUrl, GENERAL_PLACEHOLDER_ART_URL, generalDeathVoiceUrl, generalSkinUrl, HIDDEN_GENERAL_ART_URL, hpIconUrls } from './assets';

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
  const icon = (n: number) => `/card-art/misc/hp/${n}.png`;
  it('shows one icon per HP, from 1 up to the current HP', () => {
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

describe('Alternate General art', () => {
  it('uses the base General skin and death voice', () => {
    expect(generalSkinUrl('alternate:zhang-fei')).toBe(generalSkinUrl('zhang-fei'));
    expect(generalDeathVoiceUrl('alternate:zhang-fei')).toBe(generalDeathVoiceUrl('zhang-fei'));
  });

  it('falls back to the placeholder for a General with no art', () => {
    expect(GENERAL_PLACEHOLDER_ART_URL).toBe('/card-art/generals/placeholder.svg');
    const fresh = alternateGeneralIds().filter((id) => !Object.prototype.hasOwnProperty.call(generalsData, id));
    expect(fresh).toHaveLength(9);
    for (const id of fresh) {
      expect(generalSkinUrl(alternateGeneralId(id))).toBe(GENERAL_PLACEHOLDER_ART_URL);
      expect(generalDeathVoiceUrl(alternateGeneralId(id))).toBeNull();
    }
    expect(generalSkinUrl('alternate:zou-shi')).toBe(GENERAL_PLACEHOLDER_ART_URL);
    expect(generalSkinUrl('alternate:nobody')).toBe(GENERAL_PLACEHOLDER_ART_URL);
  });
});

describe('placeholder portrait shipping', () => {
  it('exists and is copied to card-art by the app build assets', () => {
    const root = join(__dirname, '../../../..');
    expect(existsSync(join(root, 'projects/content/assets/generals/placeholder.svg'))).toBe(true);
    const angular = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
    const assets: { glob: string; input: string; output?: string }[] = angular.projects.app.architect.build.options.assets;
    const url = GENERAL_PLACEHOLDER_ART_URL.replace('/card-art/', '');
    expect(assets.some((a) => a.input === 'projects/content/assets' && a.output === 'card-art' && a.glob === url)).toBe(true);
  });
});
