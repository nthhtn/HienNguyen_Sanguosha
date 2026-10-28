import { advanceToDecision, getLegalActions, resolve, sameValue } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, Kingdom, Phase, QueueItem, Target } from 'engine';
import { buildContentRegistry } from '../registry';
import { withFillers } from './fillers.testing';
import { guozhanMode } from '../modes/guozhan';

// Shared by the skill specs (not exported from the package).

// The real cards and Generals.
export const registry = withFillers(buildContentRegistry());
// A mode with no triggers of its own: only the skills under test act.
export const stubMode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// Guozhan's own triggers (Draw Phase draw, Judgment Phase, dying, elimination), never ending the game.
export const kwMode: GameModeDefinition = { ...guozhanMode, checkWinCondition: () => null };

export const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
export const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

export interface TableOptions {
  // A seat's [Main, Deputy, revealed?]. Default: Xu Huang and Dong Zhuo (male, no skills), revealed.
  generals?: Record<string, [string, string, boolean?]>;
  kingdoms?: Record<string, Kingdom>;
  hp?: Record<string, number>;
  maxHp?: Record<string, number>;
  phase?: Phase;
  // The turn owner; default seat-a.
  owner?: string;
  flags?: Record<string, boolean>;
  ownerUses?: Record<string, number>;
  // How many seats: 4 by default (seat-a … seat-d), at most 6.
  seats?: number;
}

const SEAT_IDS = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
const KINGDOMS: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun', 'Wei', 'Shu'];

// Seats round the table at 4/4 HP, in seat-a's Play Phase unless told
// otherwise. `cards` fills zones by id ('drawPile': top first; 'seat-b:judgment').
export function table(cards: Record<string, CardInstance[]> = {}, o: TableOptions = {}): GameState {
  const ids = SEAT_IDS.slice(0, o.seats ?? 4);
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['filler-xu-huang', 'filler-dong-zhuo'];
      return {
        id, index, kingdom: o.kingdoms?.[id] ?? KINGDOMS[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: o.maxHp?.[id] ?? 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, pile: { zoneId: `${id}:pile` }, stash: { zoneId: `${id}:stash` },
      };
    }),
    players: [],
    turn: {
      turnNumber: 1, ownerSeatId: o.owner ?? 'seat-a', extraTurnStack: [],
      ...(o.flags ? { flags: o.flags } : {}), ...(o.ownerUses ? { ownerUses: o.ownerUses } : {}),
    },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: cards['discardPile'] ?? [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: cards[`${id}:judgment`] ?? [] },
        { id: `${id}:pile`, kind: 'pile' as const, ownerSeatId: id, cards: cards[`${id}:pile`] ?? [] },
        { id: `${id}:stash`, kind: 'pile' as const, ownerSeatId: id, cards: cards[`${id}:stash`] ?? [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

// The actions a spec drives the engine with, under `mode`.
export function harness(mode: GameModeDefinition = stubMode) {
  const ctx = { registry, mode };
  const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
  const legal = (s: GameState, seatId: string) => getLegalActions(s, seatId, registry);
  return {
    ctx,
    act,
    legal,
    play: (s: GameState, cardInstanceId: string, ...targets: string[]) =>
      act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) }),
    pass: (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }),
    respond: (s: GameState, cardInstanceId: string) =>
      act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }),
    choose: (s: GameState, optionId: string) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId }),
    use: (s: GameState) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId: 'use' }),
    decline: (s: GameState) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId: 'decline' }),
    select: (s: GameState, ...ids: string[]) => act(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids }),
    cancel: (s: GameState) => act(s, { kind: 'CancelSelectionAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id }),
    // Queue `queue` and resolve until a decision.
    run: (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state,
    settle: (s: GameState) => advanceToDecision(s, ctx).state,
    // The seat's offered UseSkillAction for `skillId`, submitted.
    useSkill: (s: GameState, seatId: string, skillId: string) => {
      const action = legal(s, seatId).find((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);
      if (!action) throw new Error(`${seatId} is not offered ${skillId}`);
      return act(s, action);
    },
    // The seat's offered UseConversionAction for `conversionId` (at `targets`, or answering the open window).
    convert: (s: GameState, seatId: string, conversionId: string, ...targets: string[]) => {
      const action = legal(s, seatId).find(
        (a) => a.kind === 'UseConversionAction' && a.via.conversionId === conversionId && sameValue(a.targets, targets.map(seat))
      );
      if (!action) throw new Error(`${seatId} is not offered ${conversionId}`);
      return act(s, action);
    },
    arrange: (s: GameState, top: string[], bottom: string[]) =>
      act(s, { kind: 'ArrangeCardsAction', seatId: s.pendingArrangement!.seatId, arrangementId: s.pendingArrangement!.id, top, bottom }),
  };
}

export const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
export const ids = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
export const handIds = (s: GameState, seatId: string) => ids(s, `${seatId}:hand`);
// The ability a pending ask or selection is about, if any.
export const askedAbout = (s: GameState) => {
  const reason = s.pendingChoice?.reason ?? s.pendingSelection?.reason ?? s.pendingArrangement?.reason;
  return reason?.kind === 'ability' ? reason.abilityId : null;
};
export const abilityLog = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');
