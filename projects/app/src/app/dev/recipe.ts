import {
  Action,
  ContentRegistry,
  GameState,
  Phase,
  combinedMaxHp,
  createGame,
  getActiveSeatId,
  getLegalActions,
  moveCard,
  redactStateForSeat,
  resolve,
} from 'engine';
import { BotTurnMemory, ruleBasedPolicy } from 'bots';
import { botNameDisplay, drawBotNameIds, guozhanMode } from 'content';
import { botName } from 'protocol';

// Recipe helpers for dev scenarios: pure functions over a GameState that set up a situation. They edit state
// directly where the engine has no move for it, then let the engine run (see the dev scenarios design).

export function playableGame(registry: ContentRegistry, seed: number, seatCount: number): GameState {
  const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
  const created = createGame(guozhanMode, registry, seatIds, seed, { judgmentNotice: true, logPasses: true });
  const names = drawBotNameIds(seatCount - 1, [], () => 0.5);
  const players = created.players.map((p) =>
    p.seatId === 'seat-0'
      ? { ...p, kind: 'human' as const }
      : { ...p, kind: 'bot' as const, name: botName(botNameDisplay(names.shift()!, 'en')!) }
  );
  let state: GameState = { ...created, players };
  while (state.phase === 'GeneralSelection') state = takeMove(state, registry, new Map());
  return state;
}

type Memories = Map<string, BotTurnMemory>;

function takeMove(state: GameState, registry: ContentRegistry, memories: Memories): GameState {
  const seatId = getActiveSeatId(state);
  if (!seatId) throw new Error('No seat is due to act');
  const legal = getLegalActions(state, seatId, registry);
  const decision = ruleBasedPolicy.decide(redactStateForSeat(state, seatId), seatId, legal, registry, memories.get(seatId) ?? null);
  memories.set(seatId, decision.memory);
  return act(state, registry, decision.action);
}

export function act(state: GameState, registry: ContentRegistry, action: Action): GameState {
  return resolve(state, action, { registry, mode: guozhanMode }).state;
}

// Plays the active seat's rule-based moves until `done` holds.
export function stepUntil(state: GameState, registry: ContentRegistry, done: (s: GameState) => boolean, maxSteps = 200): GameState {
  const memories: Memories = new Map();
  let current = state;
  for (let i = 0; i < maxSteps; i++) {
    if (done(current)) return current;
    if (current.result) break;
    current = takeMove(current, registry, memories);
  }
  if (done(current)) return current;
  throw new Error('stepUntil: window not reached');
}

// Moves the first card of `definitionId` found outside `toZoneId` into it.
function moveByDefinition(state: GameState, definitionId: string, toZoneId: string): GameState {
  const card = state.zones
    .filter((z) => z.id !== toZoneId)
    .sort((a, b) => Number(b.kind === 'drawPile') - Number(a.kind === 'drawPile'))
    .flatMap((z) => z.cards)
    .find((c) => c.definitionId === definitionId);
  if (!card) throw new Error(`No ${definitionId} card to move`);
  return { ...state, zones: moveCard(state.zones, card.instanceId, toZoneId) };
}

const seatOf = (state: GameState, seatId: string) => {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`No seat ${seatId}`);
  return seat;
};

export function give(state: GameState, seatId: string, definitionIds: string[]): GameState {
  const zoneId = seatOf(state, seatId).hand.zoneId;
  return definitionIds.reduce((s, id) => moveByDefinition(s, id, zoneId), state);
}

// Moves every card in the seat's hand to the discard pile, so the seat holds nothing that could answer a window.
export function emptyHand(state: GameState, seatId: string): GameState {
  const hand = state.zones.find((z) => z.id === seatOf(state, seatId).hand.zoneId);
  const discard = state.zones.find((z) => z.kind === 'discardPile');
  if (!discard) throw new Error('No discard pile');
  return { ...state, zones: (hand?.cards ?? []).reduce((zones, c) => moveCard(zones, c.instanceId, discard.id), state.zones) };
}

// `seatId` plays the `definitionId` card from its hand at the seats `targetSeatIds`, as a real PlayCardAction.
export function playCard(state: GameState, registry: ContentRegistry, seatId: string, definitionId: string, targetSeatIds: string[] = []): GameState {
  const hand = state.zones.find((z) => z.id === seatOf(state, seatId).hand.zoneId);
  const card = hand?.cards.find((c) => c.definitionId === definitionId);
  if (!card) throw new Error(`${seatId} holds no ${definitionId}`);
  return act(state, registry, {
    kind: 'PlayCardAction',
    seatId,
    cardInstanceId: card.instanceId,
    targets: targetSeatIds.map((id) => ({ kind: 'seat' as const, seatId: id })),
  });
}

export function equip(state: GameState, seatId: string, definitionId: string): GameState {
  return moveByDefinition(state, definitionId, seatOf(state, seatId).equipped.zoneId);
}

export function placeJudgment(state: GameState, seatId: string, definitionId: string): GameState {
  return moveByDefinition(state, definitionId, seatOf(state, seatId).judgment.zoneId);
}

// The seat holds exactly these two Generals, both face down, at full HP, in the main General's Kingdom.
export function setGenerals(state: GameState, registry: ContentRegistry, seatId: string, mainId: string, deputyId: string): GameState {
  const main = registry.generals.get(mainId);
  const deputy = registry.generals.get(deputyId);
  if (!main || !deputy) throw new Error(`Unknown General ${main ? deputyId : mainId}`);
  const maxHp = combinedMaxHp(main.maxHp, deputy.maxHp);
  return {
    ...state,
    seats: state.seats.map((s) =>
      s.id === seatId
        ? {
            ...s,
            kingdom: main.kingdom,
            generals: { main: { generalDefinitionId: mainId, revealed: false }, deputy: { generalDefinitionId: deputyId, revealed: false } },
            maxCombinedHp: maxHp,
            combinedHp: maxHp,
          }
        : s
    ),
  };
}

export function setHp(state: GameState, seatId: string, hp: number): GameState {
  return { ...state, seats: state.seats.map((s) => (s.id === seatId ? { ...s, combinedHp: hp } : s)) };
}

// The seat's turn, in `phase`, with nothing pending.
export function setTurn(state: GameState, seatId: string, phase: Phase): GameState {
  seatOf(state, seatId);
  const {
    resolutionQueue: _queue,
    pendingChoice: _choice,
    pendingSelection: _selection,
    pendingArrangement: _arrangement,
    judgmentView: _judgment,
    ...rest
  } = state;
  return { ...rest, phase, pendingResponse: null, turn: { ...state.turn, ownerSeatId: seatId } };
}

export type WindowKind = 'response' | 'choice' | 'selection' | 'arrangement' | 'judgment';

export function windowOf(state: GameState): WindowKind | null {
  if (state.pendingResponse) return 'response';
  if (state.pendingChoice) return 'choice';
  if (state.pendingSelection) return 'selection';
  if (state.pendingArrangement) return 'arrangement';
  if (state.judgmentView) return 'judgment';
  return null;
}
