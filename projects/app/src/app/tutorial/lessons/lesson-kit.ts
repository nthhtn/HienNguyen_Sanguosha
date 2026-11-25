import { Action, GameState } from 'engine';

// Small readers and scripted-bot pickers the lessons share. A picker only chooses among the legal actions it is given.

export function handOf(state: GameState, seatId: string): string[] {
  return state.zones.find((z) => z.id === `${seatId}:hand`)?.cards.map((c) => c.definitionId) ?? [];
}

// The card definition behind an instance id, wherever the card is.
export function definitionOf(state: GameState, instanceId: string): string | undefined {
  for (const zone of state.zones) {
    const card = zone.cards.find((c) => c.instanceId === instanceId);
    if (card) return card.definitionId;
  }
  return undefined;
}

// A bot's scripted pick: the legal play of a `definitionId` card on `targetSeatId`.
export function playOn(definitionId: string, targetSeatId: string): (legal: Action[], state: GameState) => Action | undefined {
  return (legal, state) =>
    legal.find(
      (a) => a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === definitionId && a.targets.length === 1 && a.targets[0].kind === 'seat' && a.targets[0].seatId === targetSeatId
    );
}

// A bot's scripted pick: answer with the `definitionId` card.
export function respondWith(definitionId: string): (legal: Action[], state: GameState) => Action | undefined {
  return (legal, state) => legal.find((a) => a.kind === 'RespondAction' && definitionOf(state, a.cardInstanceId) === definitionId);
}

// What a step lets the beginner do: answer a response window with the `definitionId` card.
export const isRespondWith =
  (definitionId: string) =>
  (action: Action, state: GameState): boolean =>
    action.kind === 'RespondAction' && definitionOf(state, action.cardInstanceId) === definitionId;

// A bot's scripted pick: pass on its response window (it holds nothing that could answer).
export const passes = (legal: Action[]): Action | undefined => legal.find((a) => a.kind === 'PassAction');
