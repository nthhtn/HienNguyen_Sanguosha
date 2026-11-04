import manifest from '../../assets/manifest.json';
import { baseGeneralId, isKingdomWarsGeneralId } from './generalIds';
import skins from '../../assets/generals/skins/skins.json';
import sheetManifest from '../../assets/animation/sheets/sheets.json';

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

// The back of a playing card, shown for a card whose face is hidden.
export const CARD_BACK_ART_URL = '/card-art/cards/back.jpg';

// The face-down General card, shown for a General another seat hasn't revealed.
// Not in the manifest (it isn't a crawled item), but it ships with the assets.
export const HIDDEN_GENERAL_ART_URL = '/card-art/generals/hidden.jpg';

// The portrait for a General with no skin or card art of its own. Ships with the assets, like the above.
export const GENERAL_PLACEHOLDER_ART_URL = '/card-art/generals/placeholder.svg';

// The mark overlaid on an Ambitionist's seat. Ships with the assets, like the above.
export const AMBITIONIST_ICON_URL = '/card-art/generals/ambitionist_icon.png';

// The banner for a revealed kingdom, hung on the left of its seats; none while the kingdom is hidden.
const KINGDOM_BANNERS: Record<string, string> = { Wei: 'wei', Shu: 'shu', Wu: 'wu', Qun: 'qun' };
export function kingdomBannerUrl(kingdom: string | undefined): string | null {
  const file = kingdom ? KINGDOM_BANNERS[kingdom] : undefined;
  return file ? `/card-art/banner/${file}.png` : null;
}

// The frame animations played over a seat: a hit's picture and the chain. Each is one PNG grid of
// frames (built by scripts/build-sprite-sheets.py from assets/sprites/<folder>), with the numbers its timing needs.
export type SpriteId = 'slash' | 'slash-fire' | 'slash-lightning' | 'damage' | 'fire' | 'lightning' | 'chain';

export interface SpriteSheet {
  url: string;
  frames: number;
  cols: number;
  rows: number;
  // One frame, in px.
  width: number;
  height: number;
  // The frames before the burst: the first large frame (index `lead`) is where a pop-in goes.
  lead: number;
  // The frame the burst ends at, exclusive; frames from here on are the tail.
  burstEnd: number;
  pop: boolean;
  // The frame to show still (reduced motion).
  peak: number;
}

type SheetMeta = Omit<SpriteSheet, 'url'>;
const SHEET_META: Record<SpriteId, SheetMeta> = sheetManifest;

export function spriteSheet(id: SpriteId): SpriteSheet {
  return { url: `/card-art/animation/sheets/${id}.png`, ...SHEET_META[id] };
}

// The highest HP with its own icon (misc/hp/1.png … 4.png).
const MAX_HP_ICONS = 4;

// The icons for a seat's current HP, shown alongside its number: 1 up to
// N for N HP, stopping at the 4 icons above 4; none at 0 or below (dying).
export function hpIconUrls(hp: number): string[] {
  const count = Math.max(0, Math.min(hp, MAX_HP_ICONS));
  return Array.from({ length: count }, (_, i) => `/card-art/misc/hp/${i + 1}.png`);
}

// The badge on a chained seat (the Game screen's chain image).
export const CHAIN_ICON_URL = '/card-art/misc/chain.png';
// The two halves of a chained seat's chain: one hangs from the top left corner of the General holder, one from the top right.
export const CHAIN_LEFT_URL = '/card-art/misc/chain_left.png';
export const CHAIN_RIGHT_URL = '/card-art/misc/chain_right.png';
