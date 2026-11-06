import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { generalsData } from '../../data/generals';
import { kingdomWarsGeneralIds } from './kingdomWarsGenerals';
import { kingdomWarsGeneralId } from './generalIds';
import { AMBITIONIST_ICON_URL, assetFile, CARD_BACK_ART_URL, kingdomBannerUrl, spriteSheet, cardArtUrl, GENERAL_PLACEHOLDER_ART_URL, generalDeathVoiceUrl, generalSkinUrl, HIDDEN_GENERAL_ART_URL, hpIconUrls } from './assets';

describe('cardArtUrl', () => {
  it('returns the /images/ URL for a crawled id', () => {
    expect(cardArtUrl('cao-cao')).toBe('/images/generals/cards/wei/cao-cao.webp');
  });

  it('serves Tool art from the tool folder', () => {
    expect(cardArtUrl('duel')).toBe('/images/playing-cards/full/tool/duel.webp');
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
    expect(CARD_BACK_ART_URL).toBe('/images/playing-cards/back.jpg');
  });
});

describe('HIDDEN_GENERAL_ART_URL', () => {
  it('points at the General card back that ships with the content assets', () => {
    expect(HIDDEN_GENERAL_ART_URL).toBe('/images/generals/special/hidden.jpg');
  });
});

describe('AMBITIONIST_ICON_URL', () => {
  it('points at the Ambitionist icon that ships with the content assets', () => {
    expect(AMBITIONIST_ICON_URL).toBe('/images/generals/special/ambitionist-icon.png');
  });
});

describe('kingdomBannerUrl', () => {
  it('points each kingdom at its banner in the content assets', () => {
    expect(kingdomBannerUrl('Wei')).toBe('/images/ui/banners/wei.png');
    expect(kingdomBannerUrl('Shu')).toBe('/images/ui/banners/shu.png');
    expect(kingdomBannerUrl('Wu')).toBe('/images/ui/banners/wu.png');
    expect(kingdomBannerUrl('Qun')).toBe('/images/ui/banners/qun.png');
  });

  it('has none for a hidden kingdom', () => {
    expect(kingdomBannerUrl('hidden')).toBeNull();
    expect(kingdomBannerUrl(undefined)).toBeNull();
  });
});

describe('hpIconUrls', () => {
  const icon = (n: number) => `/images/ui/hp/${n}.png`;
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
    expect(generalDeathVoiceUrl('cao-cao')).toBe('/audio/death/generals/wei/caocao.ogg');
    expect(generalDeathVoiceUrl('fire-zhuge-liang')).toBe('/audio/death/generals/shu/wolong.ogg');
  });

  it('is null for a General with no skin or no recording', () => {
    expect(generalDeathVoiceUrl('does-not-exist')).toBeNull();
    expect(generalDeathVoiceUrl('zuo-ci')).toBeNull();
  });
});

describe('Kingdom Wars General art', () => {
  it('uses the base General skin and death voice', () => {
    expect(generalSkinUrl('kingdomWars:zhang-fei')).toBe(generalSkinUrl('zhang-fei'));
    expect(generalDeathVoiceUrl('kingdomWars:zhang-fei')).toBe(generalDeathVoiceUrl('zhang-fei'));
  });

  it('gives each new General its own skin and its own death voice, whose file ships', () => {
    const fresh = kingdomWarsGeneralIds().filter((id) => !Object.prototype.hasOwnProperty.call(generalsData, id));
    expect(fresh).toHaveLength(9);
    for (const id of fresh) {
      expect(generalSkinUrl(kingdomWarsGeneralId(id))).toMatch(/^\/images\/generals\/skins\/\w+\/\w+\.webp$/);
      const voice = generalDeathVoiceUrl(kingdomWarsGeneralId(id));
      expect(voice).toMatch(/^\/audio\/death\/generals\/\w+\/\w+\.ogg$/);
      expect(existsSync(join(__dirname, '../../assets', voice!.replace('/audio/', 'audio/')))).toBe(true);
    }
  });

  it('falls back to the placeholder for a General with no art', () => {
    expect(GENERAL_PLACEHOLDER_ART_URL).toBe('/images/generals/special/placeholder.svg');
    expect(generalSkinUrl('kingdomWars:nobody')).toBe(GENERAL_PLACEHOLDER_ART_URL);
  });
});

describe('placeholder portrait shipping', () => {
  it('exists and is copied to images by the app build assets', () => {
    const root = join(__dirname, '../../../..');
    expect(existsSync(join(root, 'projects/content/assets/generals/special/placeholder.svg'))).toBe(true);
    const angular = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
    const assets: { glob: string; input: string; output?: string }[] = angular.projects.app.architect.build.options.assets;
    const url = GENERAL_PLACEHOLDER_ART_URL.replace('/images/', '');
    expect(assets.some((a) => a.input === 'projects/content/assets' && a.output === 'images' && a.glob === url)).toBe(true);
  });
});

