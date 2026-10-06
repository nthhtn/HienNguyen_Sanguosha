import { advanceToDecision, resolve } from './resolve';
import { applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, Phase, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { skipFlagOf } from '../rules/phaseSequence';
import { usedCardOf } from '../domain/usedCard';
import { EngineEvent } from './events';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// A fixture delayed Tool: goes on another seat; anything but a heart skips that seat's Play phase.
const omen: CardDefinition = {
  id: 'omen', name: 'Omen', category: 'tool', delayed: true,
  legalPlayTargets: (state, ctx) => state.seats.filter((s) => s.id !== ctx.seatId).map((s) => [{ kind: 'seat', seatId: s.id }]),
  play: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.targets[0].seatId}:judgment` }],
  onJudged: (_state, ctx) => (ctx.judged.suit === 'heart' ? [] : [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Play') }]),
};
// A fixture delayed Tool with its own cleanup: it goes back to its owner's hand.
const beacon: CardDefinition = {
  id: 'beacon', name: 'Beacon', category: 'tool', delayed: true,
  play: () => [],
  onCleanup: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.tool.physical[0].instanceId, toZoneId: `${ctx.ownerSeatId}:hand` }],
};
const registry: ContentRegistry = { cards: new Map([[omen.id, omen], [beacon.id, beacon]]), generals: new Map() };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'x', suit: CardInstance['suit'] = 'spade', rank = 5): CardInstance => ({ instanceId, definitionId, suit, rank });

interface TableOptions {
  phase?: Phase;
  flags?: Record<string, boolean>;
  queue?: QueueItem[];
  // Cards by zone id, e.g. { drawPile: [...], 'seat-a:judgment': [...] }.
  cards?: Record<string, CardInstance[]>;
}

// Seats a (turn owner) and b at 4 HP, each with a hand, equipment and judgment zone.
function table(o: TableOptions = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  const cardsOf = (id: string) => o.cards?.[id] ?? [];
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cardsOf('drawPile') },
      { id: 'discardPile', kind: 'discardPile', cards: cardsOf('discardPile') },
      { id: 'processing', kind: 'processing', cards: [] },
      ...['seat-a', 'seat-b'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cardsOf(`${id}:hand`) },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: cardsOf(`${id}:judgment`) },
      ]),
    ],
    pendingResponse: null,
    ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

// Drains the queue and moves on to the next decision.
const settle = (s: GameState) => advanceToDecision(s, ctx).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
const phasesOf = (log: EngineEvent[]) =>
  log.flatMap((e) => (e.kind === 'PhaseChangedEvent' ? [`${e.seatId}:${e.phase}`] : e.kind === 'TurnAdvancedEvent' ? [`turn ${e.turnNumber}`] : []));

describe('turn flags', () => {
  it('SetTurnFlagEffect with value false clears a flag, and leaves no empty flags behind', () => {
    const set = applyEffect(table({ flags: { wine: true, skipPlay: true } }), { kind: 'SetTurnFlagEffect', flag: 'wine', value: false }).state;
    expect(set.turn.flags).toEqual({ skipPlay: true });
    const cleared = applyEffect(table({ flags: { wine: true } }), { kind: 'SetTurnFlagEffect', flag: 'wine', value: false }).state;
    expect(cleared.turn).not.toHaveProperty('flags');
    expect(applyEffect(table(), { kind: 'SetTurnFlagEffect', flag: 'wine', value: false }).state.turn).not.toHaveProperty('flags');
  });

  it('SetTurnFlagEffect sets a flag for the rest of the turn', () => {
    expect(applyEffect(table(), { kind: 'SetTurnFlagEffect', flag: 'skipPlay' }).state.turn.flags).toEqual({ skipPlay: true });
  });

  it('a phase flagged to skip is logged as skipped and never entered', () => {
    const next = settle(table({ phase: 'Judgment', flags: { skipDraw: true, skipPlay: true } }));
    expect(next.log.filter((e) => e.kind === 'PhaseSkippedEvent')).toEqual([
      { kind: 'PhaseSkippedEvent', seatId: 'seat-a', phase: 'Draw' },
      { kind: 'PhaseSkippedEvent', seatId: 'seat-a', phase: 'Play' },
    ]);
    expect(phasesOf(next.log)).toEqual(['seat-a:Discard', 'seat-a:End', 'turn 2', 'seat-b:Start', 'seat-b:Judgment', 'seat-b:Draw', 'seat-b:Play']);
    expect(next.turn.flags).toBeUndefined();
  });
});

describe('delayed cards', () => {
  it('a delayed card leaves the hand for where play() puts it, not the discard pile', () => {
    const next = resolve(
      table({ cards: { 'seat-a:hand': [card('o1', 'omen')] } }),
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'o1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      ctx
    ).state;
    expect(idsIn(next, 'seat-b:judgment')).toEqual(['o1']);
    expect(idsIn(next, 'discardPile')).toEqual([]);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent']);
  });
});

describe('JudgeEffect', () => {
  const tool = usedCardOf(card('o1', 'omen'));
  const judge = { kind: 'JudgeEffect' as const, seatId: 'seat-a', tool };

  it('turns up the top card, logs it, lets the delayed Tool read it, then discards it', () => {
    const judged = card('j1', 'x', 'club', 3);
    const next = settle(table({ queue: [judge], cards: { drawPile: [judged, card('j2')] } }));
    expect(next.log).toEqual([
      { kind: 'JudgmentEvent', seatId: 'seat-a', tool, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j1', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ]);
    expect(next.turn.flags).toEqual({ skipPlay: true });
    expect(idsIn(next, 'processing')).toEqual([]);
    expect(idsIn(next, 'drawPile')).toEqual(['j2']);
  });

  it('a card the delayed Tool reads as harmless does nothing', () => {
    const next = settle(table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'heart', 3)] } }));
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['j1']);
  });

  it('shuffles the discard pile in when the draw pile is empty', () => {
    const next = settle(table({ queue: [judge], cards: { discardPile: [card('j1')] } }));
    expect(next.log.map((e) => e.kind)).toEqual(['DiscardPileReshuffledEvent', 'JudgmentEvent', 'CardMovedEvent']);
    expect(next.log[1]).toMatchObject({ kind: 'JudgmentEvent', card: { instanceId: 'j1' } });
  });

  it('with no card left anywhere, judges nothing and reads nothing (Review Focus 2)', () => {
    const next = settle(table({ queue: [judge, { kind: 'DelayedCleanupEffect', tool, ownerSeatId: 'seat-a' }], cards: { 'seat-a:judgment': [card('o1', 'omen')] } }));
    expect(next.log.map((e) => e.kind)).toEqual(['CardMovedEvent']); // only the cleanup's discard
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['o1']);
    expect(next.resolutionQueue).toBeUndefined();
  });

  it('survives a JSON round trip while queued', () => {
    const queued = table({ queue: [judge], cards: { drawPile: [card('j1')] } });
    expect(settle(JSON.parse(JSON.stringify(queued)))).toEqual(settle(queued));
  });
});

describe('DelayedCleanupEffect', () => {
  it('discards a delayed Tool still in its owner’s judgment area', () => {
    const o1 = card('o1', 'omen');
    const next = settle(table({ queue: [{ kind: 'DelayedCleanupEffect', tool: usedCardOf(o1), ownerSeatId: 'seat-a' }], cards: { 'seat-a:judgment': [o1] } }));
    expect(idsIn(next, 'seat-a:judgment')).toEqual([]);
    expect(idsIn(next, 'discardPile')).toEqual(['o1']);
  });

  it('leaves alone a delayed Tool that has already left the judgment area', () => {
    const o1 = card('o1', 'omen');
    const next = settle(table({ queue: [{ kind: 'DelayedCleanupEffect', tool: usedCardOf(o1), ownerSeatId: 'seat-a' }], cards: { 'seat-b:hand': [o1] } }));
    expect(idsIn(next, 'seat-b:hand')).toEqual(['o1']);
    expect(next.log).toEqual([]);
  });

  it('runs the card’s own onCleanup instead when it has one', () => {
    const b1 = card('b1', 'beacon');
    const next = settle(table({ queue: [{ kind: 'DelayedCleanupEffect', tool: usedCardOf(b1), ownerSeatId: 'seat-a' }], cards: { 'seat-a:judgment': [b1] } }));
    expect(idsIn(next, 'seat-a:hand')).toEqual(['b1']);
  });
});
