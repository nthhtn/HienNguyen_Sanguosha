import { buildContentRegistry } from 'content';
import { Action, GameState, getActiveSeatId, getLegalActions } from 'engine';
import { act, playCard } from '../../scenario-kit/recipe';
import { allows } from '../step-rules';
import { JUDGMENT_LESSON } from './judgment';
import { definitionOf, handOf } from './lesson-kit';
import { playLesson } from './play-lesson.testing';

const registry = buildContentRegistry();
const step = (id: string) => JUDGMENT_LESSON.steps.find((s) => s.id === id)!;
const zoneOf = (state: GameState, id: string) => state.zones.find((z) => z.id === id)!.cards.map((c) => c.definitionId);
const discardOf = (state: GameState) => state.zones.find((z) => z.kind === 'discardPile')!.cards.map((c) => c.definitionId);
const endPhase = (state: GameState): Action => getLegalActions(state, 'seat-0', registry).find((a) => a.kind === 'EndPhaseAction')!;
const acknowledge = (state: GameState): Action => getLegalActions(state, 'seat-0', registry).find((a) => a.kind === 'AcknowledgeJudgmentAction')!;

// The lesson played by hand: Starvation on seat-1, End Phase, the judgment, its acknowledgement.
function playThrough() {
  const placed = playCard(JUDGMENT_LESSON.build(registry), registry, 'seat-0', 'starvation', ['seat-1']);
  const judging = act(placed, registry, endPhase(placed));
  const after = act(judging, registry, acknowledge(judging));
  return { placed, judging, after };
}

describe('the Delayed Tools and Judgment lesson start', () => {
  const state = JUDGMENT_LESSON.build(registry);

  it('is in the Special Effects group, on four seats', () => {
    expect(JUDGMENT_LESSON.group).toBe('effects');
    expect(state.seats).toHaveLength(4);
  });

  it('opens in the beginner’s Play Phase holding exactly Starvation, with nobody else holding a card', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect(handOf(state, 'seat-0')).toEqual(['starvation']);
    for (const id of ['seat-1', 'seat-2', 'seat-3']) expect(handOf(state, id)).toEqual([]);
  });

  it('fixes the judgment: the top card of the draw pile is a heart, so it is not left to chance', () => {
    const pile = state.zones.find((z) => z.kind === 'drawPile')!.cards;
    expect(pile[0].suit).toBe('heart');
  });
});

describe('what happens, as the lesson teaches it', () => {
  it('Starvation waits in the judgment area of the seat it was played on, and does nothing yet', () => {
    const { placed } = playThrough();
    expect(zoneOf(placed, 'seat-1:judgment')).toEqual(['starvation']);
    expect(placed.phase).toBe('Play');
  });

  it('the seat’s Judgment Phase turns up the fixed heart and waits for the acknowledgement', () => {
    const { judging } = playThrough();
    expect(judging.phase).toBe('Judgment');
    expect(judging.judgmentView?.card.suit).toBe('heart');
    expect(acknowledge(judging)).toBeDefined();
  });

  it('a heart is not a club, so the seat skips its Draw Phase: it plays with the same empty hand', () => {
    const { after } = playThrough();
    expect(after.phase).toBe('Play');
    expect(after.turn.ownerSeatId).toBe('seat-1');
    expect(handOf(after, 'seat-1')).toEqual([]);
  });

  it('the Starvation leaves the judgment area for the Discard Pile', () => {
    const { after } = playThrough();
    expect(zoneOf(after, 'seat-1:judgment')).toEqual([]);
    expect(discardOf(after)).toContain('starvation');
  });
});

describe('the Delayed Tools and Judgment lesson steps', () => {
  it('plays to the end', () => {
    const played = playLesson(JUDGMENT_LESSON, registry);
    expect(played.find((s) => !s.ok)).toBeUndefined();
    expect(played).toHaveLength(JUDGMENT_LESSON.steps.length);
  });

  it('asks for Starvation, End Phase, then the acknowledgement of the judgment, in that order', () => {
    expect(JUDGMENT_LESSON.steps.filter((s) => s.completes.kind === 'action').map((s) => s.id)).toEqual(['play-starvation', 'end-phase', 'judged']);
  });

  it('spotlights the seat’s judgment area, the End Phase button and the judgment popup', () => {
    expect(step('placed').target).toBe('judgment-area:seat-1');
    expect(step('end-phase').target).toBe('end-phase');
    expect(step('judged').target).toBe('judgment-dialog');
    expect(step('play-starvation').target).toEqual(['target-seat:seat-1', 'hand-card:starvation']);
  });

  it('lets the acknowledgement of the judgment through, so the popup can close', () => {
    const { judging } = playThrough();
    expect(allows(step('judged'), acknowledge(judging), judging)).toBe(true);
  });

  it('lets through Starvation on the seat next to the beginner only', () => {
    const state = JUDGMENT_LESSON.build(registry);
    const plays = getLegalActions(state, 'seat-0', registry).filter((a) => a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === 'starvation');
    expect(plays.length).toBeGreaterThan(0);
    const allowed = plays.filter((a) => allows(step('play-starvation'), a, state));
    expect(allowed).toHaveLength(1);
    expect(allowed[0].kind === 'PlayCardAction' && allowed[0].targets[0].kind === 'seat' && allowed[0].targets[0].seatId).toBe('seat-1');
  });
});
