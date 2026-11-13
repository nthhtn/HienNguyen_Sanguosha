import { baseGeneralId, pairKey } from 'content';
import type { Action, ContentRegistry } from 'engine';
import { GENERAL_VALUES } from './general-values.data';
import { KINGDOM_WARS_PAIR_BONUSES, KINGDOM_WARS_VALUES } from './general-values.kingdom-wars.data';

type Choice = Extract<Action, { kind: 'ChooseGeneralsAction' }>;

// Max HP only breaks ties between pairs the table rates equally.
export const HP_TIEBREAK = 0.0001;

// The tables are generated into their own files so regenerating them never touches this code.
export { GENERAL_VALUES };

// One deck's table: values by full General id, and the extra lift of a pair by `pairKey`.
export interface DeckTable {
  values: Readonly<Record<string, number>>;
  pairBonuses: Readonly<Record<string, number>>;
}

// The tables a policy picks Generals by: the Identity table (by base id), and a Kingdom Wars table or none.
export interface PickTables {
  identity: Readonly<Record<string, number>>;
  kingdomWars: DeckTable | null;
}

export const KINGDOM_WARS_TABLE: DeckTable = { values: KINGDOM_WARS_VALUES, pairBonuses: KINGDOM_WARS_PAIR_BONUSES };

const KINGDOM_WARS_PREFIX = 'kingdomWars:';

// A plain record is the Identity table alone, read by base id for every deck (the frozen behaviour).
export function pickTablesOf(v: Readonly<Record<string, number>> | PickTables): PickTables {
  return 'identity' in v && 'kingdomWars' in v && typeof v.identity === 'object' ? (v as PickTables) : { identity: v as Readonly<Record<string, number>>, kingdomWars: null };
}

// Rule R5: a `kingdomWars:` id reads the Kingdom Wars table by full id when there is one; any other id reads
// the Identity table by base id. Absent ids count 0.
export function generalValueIn(tables: PickTables, generalId: string): number {
  if (tables.kingdomWars && generalId.startsWith(KINGDOM_WARS_PREFIX)) return tables.kingdomWars.values[generalId] ?? 0;
  return tables.identity[baseGeneralId(generalId)] ?? 0;
}

// Rule R5: value(main) + value(deputy) + the pair's bonus (Kingdom Wars pairs only) + the max HP tiebreak.
export function pairScore(tables: Readonly<Record<string, number>> | PickTables, registry: ContentRegistry, choice: Choice): number {
  const t = pickTablesOf(tables);
  const hp = (id: string) => registry.generals.get(id)?.maxHp ?? 0;
  const bothKw = choice.mainId.startsWith(KINGDOM_WARS_PREFIX) && choice.deputyId.startsWith(KINGDOM_WARS_PREFIX);
  const bonus = t.kingdomWars && bothKw ? (t.kingdomWars.pairBonuses[pairKey(choice.mainId, choice.deputyId)] ?? 0) : 0;
  return generalValueIn(t, choice.mainId) + generalValueIn(t, choice.deputyId) + bonus + HP_TIEBREAK * (hp(choice.mainId) + hp(choice.deputyId));
}

// The highest-scoring choice; the first one on a tie.
export function bestPair(tables: Readonly<Record<string, number>> | PickTables, registry: ContentRegistry, choices: Choice[]): Choice {
  const t = pickTablesOf(tables);
  return choices.reduce((best, c) => (pairScore(t, registry, c) > pairScore(t, registry, best) ? c : best));
}
