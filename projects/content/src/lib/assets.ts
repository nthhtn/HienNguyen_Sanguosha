import manifest from '../../assets/manifest.json';
import { baseGeneralId, isKingdomWarsGeneralId } from './generalIds';
import skins from '../../assets/generals/skins/skins.json';
import previews from '../../assets/preview/index.json';

interface AssetManifestEntry {
  localPath: string;
}

const ASSET_MANIFEST: Record<string, AssetManifestEntry> = manifest;

export function cardArtUrl(id: string): string | null {
  const entry = ASSET_MANIFEST[id];
  return entry ? `/card-art/${entry.localPath}` : null;
}

// A card's art alone, without the card frame, name or rules text: what the Play
// screen shows, since it draws its own suit, number and name over the art.
export function croppedCardArtUrl(id: string): string | null {
  const entry = ASSET_MANIFEST[id];
  return entry ? `/card-art/${entry.localPath.replace(/^cards\//, 'cards/cropped/')}` : null;
}

const GENERAL_SKINS: Record<string, string> = skins;

// A General's skin: the portrait used on the Play screen. A General with no
// skin falls back to its crawled card art (the one the Wiki always shows).
// A Kingdom Wars General uses its base General's art; one with none gets the placeholder.
export function generalSkinUrl(id: string): string | null {
  if (isKingdomWarsGeneralId(id)) {
    const base = baseGeneralId(id);
    return generalSkinUrl(base) ?? GENERAL_PLACEHOLDER_ART_URL;
  }
  const skin = GENERAL_SKINS[id];
  return skin ? `/card-art/generals/skins/${skin}` : cardArtUrl(id);
}

// Generals whose skin has no death voice file yet.
const NO_DEATH_VOICE = new Set(['zuo-ci']);

// A General's death voice: /audio/death/<skin file name>.ogg, named by the pinyin of the skin
// (Cao Cao: caocao.ogg). Null for a General with no skin or no recording.
export function generalDeathVoiceUrl(id: string): string | null {
  const base = baseGeneralId(id);
  const skin = GENERAL_SKINS[base];
  if (!skin || NO_DEATH_VOICE.has(base)) return null;
  return `/audio/death/${skin.replace(/^.*\//, '').replace(/\.[^.]+$/, '')}.ogg`;
}

// A skill's id in file names: its English name in lower-case words joined by hyphens ("Refuting Death" is
// refuting-death), the same key the Vietnamese locale uses.
export const skillFileId = (skillName: string): string =>
  skillName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// The languages each skill preview exists in, by `<General id>_<skill id>`. A preview is a file
// `preview/<General id>_<skill id>_<language>.mp4`, and is listed here when it is added, so the Wiki
// offers a video only for a skill that has one.
const SKILL_PREVIEWS: Record<string, string[]> = previews;

// The preview video for one of a General's skills, in the language asked for, else in English. Null when
// the skill has none. A Kingdom Wars id and its base id give the same video.
export function skillPreviewUrl(generalId: string, skillName: string, language: string, index: Record<string, string[]> = SKILL_PREVIEWS): string | null {
  const key = `${baseGeneralId(generalId)}_${skillFileId(skillName)}`;
  const languages = index[key] ?? [];
  const chosen = languages.includes(language) ? language : languages.includes('en') ? 'en' : null;
  return chosen ? `/preview/${key}_${chosen}.mp4` : null;
}

// The back of a playing card, shown for a card whose face is hidden.
export const CARD_BACK_ART_URL = '/card-art/cards/back.jpg';

// The face-down General card, shown for a General another seat hasn't revealed.
// Not in the manifest (it isn't a crawled item), but it ships with the assets.
export const HIDDEN_GENERAL_ART_URL = '/card-art/generals/hidden.jpg';

// The portrait for a General with no skin or card art of its own. Ships with the assets, like the above.
export const GENERAL_PLACEHOLDER_ART_URL = '/card-art/generals/placeholder.svg';

// The mark overlaid on an Ambitionist's seat. Ships with the assets, like the above.
export const AMBITIONIST_ICON_URL = '/card-art/generals/ambitionist_icon.png';

// The highest HP with its own icon (misc/hp/1.png … 4.png).
const MAX_HP_ICONS = 4;

// The icons for a seat's current HP, shown alongside its number: 1 up to
// N for N HP, stopping at the 4 icons above 4; none at 0 or below (dying).
export function hpIconUrls(hp: number): string[] {
  const count = Math.max(0, Math.min(hp, MAX_HP_ICONS));
  return Array.from({ length: count }, (_, i) => `/card-art/misc/hp/${i + 1}.png`);
}
