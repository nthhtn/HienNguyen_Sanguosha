import { buildContentRegistry } from 'content';
import { Action, GameState, getActiveSeatId, getLegalActions } from 'engine';
import { act, playCard } from '../../scenario-kit/recipe';
import { allows } from '../step-rules';
import { definitionOf, handOf } from './lesson-kit';
import { playLesson } from './play-lesson.testing';
import { TOOLS_LESSON } from './tools';

const registry = buildContentRegistry();
const equippedOf = (state: GameState, seatId: string) => state.zones.find((z) => z.id === `${seatId}:equip`)!.cards.map((c) => c.definitionId);
const discardOf = (state: GameState) => state.zones.find((z) => z.kind === 'discardPile')!.cards.map((c) => c.definitionId);
const pick = (state: GameState): Action => getLegalActions(state, 'seat-0', registry).find((a) => a.kind === 'ChooseOptionAction')!;
const step = (id: string) => TOOLS_LESSON.steps.find((s) => s.id === id)!;

// The lesson played by hand: Steal on seat-1, the pick, Break on seat-2, the pick.
function playThrough(until: 'steal' | 'break'): GameState {
  let state = playCard(TOOLS_LESSON.build(registry), registry, 'seat-0', 'steal', ['seat-1']);
  state = act(state, registry, pick(state));
  if (until === 'steal') return state;
  state = playCard(state, registry, 'seat-0', 'break', ['seat-2']);
  return act(state, registry, pick(state));
}

describe('the Tools lesson start', () => {
  const state = TOOLS_LESSON.build(registry);

  it('is in the cards group, on four seats', () => {
    expect(TOOLS_LESSON.group).toBe('cards');
    expect(state.seats).toHaveLength(4);
  });

  it('opens in the beginner’s Play Phase holding exactly Steal and Break', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect([...handOf(state, 'seat-0')].sort()).toEqual(['break', 'steal']);
  });

  it('gives the seat next to the beginner one card in hand and the seat across one worn Weapon, so each pick is certain', () => {
    expect(handOf(state, 'seat-1')).toEqual(['peach']);
    expect(equippedOf(state, 'seat-1')).toEqual([]);
    expect(handOf(state, 'seat-2')).toEqual([]);
    expect(equippedOf(state, 'seat-2')).toEqual(['crossbow']);
  });

  it('leaves nobody holding a Wuxie, so no Wuxie window opens', () => {
    for (const seat of state.seats) expect(handOf(state, seat.id)).not.toContain('wuxie');
  });
});

describe('what the Tools do, as the lesson teaches it', () => {
  it('after the Steal pick the beginner holds the card the seat next to them held', () => {
    const state = playThrough('steal');
    expect(handOf(state, 'seat-0')).toEqual(['break', 'peach']);
    expect(handOf(state, 'seat-1')).toEqual([]);
    expect(state.pendingResponse).toBeNull();
  });

  it('after the Break pick the seat across has lost its Weapon to the discard pile', () => {
    const state = playThrough('break');
    expect(equippedOf(state, 'seat-2')).toEqual([]);
    expect(discardOf(state)).toContain('crossbow');
    expect(discardOf(state).filter((id) => id === 'steal' || id === 'break')).toHaveLength(2);
  });

  it('Steal can only reach a seat at distance 1: the seat across is no target', () => {
    const state = TOOLS_LESSON.build(registry);
    const steals = getLegalActions(state, 'seat-0', registry).filter((a) => a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === 'steal');
    expect(steals.flatMap((a) => (a.kind === 'PlayCardAction' ? a.targets.map((t) => (t.kind === 'seat' ? t.seatId : '')) : []))).toEqual(['seat-1']);
  });
});

describe('the Tools lesson steps', () => {
  it('plays to the end', () => {
    const played = playLesson(TOOLS_LESSON, registry);
    expect(played.find((s) => !s.ok)).toBeUndefined();
    expect(played).toHaveLength(TOOLS_LESSON.steps.length);
  });

  it('asks for Steal, its pick, Break and its pick, in that order', () => {
    expect(TOOLS_LESSON.steps.filter((s) => s.completes.kind === 'action').map((s) => s.id)).toEqual(['play-steal', 'pick-steal', 'play-break', 'pick-break']);
  });

  it('lets through Steal on the seat next to the beginner, not Break, and not the pick before there is one', () => {
    const state = TOOLS_LESSON.build(registry);
    const play = (def: string, seat: string) =>
      getLegalActions(state, 'seat-0', registry).find((a) => a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === def && a.targets[0]?.kind === 'seat' && a.targets[0].seatId === seat)!;
    expect(allows(step('play-steal'), play('steal', 'seat-1'), state)).toBe(true);
    expect(allows(step('play-steal'), play('break', 'seat-2'), state)).toBe(false);
    expect(allows(step('play-break'), play('steal', 'seat-1'), state)).toBe(false);
  });

  it('spotlights the pick window for each pick', () => {
    expect(step('pick-steal').target).toBe('choice-dialog');
    expect(step('pick-break').target).toBe('choice-dialog');
  });
});
