import { buildContentRegistry } from 'content';
import { Action, GameState } from 'engine';
import { playableGame } from '../scenario-kit/recipe';
import { allows, completedBy, reachedState } from './step-rules';
import { Step } from './tutorial-types';

const registry = buildContentRegistry();
const state: GameState = playableGame(registry, 7, 4);

const shaAt = (seatId: string): Action => ({
  kind: 'PlayCardAction',
  seatId: 'seat-0',
  cardInstanceId: 'card-1',
  targets: [{ kind: 'seat', seatId }],
});
const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };

// 'nav.menu' is any existing catalog key: step-rules never reads the text.
const base = { id: 'step', textKey: 'nav.menu' } as const;

const playSha: Step = {
  ...base,
  completes: {
    kind: 'action',
    allow: [
      {
        kind: 'PlayCardAction',
        match: (action) => action.kind === 'PlayCardAction' && action.targets.some((t) => t.kind === 'seat' && t.seatId === 'seat-1'),
      },
    ],
  },
};

describe('allows', () => {
  it('lets through an action that matches a pattern of an action step', () => {
    expect(allows(playSha, shaAt('seat-1'), state)).toBe(true);
  });

  it('refuses an action of another kind on the same step', () => {
    expect(allows(playSha, endPhase, state)).toBe(false);
  });

  it('refuses an action of the right kind that the match predicate rejects (a Sha at the wrong seat)', () => {
    expect(allows(playSha, shaAt('seat-2'), state)).toBe(false);
  });

  it('lets a pattern without a match predicate allow every action of its kind', () => {
    const anyEnd: Step = { ...base, completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction' }] } };
    expect(allows(anyEnd, endPhase, state)).toBe(true);
  });

  it('lets any one of several patterns allow the action', () => {
    const either: Step = { ...base, completes: { kind: 'action', allow: [{ kind: 'PassAction' }, { kind: 'EndPhaseAction' }] } };
    expect(allows(either, endPhase, state)).toBe(true);
  });

  it('allows no action on a next step (the board is locked while a card explains something)', () => {
    const next: Step = { ...base, completes: { kind: 'next' } };
    expect(allows(next, endPhase, state)).toBe(false);
    expect(allows(next, shaAt('seat-1'), state)).toBe(false);
  });

  it('allows no player action on a state step', () => {
    const wait: Step = { ...base, completes: { kind: 'state', reached: () => true } };
    expect(allows(wait, endPhase, state)).toBe(false);
  });
});

describe('completedBy', () => {
  it('is true for an allowed action', () => {
    expect(completedBy(playSha, shaAt('seat-1'), state)).toBe(true);
  });

  it('is false for an action the step does not allow', () => {
    expect(completedBy(playSha, shaAt('seat-2'), state)).toBe(false);
    expect(completedBy(playSha, endPhase, state)).toBe(false);
  });

  it('is false on a next or state step, whatever the action', () => {
    const next: Step = { ...base, completes: { kind: 'next' } };
    const wait: Step = { ...base, completes: { kind: 'state', reached: () => true } };
    expect(completedBy(next, endPhase, state)).toBe(false);
    expect(completedBy(wait, endPhase, state)).toBe(false);
  });
});

describe('reachedState', () => {
  it('is true only for a state step whose predicate holds', () => {
    const holds: Step = { ...base, completes: { kind: 'state', reached: () => true } };
    const fails: Step = { ...base, completes: { kind: 'state', reached: () => false } };
    expect(reachedState(holds, state)).toBe(true);
    expect(reachedState(fails, state)).toBe(false);
  });

  it('hands the predicate the state it was asked about', () => {
    const inPlay: Step = { ...base, completes: { kind: 'state', reached: (s) => s.phase === 'Play' } };
    expect(reachedState(inPlay, { ...state, phase: 'Play' })).toBe(true);
    expect(reachedState(inPlay, { ...state, phase: 'Draw' })).toBe(false);
  });

  it('is false on a next or action step even when a predicate would hold', () => {
    const next: Step = { ...base, completes: { kind: 'next' } };
    const act: Step = { ...base, completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction' }] } };
    expect(reachedState(next, state)).toBe(false);
    expect(reachedState(act, state)).toBe(false);
  });
});
