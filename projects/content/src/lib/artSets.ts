import index from '../../assets/generals/skins/art-sets.json';

// An art set is a named collection of alternate General portraits. `classic` is always present and complete;
// any other set may cover only some Generals. The catalog is generated from the art set folders by
// scripts/build-assets.py, so it cannot drift from the files that ship.
export type ArtSetId = string;

export const DEFAULT_ART_SET: ArtSetId = 'classic';

export interface ArtSetEntry {
  names: { en: string; vi: string };
  provenance: string;
  // Base General ids this set has a portrait for, and the subset that also has a face crop.
  portraits: readonly string[];
  faces: readonly string[];
}

export interface ArtSetCatalog {
  order: readonly ArtSetId[];
  sets: Readonly<Record<ArtSetId, ArtSetEntry>>;
}

// A viewer's choice: the global set, a per-General override keyed by base General id, and the catalog they resolve against.
export interface ArtChoice {
  global: ArtSetId;
  overrides: Readonly<Record<string, ArtSetId>>;
  catalog: ArtSetCatalog;
}

export const ART_SET_CATALOG: ArtSetCatalog = index;

export const DEFAULT_ART_CHOICE: ArtChoice = { global: DEFAULT_ART_SET, overrides: {}, catalog: ART_SET_CATALOG };

const covers = (catalog: ArtSetCatalog, set: ArtSetId, baseId: string): boolean => catalog.sets[set]?.portraits.includes(baseId) ?? false;

// The sets that have a portrait for a General, in catalog order.
export function setsCovering(baseId: string, catalog: ArtSetCatalog = ART_SET_CATALOG): ArtSetId[] {
  return catalog.order.filter((set) => covers(catalog, set, baseId));
}

// The set whose art shows for a General: its override, then the global set, then classic. A set counts only
// if it exists and has a portrait for that General, so a stale choice never leaves a gap.
export function resolveArtSet(baseId: string, choice: ArtChoice): ArtSetId {
  const override = choice.overrides[baseId];
  if (override !== undefined && covers(choice.catalog, override, baseId)) return override;
  if (covers(choice.catalog, choice.global, baseId)) return choice.global;
  return DEFAULT_ART_SET;
}

export function artSetName(entry: ArtSetEntry, locale: string): string {
  return locale === 'vi' ? entry.names.vi : entry.names.en;
}
