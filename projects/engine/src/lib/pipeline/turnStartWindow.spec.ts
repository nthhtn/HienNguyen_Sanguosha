import { resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { isOfferedAction } from '../rules/offered';
import { phaseWaitsForPlayer, startWindowOpens } from '../rules/phaseSequence';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner, Player, Seat } from '../domain/types';
import { ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { Action } from './actions';
import { EngineEvent, PhaseChangedEvent } from './events';

// Rule (spec, Reveal conditions, rule 1): as a human's turn begins, while they
// hold a hidden General, the engine waits before the Start Phase's effects. The
// owner confirms which hidden Generals to reveal (none is allowed) in one
// ConfirmRevealsAction, which reveals them, then logs the Start event and gathers
// its triggers. Bots and seats with nothing hidden never wait.

// 'herald' holds 'omen': as its seat's Start Phase begins, it draws 1.
const omen: SkillDefinition = {
  id: 'omen',
  triggers: [{
    point: 'after:PhaseChangedEvent',
    condition: (_s, subject, owner) => {
      const e = subject as PhaseChangedEvent;
      return e.phase === 'Start' && e.seatId === (owner as GeneralOwner).seatId;
    },
    effect: (_s, subject) => [{ kind: 'DrawCardsEffect', seatId: (subject as PhaseChangedEvent).seatId, count: 1 }],
  }],
};
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['plain', { id: 'plain', kingdom: 'Wei', maxHp: 4, skills: [] }],
    ['herald', { id: 'herald', kingdom: 'Wei', maxHp: 4, skills: [omen] }],
  ]),
};
// Like Kingdom War: whoever enters Draw draws 2.
const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [{
    point: 'after:PhaseChangedEvent',
    condition: (_s, subject) => (subject as PhaseChangedEvent).phase === 'Draw',
    effect: (_s, subject) => [{ kind: 'DrawCardsEffect', seatId: (subject as PhaseChangedEvent).seatId, count: 2 }],
  }],
};
const ctx = { registry, mode };

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'spade', rank: 1 });

interface SeatOptions {
  kind?: Player['kind'];
  main?: { id: string; revealed: boolean };
  deputy?: { id: string; revealed: boolean };
  faceDown?: boolean;
  eliminated?: boolean;
}

