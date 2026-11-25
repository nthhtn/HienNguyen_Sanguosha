import { buildContentRegistry } from 'content';
import { Action, GameState, getActiveSeatId, getLegalActions } from 'engine';
import { act } from '../../scenario-kit/recipe';
import { allows } from '../step-rules';
import { CHAINS_LESSON } from './chains';
import { definitionOf, handOf } from './lesson-kit';
import { playLesson } from './play-lesson.testing';

const registry = buildContentRegistry();
const step = (id: string) => CHAINS_LESSON.steps.find((s) => s.id === id)!;
const seatOf = (state: GameState, id: string) => state.seats.find((s) => s.id === id)!;
const legal = (state: GameState): Action[] => getLegalActions(state, 'seat-0', registry);
const targetsOf = (a: Action) => (a.kind === 'PlayCardAction' ? a.targets.map((t) => (t.kind === 'seat' ? t.seatId : '')) : []);

// Chains on seat-1 and seat-3, the way the board's pick window fills the template.
function chainsOn(state: GameState, seatIds: string[]): Action {
  const template = legal(state).find((a) => a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === 'chains' && !!a.pickTargets)!;
  if (template.kind !== 'PlayCardAction') throw new Error('not a play');
  const { pickTargets: _pick, ...play } = template;
  return { ...play, targets: seatIds.map((seatId) => ({ kind: 'seat' as const, seatId })) };
}
const fireAt = (state: GameState, seatId: string): Action =>
  legal(state).find((a) => a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === 'fire-attack' && targetsOf(a).join() === seatId)!;

function playThrough() {
  const start = CHAINS_LESSON.build(registry);
  const chained = act(start, registry, chainsOn(start, ['seat-1', 'seat-3']));
  const attacked = act(chained, registry, fireAt(chained, 'seat-1'));
  const passed = act(attacked, registry, getLegalActions(attacked, getActiveSeatId(attacked)!, registry).find((a) => a.kind === 'PassAction')!);
  return { start, chained, attacked, passed };
}

describe('the Chains lesson start', () => {
  const state = CHAINS_LESSON.build(registry);

  it('is in the Special Effects group, on four seats', () => {
    expect(CHAINS_LESSON.group).toBe('effects');
    expect(state.seats).toHaveLength(4);
  });

  it('opens in the beginner’s Play Phase holding exactly Chains and Fire Attack, with nobody else holding a card', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect([...handOf(state, 'seat-0')].sort()).toEqual(['chains', 'fire-attack']);
    for (const id of ['seat-1', 'seat-2', 'seat-3']) expect(handOf(state, id)).toEqual([]);
  });

  it('starts with nobody chained, and the two seats the lesson uses in the beginner’s Fire Attack range', () => {
    expect(state.seats.some((s) => s.chained)).toBe(false);
    expect(legal(state).filter((a) => definitionOf(state, (a as { cardInstanceId?: string }).cardInstanceId ?? '') === 'fire-attack').map(targetsOf)).toEqual([['seat-1'], ['seat-3']]);
  });
});

describe('what happens, as the lesson teaches it', () => {
  it('Chains on the two seats chains both and no other', () => {
    const { chained } = playThrough();
    expect(chained.seats.filter((s) => s.chained).map((s) => s.id)).toEqual(['seat-1', 'seat-3']);
  });

  it('Fire Attack on one chained seat with no Shan: both seats lose 1 HP and neither is chained any more', () => {
    const { chained, passed } = playThrough();
    for (const id of ['seat-1', 'seat-3']) {
      expect({ id, hp: seatOf(passed, id).combinedHp, chained: !!seatOf(passed, id).chained }).toEqual({ id, hp: seatOf(chained, id).combinedHp - 1, chained: false });
    }
    expect(passed.pendingResponse).toBeNull();
  });

  it('leaves the seat that was not chained untouched', () => {
    const { chained, passed } = playThrough();
    expect(seatOf(passed, 'seat-2').combinedHp).toBe(seatOf(chained, 'seat-2').combinedHp);
    expect(seatOf(passed, 'seat-0').combinedHp).toBe(seatOf(chained, 'seat-0').combinedHp);
  });
});

describe('the Chains lesson steps', () => {
  it('plays to the end', () => {
    const played = playLesson(CHAINS_LESSON, registry);
    expect(played.find((s) => !s.ok)).toBeUndefined();
    expect(played).toHaveLength(CHAINS_LESSON.steps.length);
  });

  it('asks for Chains, then Fire Attack, in that order', () => {
    expect(CHAINS_LESSON.steps.filter((s) => s.completes.kind === 'action').map((s) => s.id)).toEqual(['play-chains', 'play-fire']);
  });

  it('lets through Chains on exactly seat-1 and seat-3, and not on other seats or on one', () => {
    const state = CHAINS_LESSON.build(registry);
    expect(allows(step('play-chains'), chainsOn(state, ['seat-1', 'seat-3']), state)).toBe(true);
    expect(allows(step('play-chains'), chainsOn(state, ['seat-1', 'seat-2']), state)).toBe(false);
    expect(allows(step('play-chains'), chainsOn(state, ['seat-1']), state)).toBe(false);
  });

  it('lets through Fire Attack at the chained seat the lesson names, not at the other', () => {
    const { chained } = playThrough();
    expect(allows(step('play-fire'), fireAt(chained, 'seat-1'), chained)).toBe(true);
    expect(allows(step('play-fire'), fireAt(chained, 'seat-3'), chained)).toBe(false);
  });

  it('spotlights the pick window, falling back to the menu item that opens it, the Play button and the card, and the chain badge, falling back to the seat', () => {
    expect(step('play-chains').target).toEqual(['targets-dialog', 'pick-targets', 'play-button:chains', 'hand-card:chains']);
    expect(step('chained').target).toEqual(['chain-badge:seat-1', 'seat:seat-1']);
  });

  it('has the chained seat pass, since it holds nothing that could answer', () => {
    expect(step('wave').bot?.map((b) => b.seatId)).toEqual(['seat-1']);
  });
});