describe('spriteSheet', () => {
  const ids = ['slash', 'slash-fire', 'slash-lightning', 'damage', 'fire', 'lightning', 'chain'] as const;

  it('points each effect at its sheet in the content assets', () => {
    expect(spriteSheet('slash-fire').url).toBe('/images/effects/sheets/slash-fire.png');
    expect(spriteSheet('chain').url).toBe('/images/effects/sheets/chain.png');
  });

  it('describes a grid that holds every frame, with a burst and a peak inside it', () => {
    for (const id of ids) {
      const sheet = spriteSheet(id);
      expect(sheet.cols * sheet.rows).toBeGreaterThanOrEqual(sheet.frames);
      expect(sheet.lead).toBeLessThan(sheet.burstEnd);
      expect(sheet.burstEnd).toBeLessThanOrEqual(sheet.frames);
      expect(sheet.peak).toBeLessThan(sheet.frames);
    }
  });
});

// The size of a JPEG file, read from its start-of-frame marker.
function jpegSize(path: string): { width: number; height: number } {
  const data = readFileSync(path);
  let i = 2;
  while (i < data.length) {
    if (data[i] !== 0xff) { i++; continue; }
    const marker = data[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    i += 2 + data.readUInt16BE(i + 2);
  }
  throw new Error(`No JPEG frame in ${path}`);
}

describe('Starvation art', () => {
  // The full-size facts live in the masters and the crop boxes: the shipped cards are shrunk to 320 px.
  const content = join(__dirname, '../..');
  const masters = join(content, 'assets-src');
  const boxes = JSON.parse(readFileSync(join(content, 'asset-crops.json'), 'utf8')) as Record<string, [number, number, number, number]>;
  const cropSize = (card: string) => ({ width: boxes[card][2], height: boxes[card][3] });

  it('the full card is the landscape scan, laid out like Capture, and the manifest says so', () => {
    const full = jpegSize(join(masters, 'playing-cards/full/tool/starvation.jpg'));
    expect(full).toEqual({ width: 969, height: 651 });
    const capture = jpegSize(join(masters, 'playing-cards/full/tool/capture.jpg'));
    expect(capture.width).toBeGreaterThan(capture.height);
    const entry = JSON.parse(readFileSync(join(masters, 'manifest.json'), 'utf8')).starvation;
    expect({ width: entry.width, height: entry.height }).toEqual(full);
    expect(entry.note).toBeUndefined();
  });

  it('the cropped art is the whole illustration cut from that landscape card, framed as Capture\'s is', () => {
    // Capture's crop is 526 x 536 from a 974 x 654 card; Starvation's card is the same layout, a hair smaller.
    expect(cropSize('tool/capture')).toEqual({ width: 526, height: 536 });
    expect(cropSize('tool/starvation')).toEqual({ width: 523, height: 534 });
  });
});

describe('assetFile', () => {
  it('adds the extension its recipe ships to a reference without one', () => {
    expect(assetFile('generals/skins/wei/caocao')).toBe('generals/skins/wei/caocao.webp');
    expect(assetFile('generals/cards/wei/cao-cao')).toBe('generals/cards/wei/cao-cao.webp');
    expect(assetFile('playing-cards/full/tool/duel')).toBe('playing-cards/full/tool/duel.webp');
    expect(assetFile('playing-cards/cropped/tool/duel')).toBe('playing-cards/cropped/tool/duel.webp');
    expect(assetFile('audio/death/generals/wei/caocao')).toBe('audio/death/generals/wei/caocao.ogg');
  });

  it('leaves a path whose recipe names no extension as it is', () => {
    expect(assetFile('ui/brand/logo.png')).toBe('ui/brand/logo.png');
    expect(assetFile('generals/skins/skins.json')).toBe('generals/skins/skins.json');
    expect(assetFile('audio/music/background.ogg')).toBe('audio/music/background.ogg');
  });

  it('matches whole folder names, so a look-alike folder gets nothing', () => {
    expect(assetFile('generals/skins-extra/wei/a')).toBe('generals/skins-extra/wei/a');
  });
});

describe('shipped files', () => {
  const assets = join(__dirname, '../../assets');
  const read = (path: string) => JSON.parse(readFileSync(join(assets, path), 'utf8')) as Record<string, unknown>;
  const localPaths = () => Object.values(read('manifest.json')).map((e) => (e as { localPath: string }).localPath);

  it('has a file for every manifest entry', () => {
    const missing = localPaths().filter((p) => !existsSync(join(assets, assetFile(p))));
    expect(missing).toEqual([]);
  });

  it('has a cropped counterpart for every full playing card', () => {
    const cards = localPaths().filter((p) => p.startsWith('playing-cards/full/'));
    expect(cards.length).toBeGreaterThan(40);
    expect(cards.filter((p) => !existsSync(join(assets, assetFile(p.replace('playing-cards/full/', 'playing-cards/cropped/')))))).toEqual([]);
  });

  it('has a file for every skin', () => {
    const missing = Object.entries(read('generals/skins/skins.json')).filter(([, skin]) => !existsSync(join(assets, assetFile(`generals/skins/${skin as string}`))));
    expect(missing.map(([id]) => id)).toEqual([]);
  });

  it('has a sheet for every sprite effect', () => {
    for (const id of Object.keys(read('effects/sheets/sheets.json'))) expect(existsSync(join(assets, 'effects/sheets', `${id}.png`))).toBe(true);
  });

  it('keeps manifest and skin references free of file extensions', () => {
    expect(localPaths().filter((p) => /\.[a-z]+$/.test(p))).toEqual([]);
    expect(Object.values(read('generals/skins/skins.json')).filter((p) => /\.[a-z]+$/.test(p as string))).toEqual([]);
  });
});