// Seat a owns turn 1, resting at the End Phase; seat b (and c) follow.
// Seat b defaults to a human with both Generals hidden.
function table(b: SeatOptions = {}, c?: SeatOptions): GameState {
  const seat = (id: string, index: number, o: SeatOptions): Seat => ({
    id, index, kingdom: 'Wei', combinedHp: 4, maxCombinedHp: 4, eliminated: !!o.eliminated,
    ...(o.faceDown ? { faceDown: true } : {}),
    generals: {
      main: { generalDefinitionId: o.main?.id ?? 'plain', revealed: o.main?.revealed ?? false },
      deputy: { generalDefinitionId: o.deputy?.id ?? 'plain', revealed: o.deputy?.revealed ?? false },
    },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const a: SeatOptions = { kind: 'bot', main: { id: 'plain', revealed: true }, deputy: { id: 'plain', revealed: true } };
  const specs: [string, SeatOptions][] = [['a', a], ['b', { kind: 'human', ...b }], ...(c ? [['c', c] as [string, SeatOptions]] : [])];
  return {
    seats: specs.map(([id, o], i) => seat(id, i, o)),
    players: specs.map(([id, o]) => ({ id: `p-${id}`, seatId: id, kind: o.kind ?? 'bot', name: `Seat ${id}` })),
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Discard',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: Array.from({ length: 20 }, (_, i) => card(`d${i}`)) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...specs.flatMap(([id]) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

// Seat a's turn ends (it is resting in Discard, within its limit, so it passes End).
const endTurnOfA = (s: GameState) => resolve({ ...s, phase: 'Play' }, { kind: 'EndPhaseAction', seatId: 'a' }, ctx).state;
const confirm = (s: GameState, slots: Array<'main' | 'deputy'>, seatId = 'b') => resolve(s, { kind: 'ConfirmRevealsAction', seatId, slots }, ctx).state;
const continueAs = (s: GameState, seatId = 'b') => confirm(s, [], seatId);
const startsOf = (s: GameState, seatId: string) =>
  (s.log as EngineEvent[]).filter((e) => e.kind === 'PhaseChangedEvent' && e.phase === 'Start' && e.seatId === seatId);
const kindsOf = (s: GameState) => (s.log as EngineEvent[]).map((e) => e.kind);

describe('the Start window as a turn begins', () => {
  it('a human with a hidden General waits before the Start event', () => {
    const s = endTurnOfA(table());
    expect(s.turn.ownerSeatId).toBe('b');
    expect(s.phase).toBe('Start');
    expect(s.turn.startWindow).toBe(true);
    expect(startsOf(s, 'b')).toEqual([]);
    expect(kindsOf(s)[kindsOf(s).length - 1]).toBe('TurnAdvancedEvent');
    expect(phaseWaitsForPlayer(s)).toBe(true);
    const expected: Action[] = [{ kind: 'ConfirmRevealsAction', seatId: 'b', slots: [] }];
    expect(getLegalActions(s, 'b', registry)).toEqual(expected);
    expect(getLegalActions(s, 'a', registry)).toEqual([]);
  });

  it('continuing runs the Start effects and moves on', () => {
    const s = continueAs(endTurnOfA(table({ main: { id: 'herald', revealed: true } })));
    expect(s.turn.startWindow).toBeUndefined();
    expect(startsOf(s, 'b')).toHaveLength(1);
    expect(s.phase).toBe('Play');
    // omen drew 1 at Start, then the Draw Phase drew 2.
    expect(s.zones.find((z) => z.id === 'b:hand')!.cards).toHaveLength(3);
    const log = s.log as EngineEvent[];
    const phases = log.flatMap((e) => (e.kind === 'PhaseChangedEvent' && e.seatId === 'b' ? [e.phase] : []));
    expect(phases).toEqual(['Start', 'Judgment', 'Draw', 'Play']);
  });

  it('a General revealed in the window fires its Start trigger in that Start', () => {
    const waiting = endTurnOfA(table({ deputy: { id: 'herald', revealed: false } }));
    const s = confirm(waiting, ['deputy']);
    expect(s.seats[1].generals!.deputy.revealed).toBe(true);
    expect(s.seats[1].generals!.main.revealed).toBe(false);
    expect(s.turn.startWindow).toBeUndefined();
    const log = s.log as EngineEvent[];
    const revealAt = log.findIndex((e) => e.kind === 'GeneralRevealedEvent' && e.seatId === 'b');
    const startAt = log.findIndex((e) => e.kind === 'PhaseChangedEvent' && e.phase === 'Start' && e.seatId === 'b');
    expect(revealAt).toBeGreaterThan(-1);
    expect(revealAt).toBeLessThan(startAt);
    const singleDraws = log.filter((e) => e.kind === 'CardsDrawnEvent' && e.seatId === 'b' && e.cardInstanceIds.length === 1);
    expect(singleDraws).toHaveLength(1);
    expect(log.indexOf(singleDraws[0])).toBeGreaterThan(startAt);
    expect(log.filter((e) => e.kind === 'GeneralRevealedEvent' && e.seatId === 'b')).toHaveLength(1);
  });

  it('both Generals can be revealed in one window', () => {
    const s = confirm(endTurnOfA(table()), ['main', 'deputy']);
    expect(s.seats[1].generals!.main.revealed).toBe(true);
    expect(s.seats[1].generals!.deputy.revealed).toBe(true);
    expect(s.phase).toBe('Play');
    expect(s.turn.startWindow).toBeUndefined();
  });

  it('confirming with nothing picked reveals nothing and starts the turn', () => {
    const s = continueAs(endTurnOfA(table()));
    expect(s.seats[1].generals!.main.revealed).toBe(false);
    expect(s.seats[1].generals!.deputy.revealed).toBe(false);
    expect(startsOf(s, 'b')).toHaveLength(1);
    expect(s.phase).toBe('Play');
  });

  it('rejects a slot that is already revealed, repeated, or outside the window', () => {
    const waiting = endTurnOfA(table({ main: { id: 'plain', revealed: true } }));
    expect(() => confirm(waiting, ['main'])).toThrow(/cannot reveal/);
    const both = endTurnOfA(table());
    expect(() => confirm(both, ['deputy', 'deputy'])).toThrow(/cannot reveal/);
    expect(() => confirm(endTurnOfA(table({ kind: 'bot' })), ['main'])).toThrow(/Start window/);
  });

  it('offers only the slots still hidden through the template, with slots free', () => {
    const waiting = endTurnOfA(table());
    expect(isOfferedAction({ kind: 'ConfirmRevealsAction', seatId: 'b', slots: ['main', 'deputy'] }, getLegalActions(waiting, 'b', registry))).toBe(true);
    expect(isOfferedAction({ kind: 'EndPhaseAction', seatId: 'b' }, getLegalActions(waiting, 'b', registry))).toBe(false);
  });

  it('a bot seat never waits', () => {
    const s = endTurnOfA(table({ kind: 'bot' }));
    expect(s.turn.ownerSeatId).toBe('b');
    expect(s.phase).toBe('Play');
    expect(s.turn.startWindow).toBeUndefined();
    expect(startsOf(s, 'b')).toHaveLength(1);
  });

  it('a seat with both Generals revealed never waits', () => {
    const s = endTurnOfA(table({ main: { id: 'plain', revealed: true }, deputy: { id: 'plain', revealed: true } }));
    expect(s.phase).toBe('Play');
    expect(s.turn.startWindow).toBeUndefined();
  });

  it("an eliminated seat or a face-down seat's turn never opens the window", () => {
    // b is eliminated: the turn skips it and goes to c, a bot.
    const gone = endTurnOfA(table({ eliminated: true }, { kind: 'bot' }));
    expect(gone.turn.ownerSeatId).toBe('c');
    expect(gone.phase).toBe('Play');
    expect(gone.turn.startWindow).toBeUndefined();
    // b is face down: it turns face up and its turn passes on to c, a bot.
    const down = endTurnOfA(table({ faceDown: true }, { kind: 'bot' }));
    expect(down.turn.ownerSeatId).toBe('c');
    expect(down.phase).toBe('Play');
    expect(down.turn.startWindow).toBeUndefined();
    expect(down.seats[1].faceDown).toBeUndefined();
    expect(startsOf(down, 'b')).toEqual([]);
    // startWindowOpens itself refuses both.
    expect(startWindowOpens(table({ eliminated: true }), 'b')).toBe(false);
    expect(startWindowOpens(table({ faceDown: true }), 'b')).toBe(false);
    expect(startWindowOpens(table(), 'b')).toBe(true);
  });

  it('rejects End Phase in Start when the window is not open', () => {
    const s = endTurnOfA(table());
    const closed = { ...s, turn: { ...s.turn, startWindow: undefined } };
    expect(() => resolve(closed, { kind: 'EndPhaseAction', seatId: 'b' }, ctx)).toThrow(/only legal in the Play phase/);
  });
});

describe('the Start window on the first turn', () => {
  it('the first turn after General selection opens the window for a human', () => {
    const unchosen = (id: string, index: number): Seat => ({
      id, index, kingdom: 'hidden', generals: null, combinedHp: 0, maxCombinedHp: 0,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
    });
    const selecting: GameState = {
      ...table(),
      seats: [unchosen('a', 0), unchosen('b', 1)],
      players: [
        { id: 'p-a', seatId: 'a', kind: 'human', name: 'Seat a' },
        { id: 'p-b', seatId: 'b', kind: 'bot', name: 'Seat b' },
      ],
      phase: 'GeneralSelection',
      generalSelection: { candidates: { a: ['plain', 'herald'], b: ['plain', 'herald'] } },
    };
    const afterA = resolve(selecting, { kind: 'ChooseGeneralsAction', seatId: 'a', mainId: 'herald', deputyId: 'plain' }, ctx).state;
    const s = resolve(afterA, { kind: 'ChooseGeneralsAction', seatId: 'b', mainId: 'plain', deputyId: 'herald' }, ctx).state;
    expect(s.turn.ownerSeatId).toBe('a');
    expect(s.phase).toBe('Start');
    expect(s.turn.startWindow).toBe(true);
    expect(startsOf(s, 'a')).toEqual([]);
    expect(getLegalActions(s, 'a', registry)).toEqual([{ kind: 'ConfirmRevealsAction', seatId: 'a', slots: [] }]);
    const on = confirm(s, ['main'], 'a');
    expect(startsOf(on, 'a')).toHaveLength(1);
    expect(on.phase).toBe('Play');
    // herald's omen drew 1 at Start, then Draw drew 2.
    expect(on.zones.find((z) => z.id === 'a:hand')!.cards).toHaveLength(3);
  });

  it('the first turn of a bot starts at once', () => {
    const unchosen = (id: string, index: number): Seat => ({
      id, index, kingdom: 'hidden', generals: null, combinedHp: 0, maxCombinedHp: 0,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
    });
    const selecting: GameState = {
      ...table({ kind: 'bot' }),
      seats: [unchosen('a', 0), unchosen('b', 1)],
      phase: 'GeneralSelection',
      generalSelection: { candidates: { a: ['plain', 'herald'], b: ['plain', 'herald'] } },
    };
    const afterA = resolve(selecting, { kind: 'ChooseGeneralsAction', seatId: 'a', mainId: 'herald', deputyId: 'plain' }, ctx).state;
    const s = resolve(afterA, { kind: 'ChooseGeneralsAction', seatId: 'b', mainId: 'plain', deputyId: 'herald' }, ctx).state;
    // The bot's hidden herald asks before its omen fires; the Start event is logged and no window waited.
    expect(startsOf(s, 'a')).toHaveLength(1);
    expect(s.turn.startWindow).toBeUndefined();
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', reason: { abilityId: 'omen' } });
  });
});
