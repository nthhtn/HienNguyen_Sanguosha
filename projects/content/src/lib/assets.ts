import manifest from '../../assets/manifest.json';
import skins from '../../assets/generals/skins/skins.json';

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
export function generalSkinUrl(id: string): string | null {
  const skin = GENERAL_SKINS[id];
  return skin ? `/card-art/generals/skins/${skin}` : cardArtUrl(id);
}

// Generals whose skin has no death voice file yet.
const NO_DEATH_VOICE = new Set(['zuo-ci']);

// A General's death voice: /audio/death/<skin file name>.ogg, named by the pinyin of the skin
// (Cao Cao: caocao.ogg). Null for a General with no skin or no recording.
export function generalDeathVoiceUrl(id: string): string | null {
  const skin = GENERAL_SKINS[id];
  if (!skin || NO_DEATH_VOICE.has(id)) return null;
  return `/audio/death/${skin.replace(/^.*\//, '').replace(/\.[^.]+$/, '')}.ogg`;
}

// The back of a playing card, shown for a card whose face is hidden.
export const CARD_BACK_ART_URL = '/card-art/cards/back.jpg';

// The face-down General card, shown for a General another seat hasn't revealed.
// Not in the manifest (it isn't a crawled item), but it ships with the assets.
export const HIDDEN_GENERAL_ART_URL = '/card-art/generals/hidden.jpg';

// The highest HP with its own icon (misc/hp1.png … hp4.png).
const MAX_HP_ICONS = 4;

// The icons for a seat's current HP, shown alongside its number: hp1 up to
// hpN for N HP, stopping at the 4 icons above 4; none at 0 or below (dying).
export function hpIconUrls(hp: number): string[] {
  const count = Math.max(0, Math.min(hp, MAX_HP_ICONS));
  return Array.from({ length: count }, (_, i) => `/card-art/misc/hp${i + 1}.png`);
}
