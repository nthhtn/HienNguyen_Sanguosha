import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupGeneral } from '../registry/lookup';
import { Action } from '../pipeline/actions';
import { GeneralsChosenEvent } from '../pipeline/events';
import { getActingSeatIds } from './activeSeat';
import { combinedMaxHp } from '../domain/factories';

export type ChooseGeneralsAction = Extract<Action, { kind: 'ChooseGeneralsAction' }>;

// Every ordered (main, deputy) pair of distinct candidates that share a
// kingdom, main-major in the seat's candidate order.
export function getLegalGeneralChoices(
  state: GameState,
  seatId: string,
  registry: ContentRegistry
): ChooseGeneralsAction[] {
  const candidates = state.generalSelection?.candidates[seatId] ?? [];
  const choices: ChooseGeneralsAction[] = [];
  for (const mainId of candidates) {
    for (const deputyId of candidates) {
      if (mainId === deputyId) continue;
      if (lookupGeneral(registry, mainId).kingdom === lookupGeneral(registry, deputyId).kingdom) {
        choices.push({ kind: 'ChooseGeneralsAction', seatId, mainId, deputyId });
      }
    }
  }
  return choices;
}

export function applyGeneralChoice(
  state: GameState,
  action: ChooseGeneralsAction,
  registry: ContentRegistry
): { state: GameState; event: GeneralsChosenEvent } {
  const selection = state.generalSelection;
  if (state.phase !== 'GeneralSelection' || !selection) {
    throw new Error('Generals can only be chosen during the GeneralSelection phase');
  }
  if (!getActingSeatIds(state).includes(action.seatId)) {
    throw new Error(`It is not seat ${action.seatId}'s turn to choose generals`);
  }
  const candidates = selection.candidates[action.seatId];
  for (const id of [action.mainId, action.deputyId]) {
    if (!candidates.includes(id)) throw new Error(`General ${id} is not a candidate for seat ${action.seatId}`);
  }
  if (action.mainId === action.deputyId) {
    throw new Error('Main and deputy must be different generals');
  }
  const main = lookupGeneral(registry, action.mainId);
  const deputy = lookupGeneral(registry, action.deputyId);
  if (main.kingdom !== deputy.kingdom) {
    throw new Error(`${main.id} (${main.kingdom}) and ${deputy.id} (${deputy.kingdom}) do not share a kingdom`);
  }

  const maxCombinedHp = combinedMaxHp(main.maxHp, deputy.maxHp);
  const seats = state.seats.map((s) =>
    s.id === action.seatId
      ? {
          ...s,
          kingdom: main.kingdom,
          generals: {
            main: { generalDefinitionId: main.id, revealed: false },
            deputy: { generalDefinitionId: deputy.id, revealed: false },
          },
          combinedHp: maxCombinedHp,
          maxCombinedHp,
        }
      : s
  );
  const remaining = Object.fromEntries(
    Object.entries(selection.candidates).filter(([seatId]) => seatId !== action.seatId)
  );
  const finished = Object.keys(remaining).length === 0;
  const event: GeneralsChosenEvent = { kind: 'GeneralsChosenEvent', seatId: action.seatId };
  return {
    state: {
      ...state,
      seats,
      phase: finished ? 'Start' : 'GeneralSelection',
      generalSelection: finished ? null : { candidates: remaining },
      log: [...state.log, event],
    },
    event,
  };
}
