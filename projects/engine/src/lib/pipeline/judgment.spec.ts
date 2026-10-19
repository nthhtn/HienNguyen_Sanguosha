import { advanceToDecision, resolve } from './resolve';
import { Effect, applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner, Judgment, Phase, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
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
  // Generals face up: a hidden General's optional before-trigger must ask.
  revealed?: boolean;
}

// Seats a (turn owner) and b at 4 HP, each with a hand, equipment and judgment zone.
function table(o: TableOptions = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: !!o.revealed }, deputy: { generalDefinitionId: 'g2', revealed: !!o.revealed } },
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
      { id: 'processing', kind: 'processing', cards: cardsOf('processing') },
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

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;
type Done = Extract<Effect, { kind: 'JudgmentDoneEffect' }>;

// A registry whose seat-a Main General ('g1') has the given skills.
function ctxWith(skills: SkillDefinition[], cards: CardDefinition[] = []) {
  return {
    registry: { cards: new Map([...registry.cards, ...cards.map((c): [string, CardDefinition] => [c.id, c])]), generals: new Map([['g1', { id: 'g1', kingdom: 'Wei' as const, maxHp: 4, skills }]]) },
    mode,
  };
}
const settleWith = (s: GameState, c: ReturnType<typeof ctxWith>) => advanceToDecision(s, c).state;
const owner = (skillId: string): GeneralOwner => ({ kind: 'general', seatId: 'seat-a', slot: 'main', skillId });

