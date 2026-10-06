import manifest from '../../assets/manifest.json';

interface AssetManifestEntry {
  localPath: string;
}

const ASSET_MANIFEST: Record<string, AssetManifestEntry> = manifest;

export function cardArtUrl(id: string): string | null {
  const entry = ASSET_MANIFEST[id];
  return entry ? `/card-art/${entry.localPath}` : null;
}

// The face-down General card, shown for a General another seat hasn't revealed.
// Not in the manifest (it isn't a crawled item), but it ships with the assets.
export const HIDDEN_GENERAL_ART_URL = '/card-art/generals/unnamed.jpg';

// The highest HP with its own image (misc/hp_1.jpg … hp_4.jpg).
const MAX_HP_IMAGE = 4;

// The image for a seat's current HP, alongside its number. Above 4 it shows
// the 4 HP image; at 0 or below (dying) there is none.
export function hpImageUrl(hp: number): string | null {
  if (hp <= 0) return null;
  return `/card-art/misc/hp_${Math.min(hp, MAX_HP_IMAGE)}.jpg`;
}
