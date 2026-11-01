import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Action, CardInstance, EngineEvent, GameState, UsedCard } from 'engine';
import { GameService } from '../../game.service';
import { PlaybackGate } from '../../playback-gate.service';
import { PlaybackSpeed } from '../../playback-speed.service';
import { foldEvent } from './displayed-state';
import { PlaybackDirector } from './playback-director';

// Two seats, a and b, at 3/4 HP.
function table(): GameState {
  const ids = ['a', 'b'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu'] as const)[index], combinedHp: 3, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const turn = (seatId: string): EngineEvent => ({ kind: 'TurnAdvancedEvent', seatId, turnNumber: 2 }) as EngineEvent;
const phase = (p: GameState['phase']): EngineEvent => ({ kind: 'PhaseChangedEvent', seatId: 'a', phase: p }) as EngineEvent;
const damage = (seatId: string, amount = 1): EngineEvent =>
  ({ kind: 'DamageDealtEvent', damage: { source: { kind: 'seat', seatId: 'a' }, target: { kind: 'seat', seatId }, amount } }) as EngineEvent;
const sha: CardInstance = { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 };
const shan: CardInstance = { instanceId: 'c2', definitionId: 'shan', suit: 'heart', rank: 2 };
const used = (card: CardInstance, as: string): UsedCard => ({ as, colour: 'red', suit: card.suit, rank: card.rank, physical: [card] });
const play = (seatId: string, card: UsedCard, target: string, inResponseTo?: { seatId: string }): EngineEvent =>
  ({ kind: 'CardPlayedEvent', seatId, card, targets: [{ kind: 'seat', seatId: target }], ...(inResponseTo ? { inResponseTo } : {}) }) as EngineEvent;

// The real next state: the events logged and their facts applied.
function after(state: GameState, ...events: EngineEvent[]): GameState {
  const folded = events.reduce((s, e) => foldEvent(s, e, s), state);
  return { ...folded, log: [...state.log, ...events] };
}

const hp = (state: GameState | null, seatId: string) => state?.seats.find((s) => s.id === seatId)?.combinedHp;

function setup(options: { clockWaitsForPlayback?: boolean } = {}) {
  TestBed.resetTestingModule();
  const visibleState = signal<GameState | null>(null);
  const legalActions = signal<Action[]>([]);
  const lastMoveStart = signal<GameState | null>(null);
  const game = { visibleState, legalActions, lastMoveStart, clockWaitsForPlayback: options.clockWaitsForPlayback ?? true };
  TestBed.configureTestingModule({ providers: [{ provide: GameService, useValue: game }] });
  const speed = TestBed.inject(PlaybackSpeed);
  speed.speed.set('normal');
  const gate = TestBed.inject(PlaybackGate);
  // Scoped like the board's providers, so destroying it is leaving the board.
  const injector = createEnvironmentInjector([PlaybackDirector], TestBed.inject(EnvironmentInjector));
  const director = injector.get(PlaybackDirector);
  const show = (state: GameState | null) => {
    visibleState.set(state);
    TestBed.tick();
  };
  return { director, gate, speed, injector, show, visibleState, legalActions, lastMoveStart };
}

describe('PlaybackDirector', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('sets a baseline on the first look and plays nothing', () => {
    const { director, show } = setup();
    const state = after(table(), turn('a'), damage('b'));
    show(state);
    expect(director.idle()).toBe(true);
    expect(director.current()).toBeNull();
    expect(director.displayedState()).toBe(state);
    expect(director.playedLogLength()).toBe(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('plays new events in order, each after its duration, and is idle after the last one plus BATCH_GAP_MS', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    const next = after(start, turn('b'), phase('Draw'), damage('b'));
    show(next);
    expect(director.idle()).toBe(false);
    expect(director.current()?.event.kind).toBe('TurnAdvancedEvent');
    expect(director.playedLogLength()).toBe(1);
    expect(director.displayedState()?.log).toEqual(next.log.slice(0, 1));
    jest.advanceTimersByTime(999);
    expect(director.current()?.event.kind).toBe('TurnAdvancedEvent');
    jest.advanceTimersByTime(1);
    expect(director.current()?.event.kind).toBe('PhaseChangedEvent');
    jest.advanceTimersByTime(250);
    expect(director.current()?.event.kind).toBe('DamageDealtEvent');
    expect(director.playedLogLength()).toBe(3);
    jest.advanceTimersByTime(900 + 349);
    expect(director.idle()).toBe(false);
    jest.advanceTimersByTime(1);
    expect(director.idle()).toBe(true);
    expect(director.current()).toBeNull();
    expect(director.displayedState()).toBe(next);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('displayedState shows HP dropping only when the damage beat starts', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    show(after(start, phase('Draw'), damage('b', 2)));
    expect(hp(director.displayedState(), 'b')).toBe(3);
    expect(director.displayedState()?.phase).toBe('Draw');
    jest.advanceTimersByTime(249);
    expect(hp(director.displayedState(), 'b')).toBe(3);
    jest.advanceTimersByTime(1);
    expect(hp(director.displayedState(), 'b')).toBe(1);
  });

  it('a batch arriving mid-sequence is appended to the queue', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    const first = after(start, turn('b'));
    show(first);
    jest.advanceTimersByTime(500);
    const second = after(first, damage('a'));
    show(second);
    expect(director.current()?.event.kind).toBe('TurnAdvancedEvent');
    // The first batch's beat, then its gap.
    jest.advanceTimersByTime(500 + 349);
    expect(director.current()?.event.kind).toBe('TurnAdvancedEvent');
    jest.advanceTimersByTime(1);
    expect(director.current()?.event.kind).toBe('DamageDealtEvent');
    jest.advanceTimersByTime(900 + 350);
    expect(director.idle()).toBe(true);
    expect(director.displayedState()).toBe(second);
  });

  it('speed factor 2 halves every duration; Instant applies everything in one tick', () => {
    const { director, show, speed } = setup();
    const start = table();
    show(start);
    speed.speed.set('fast');
    const next = after(start, turn('b'), damage('b'));
    show(next);
    jest.advanceTimersByTime(499);
    expect(director.current()?.event.kind).toBe('TurnAdvancedEvent');
    jest.advanceTimersByTime(1);
    expect(director.current()?.event.kind).toBe('DamageDealtEvent');
    jest.advanceTimersByTime(450 + 175);
    expect(director.idle()).toBe(true);

    speed.speed.set('instant');
    const last = after(next, turn('a'), damage('a'), phase('End'));
    show(last);
    expect(director.idle()).toBe(true);
    expect(director.displayedState()).toBe(last);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('writes idle to PlaybackGate', () => {
    const { gate, show } = setup();
    const start = table();
    show(start);
    expect(gate.idle()).toBe(true);
    show(after(start, damage('b')));
    expect(gate.idle()).toBe(false);
    jest.advanceTimersByTime(900 + 350);
    expect(gate.idle()).toBe(true);
  });

  it('releases the gate on destroy', () => {
    const { gate, show, injector } = setup();
    const start = table();
    show(start);
    show(after(start, damage('b')));
    expect(gate.idle()).toBe(false);
    injector.destroy();
    expect(gate.idle()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('resets on a new game', () => {
    const { director, gate, show } = setup();
    const start = after(table(), turn('a'), phase('Play'));
    show(start);
    show(after(start, damage('b'), damage('b')));
    expect(gate.idle()).toBe(false);
    const fresh = after(table(), turn('a'));
    show(fresh);
    expect(director.idle()).toBe(true);
    expect(gate.idle()).toBe(true);
    expect(director.current()).toBeNull();
    expect(director.displayedState()).toBe(fresh);
    expect(jest.getTimerCount()).toBe(0);
    // The new game's log is the baseline: only what follows it plays.
    show(after(fresh, damage('a')));
    expect(director.current()?.logIndex).toBe(1);
  });

  it('online: owing a decision rushes the rest into about RUSH_MS', () => {
    const { director, show, legalActions } = setup({ clockWaitsForPlayback: false });
    const start = table();
    show(start);
    legalActions.set([{ kind: 'PassAction', seatId: 'b' } as Action]);
    // 5 × 900 + 350 = 4850 ms at Normal.
    show(after(start, damage('b'), damage('b'), damage('b'), damage('a'), damage('a')));
    jest.advanceTimersByTime(950);
    expect(director.idle()).toBe(false);
    jest.advanceTimersByTime(100);
    expect(director.idle()).toBe(true);
  });

  it('online: more than CAP_MS queued speeds up', () => {
    const { director, show } = setup({ clockWaitsForPlayback: false });
    const start = table();
    show(start);
    // 6 × 900 + 350 = 5750 ms at Normal, over the 4000 ms cap.
    show(after(start, damage('b'), damage('b'), damage('b'), damage('a'), damage('a'), damage('a')));
    jest.advanceTimersByTime(700);
    expect(director.current()?.logIndex).toBe(1);
    jest.advanceTimersByTime(5000);
    expect(director.idle()).toBe(true);
  });

  it('local games do not catch up, however much is queued', () => {
    const { director, show, legalActions } = setup();
    const start = table();
    show(start);
    legalActions.set([{ kind: 'PassAction', seatId: 'b' } as Action]);
    show(after(start, damage('b'), damage('b'), damage('b'), damage('a'), damage('a'), damage('a')));
    jest.advanceTimersByTime(899);
    expect(director.current()?.logIndex).toBe(0);
  });

  it('hold() pauses until released', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    const next = after(start, turn('b'), phase('Draw'));
    show(next);
    const release = director.hold();
    jest.advanceTimersByTime(5000);
    expect(director.current()?.event.kind).toBe('TurnAdvancedEvent');
    expect(director.idle()).toBe(false);
    release();
    release(); // A second call is harmless.
    expect(director.current()?.event.kind).toBe('PhaseChangedEvent');
    jest.advanceTimersByTime(250 + 350);
    expect(director.idle()).toBe(true);
    expect(director.displayedState()).toBe(next);
  });

  it("Pass and Play: while visibleState is null nothing plays; on reveal, plays from lastMoveStart's log length starting at lastMoveStart", () => {
    const { director, show, lastMoveStart } = setup();
    show(null);
    const first = after(table(), turn('a'));
    show(first);
    expect(director.idle()).toBe(true);
    // The move ends; the gate rises.
    show(null);
    expect(director.displayedState()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    // An earlier move (logIndex 1) is already part of the start of the last one.
    const moveStart = after(first, phase('Draw'));
    lastMoveStart.set(moveStart);
    TestBed.tick();
    expect(jest.getTimerCount()).toBe(0);
    const revealed = after(moveStart, phase('Play'), damage('b'));
    show(revealed);
    expect(director.current()?.logIndex).toBe(2);
    expect(director.displayedState()?.log).toEqual(revealed.log.slice(0, 3));
    expect(hp(director.displayedState(), 'b')).toBe(3);
    jest.advanceTimersByTime(250);
    expect(hp(director.displayedState(), 'b')).toBe(2);
    jest.advanceTimersByTime(900 + 350);
    expect(director.displayedState()).toBe(revealed);
  });

  it('displayedState equals visibleState whenever idle', () => {
    const { director, show, visibleState } = setup();
    const start = table();
    show(start);
    expect(director.displayedState()).toBe(visibleState());
    // A change with no new events reconciles at once.
    const quiet = { ...start, phase: 'Discard' as const };
    show(quiet);
    expect(director.idle()).toBe(true);
    expect(director.displayedState()).toBe(quiet);
    expect(jest.getTimerCount()).toBe(0);
    show(after(quiet, damage('b')));
    jest.advanceTimersByTime(900 + 350);
    expect(director.idle()).toBe(true);
    expect(director.displayedState()).toBe(visibleState());
  });

  it('centreStack holds a play and its responses, replaced by a new play and cleared by a turn', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    const slash = used(sha, 'sha');
    const dodge = used(shan, 'shan');
    const resolved = after(start, play('a', slash, 'b'), play('b', dodge, 'a', { seatId: 'a' }), play('a', slash, 'b'), turn('b'));
    show(resolved);
    expect(director.centreStack()).toEqual([slash]);
    jest.advanceTimersByTime(900);
    expect(director.centreStack()).toEqual([slash, dodge]);
    jest.advanceTimersByTime(900);
    expect(director.centreStack()).toEqual([slash]);
    jest.advanceTimersByTime(900);
    expect(director.centreStack()).toEqual([]);
    jest.advanceTimersByTime(1000 + 350);
    show(after(resolved, play('a', slash, 'b')));
    expect(director.centreStack()).toEqual([slash]);
  });

  it('going idle keeps the centre: the response that comes in a later batch lands on it', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    const slash = used(sha, 'sha');
    const dodge = used(shan, 'shan');
    const asked = after(start, play('a', slash, 'b'));
    show(asked);
    jest.advanceTimersByTime(900 + 350);
    expect(director.idle()).toBe(true);
    expect(director.centreStack()).toEqual([slash]);
    const answered = after(asked, play('b', dodge, 'a', { seatId: 'a' }));
    show(answered);
    expect(director.centreStack()).toEqual([slash, dodge]);
    jest.advanceTimersByTime(900 + 350);
    expect(director.idle()).toBe(true);
    expect(director.centreStack()).toEqual([slash, dodge]);
    // A new phase clears it.
    show(after(answered, phase('Discard')));
    expect(director.centreStack()).toEqual([]);
  });

  it('a new game or the Pass and Play gate clears the centre', () => {
    const { director, show } = setup();
    const start = table();
    show(start);
    const slash = used(sha, 'sha');
    show(after(start, play('a', slash, 'b')));
    jest.advanceTimersByTime(900 + 350);
    expect(director.centreStack()).toEqual([slash]);
    show(table());
    expect(director.centreStack()).toEqual([]);
    show(after(table(), play('a', slash, 'b')));
    jest.advanceTimersByTime(900 + 350);
    expect(director.centreStack()).toEqual([slash]);
    show(null);
    expect(director.centreStack()).toEqual([]);
  });

  it('a new game whose log is as long as the old one plays nothing old', () => {
    const { director, show } = setup();
    const start = table();
    show(after(start, turn('a'), damage('b')));
    // Another game: different events, a longer log.
    const other = after(table(), turn('b'), damage('a'), damage('a', 2));
    show(other);
    expect(director.idle()).toBe(true);
    expect(director.displayedState()).toBe(other);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a masked copy of the same event is not a new game', () => {
    const { director, show } = setup();
    const start = table();
    const ability = { kind: 'AbilityUsedEvent', owner: { kind: 'general', seatId: 'b', slot: 'main', skillId: 'jianxiong' }, abilityId: 'jianxiong' } as unknown as EngineEvent;
    const first = after(start, ability);
    show(first);
    // The same log, re-masked for the viewer: the skill now reads 'hidden'.
    const masked = { ...ability, owner: { kind: 'general', seatId: 'b', slot: 'main', skillId: 'hidden' }, abilityId: 'hidden' } as unknown as EngineEvent;
    show({ ...after({ ...start, log: [masked] }, damage('b')) });
    expect(director.idle()).toBe(false);
    expect(director.current()?.event.kind).toBe('DamageDealtEvent');
  });
});