describe('judgment steps', () => {
  const tool = usedCardOf(card('o1', 'omen'));
  const reader = { kind: 'card' as const, card: tool };
  const judge: Effect = { kind: 'JudgeEffect', seatId: 'seat-a', reader };

  it('turns up the top card, logs it, lets the reader read it, then discards it', () => {
    const judged = card('j1', 'x', 'club', 3);
    const next = settle(table({ queue: [judge], cards: { drawPile: [judged, card('j2')] } }));
    expect(next.log).toEqual([
      { kind: 'JudgmentEvent', seatId: 'seat-a', reader, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j1', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ]);
    expect(next.turn.flags).toEqual({ skipPlay: true });
    expect(idsIn(next, 'processing')).toEqual([]);
    expect(idsIn(next, 'drawPile')).toEqual(['j2']);
  });

  it('a card the reader reads as harmless does nothing', () => {
    const next = settle(table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'heart', 3)] } }));
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['j1']);
  });

  it('shuffles the discard pile in when the draw pile is empty', () => {
    const next = settle(table({ queue: [judge], cards: { discardPile: [card('j1')] } }));
    expect(next.log.map((e) => e.kind)).toEqual(['DiscardPileReshuffledEvent', 'JudgmentEvent', 'CardMovedEvent']);
  });

  it('with no card left anywhere, judges nothing and goes on with `otherwise` (stage 5 follow-up)', () => {
    const next = settle(table({ queue: [{ ...judge, otherwise: [{ kind: 'SetTurnFlagEffect', flag: 'nothingJudged' }] }] }));
    expect(next.log).toEqual([]);
    expect(next.turn.flags).toEqual({ nothingJudged: true });
  });

  it('a skill can read a judgment: its onJudged gets its owner, the card and the data', () => {
    const seen: unknown[] = [];
    const seer: SkillDefinition = { id: 'seer', onJudged: (_s, ctx) => { seen.push([ctx.owner, ctx.seatId, ctx.judged.instanceId, ctx.data]); return [{ kind: 'SetTurnFlagEffect', flag: 'read' }]; } };
    const skillReader = { kind: 'skill' as const, owner: owner('seer') };
    const next = settleWith(table({ queue: [{ kind: 'JudgeEffect', seatId: 'seat-a', reader: skillReader, data: { x: 1 } }], cards: { drawPile: [card('j1')] } }), ctxWith([seer]));
    expect(seen).toEqual([[owner('seer'), 'seat-a', 'j1', { x: 1 }]]);
    expect(next.turn.flags).toEqual({ read: true });
    expect(next.log[0]).toMatchObject({ kind: 'JudgmentEvent', reader: skillReader });
    expect(idsIn(next, 'discardPile')).toEqual(['j1']);
  });

  it('a reader may place the Done step itself, ahead of what it does', () => {
    const early: CardDefinition = { id: 'early', name: 'Early', category: 'basic', play: () => [], onJudged: (_s, { done }) => [done, { kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 }] };
    const next = settleWith(
      table({ queue: [{ kind: 'JudgeEffect', seatId: 'seat-a', reader: { kind: 'card', card: usedCardOf(card('e1', 'early')) } }], cards: { drawPile: [card('j1'), card('j2')] } }),
      ctxWith([], [early])
    );
    expect(next.log.map((e) => e.kind)).toEqual(['JudgmentEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
  });

  it('a changer at the Shown step replaces the card and is asked again; replaced twice (Review Focus 3)', () => {
    // While seat-a holds a card, it swaps the first one in.
    const changer: SkillDefinition = {
      id: 'changer',
      triggers: [{
        point: 'before:JudgmentShownEffect',
        condition: (state) => idsIn(state, 'seat-a:hand').length > 0,
        effect: (state, subject, o) => [{ kind: 'ReplaceJudgmentEffect', judgment: (subject as Shown).judgment, withCardInstanceId: idsIn(state, 'seat-a:hand')[0], owner: o!, abilityId: 'changer' }],
      }],
    };
    const next = settleWith(
      table({ queue: [judge], revealed: true, cards: { drawPile: [card('j1', 'x', 'club', 3)], 'seat-a:hand': [card('r1', 'x', 'spade', 4), card('r2', 'x', 'heart', 5)] } }),
      ctxWith([changer])
    );
    expect(next.log.filter((e) => e.kind === 'JudgmentChangedEvent')).toEqual([
      { kind: 'JudgmentChangedEvent', owner: owner('changer'), abilityId: 'changer', judgedSeatId: 'seat-a', card: card('r1', 'x', 'spade', 4), replaced: card('j1', 'x', 'club', 3) },
      { kind: 'JudgmentChangedEvent', owner: owner('changer'), abilityId: 'changer', judgedSeatId: 'seat-a', card: card('r2', 'x', 'heart', 5), replaced: card('r1', 'x', 'spade', 4) },
    ]);
    // Omen reads the last card, a heart: harmless.
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['j1', 'r1', 'r2']);
    expect(idsIn(next, 'processing')).toEqual([]);
  });

  it('a replace-judgment selection swaps in the picked card, and the Shown step says who changed it', () => {
    const picker: SkillDefinition = {
      id: 'picker',
      triggers: [{
        point: 'before:JudgmentShownEffect',
        condition: (_s, subject) => !(subject as Shown).changedBy,
        effect: (state, subject, o) => [{
          kind: 'OpenSelectionEffect',
          selection: {
            id: 'pick-1', seatId: 'seat-a', reason: { kind: 'ability', owner: o!, abilityId: 'picker' }, of: 'cards', eligibleIds: idsIn(state, 'seat-a:hand'), min: 1, max: 1,
            then: { kind: 'replace-judgment', judgment: (subject as Shown).judgment, owner: o!, abilityId: 'picker' },
          },
        }],
      }],
    };
    const c = ctxWith([picker]);
    const opened = settleWith(table({ queue: [judge], revealed: true, cards: { drawPile: [card('j1', 'x', 'club', 3)], 'seat-a:hand': [card('r1', 'x', 'heart', 4)] } }), c);
    expect(opened.pendingSelection).toMatchObject({ id: 'pick-1' });
    const next = resolve(opened, { kind: 'SelectAction', seatId: 'seat-a', selectionId: 'pick-1', ids: ['r1'] }, c).state;
    expect(next.turn.flags).toBeUndefined(); // a heart now
    expect(idsIn(next, 'discardPile')).toEqual(['j1', 'r1']);
  });

  it('a taker at the Done step takes the card instead of the discard pile', () => {
    const taker: SkillDefinition = {
      id: 'taker',
      triggers: [{
        point: 'before:JudgmentDoneEffect',
        condition: (_s, subject) => !(subject as Done).acted?.includes('taker'),
        effect: (_s, subject) => {
          const done = subject as Done;
          return [{ kind: 'MoveCardEffect', cardInstanceId: done.judgment.card.instanceId, toZoneId: 'seat-a:hand' }, { ...done, acted: ['taker'] }];
        },
      }],
    };
    const next = settleWith(table({ queue: [judge], revealed: true, cards: { drawPile: [card('j1', 'x', 'club', 3)] } }), ctxWith([taker]));
    expect(next.turn.flags).toEqual({ skipPlay: true }); // read first, then taken
    expect(idsIn(next, 'seat-a:hand')).toEqual(['j1']);
    expect(idsIn(next, 'discardPile')).toEqual([]);
  });

  it('survives a JSON round trip while queued, and mid-way', () => {
    const queued = table({ queue: [judge], cards: { drawPile: [card('j1')] } });
    expect(settle(JSON.parse(JSON.stringify(queued)))).toEqual(settle(queued));
    const judgment: Judgment = { seatId: 'seat-a', reader, card: card('j1') };
    const midway = table({ queue: [{ kind: 'JudgmentResolveEffect', judgment }], cards: { processing: [card('j1')] } });
    expect(settle(JSON.parse(JSON.stringify(midway)))).toEqual(settle(midway));
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
