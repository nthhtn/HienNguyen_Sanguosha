import { baseGeneralId } from 'content';
import type { Action, ContentRegistry } from 'engine';

type Choice = Extract<Action, { kind: 'ChooseGeneralsAction' }>;

// Max HP only breaks ties between pairs the table rates equally.
export const HP_TIEBREAK = 0.0001;

// The table is generated into its own file so regenerating it never touches this code.
export { GENERAL_VALUES } from './general-values.data';

export function pairScore(values: Readonly<Record<string, number>>, registry: ContentRegistry, choice: Choice): number {
  const hp = (id: string) => registry.generals.get(id)?.maxHp ?? 0;
  return (values[baseGeneralId(choice.mainId)] ?? 0) + (values[baseGeneralId(choice.deputyId)] ?? 0) + HP_TIEBREAK * (hp(choice.mainId) + hp(choice.deputyId));
}

// The highest-scoring choice; the first one on a tie.
export function bestPair(values: Readonly<Record<string, number>>, registry: ContentRegistry, choices: Choice[]): Choice {
  return choices.reduce((best, c) => (pairScore(values, registry, c) > pairScore(values, registry, best) ? c : best));
}
