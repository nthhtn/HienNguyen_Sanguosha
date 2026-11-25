import { buildContentRegistry } from 'content';
import { Action, GameState, getLegalActions } from 'engine';
import { act } from '../../scenario-kit/recipe';
import { allows } from '../step-rules';
import { definitionOf, handOf, respondWith } from './lesson-kit';
import { playLesson } from './play-lesson.testing';
import { WUXIE_LESSON } from './wuxie';

const registry = buildContentRegistry();
const step = (id: string) => WUXIE_LESSON.steps.find((s) => s.id === id)!;
const legalFor = (state: GameState, seatId: string): Action[] => getLegalActions(state, seatId, registry);
const wuxieOf = (state: GameState, seatId: string) => legalFor(state, seatId).find((a) => a.kind === 'RespondAction' && definitionOf(state, a.cardInstanceId) === 'wuxie')!;
const asked = (state: GameState) => state.pendingResponse?.respondingSeatId;
const discardOf = (state: GameState) => state.zones.find((z) => z.kind === 'discardPile')!.cards.map((c) => c.definitionId);

// The lesson played by hand through the three Wuxie: the beginner, the seat that answers it, the beginner again.
function playChain(): { opened: GameState; afterFirst: GameState; afterSecond: GameState; end: GameState } {
  const opened = WUXIE_LESSON.build(registry);
  const afterFirst = act(opened, registry, wuxieOf(opened, 'seat-0'));
  const afterSecond = act(afterFirst, registry, wuxieOf(afterFirst, 'seat-1'));
  const end = act(afterSecond, registry, wuxieOf(afterSecond, 'seat-0'));
  return { opened, afterFirst, afterSecond, end };
}

describe('the Wuxie lesson start', () => {
  const state = WUXIE_LESSON.build(registry);

  it('is in the cards group, on four seats', () => {
    expect(WUXIE_LESSON.group).toBe('cards');
    expect(state.seats).toHaveLength(4);
  });

  it('opens with the Wuxie window already asking the beginner, because Break was played on them', () => {
    expect(asked(state)).toBe('seat-0');
  });

  it('gives the beginner two Wuxie and a card that cannot answer, the seat after them one Wuxie, and nobody else any', () => {
    expect([...handOf(state, 'seat-0')].sort()).toEqual(['peach', 'wuxie', 'wuxie']);
    expect(handOf(state, 'seat-1')).toEqual(['wuxie']);
    expect(handOf(state, 'seat-2')).toEqual([]);
    expect(handOf(state, 'seat-3')).toEqual([]);
  });
});

describe('what happens in the window, as the lesson teaches it', () => {
  it('the first Wuxie cancels the Break, and the seat after the beginner is then asked', () => {
    const { afterFirst } = playChain();
    expect(asked(afterFirst)).toBe('seat-1');
  });

  it('the second Wuxie, from the other seat, brings the Break back and asks the beginner again', () => {
    const { afterSecond } = playChain();
    expect(asked(afterSecond)).toBe('seat-0');
  });

  it('the third Wuxie cancels the Break for good: the beginner keeps every card and no window is left', () => {
    const { end } = playChain();
    expect(end.pendingResponse).toBeNull();
    expect([...handOf(end, 'seat-0')]).toEqual(['peach']);
    expect(discardOf(end).filter((id) => id === 'wuxie')).toHaveLength(3);
    expect(discardOf(end)).toContain('break');
  });
});

describe('the Wuxie lesson steps', () => {
  it('plays to the end', () => {
    const played = playLesson(WUXIE_LESSON, registry);
    expect(played.find((s) => !s.ok)).toBeUndefined();
    expect(played).toHaveLength(WUXIE_LESSON.steps.length);
  });

  it('asks the beginner for a Wuxie twice, with the other seat’s Wuxie scripted between them', () => {
    expect(WUXIE_LESSON.steps.filter((s) => s.completes.kind === 'action').map((s) => s.id)).toEqual(['wuxie-first', 'wuxie-second']);
    expect(step('countered').bot?.map((b) => b.seatId)).toEqual(['seat-1']);
  });

  it('refuses to pass in the window, so the window stays until the beginner plays the Wuxie', () => {
    const state = WUXIE_LESSON.build(registry);
    const pass = legalFor(state, 'seat-0').find((a) => a.kind === 'PassAction')!;
    expect(pass).toBeDefined();
    expect(allows(step('wuxie-first'), pass, state)).toBe(false);
    expect(allows(step('wuxie-first'), wuxieOf(state, 'seat-0'), state)).toBe(true);
  });

  it('offers the beginner no card but Wuxie in the window, so no other card can be played by mistake', () => {
    const state = WUXIE_LESSON.build(registry);
    const responses = legalFor(state, 'seat-0').filter((a) => a.kind === 'RespondAction');
    expect(responses.length).toBeGreaterThan(0);
    for (const a of responses) expect(a.kind === 'RespondAction' && definitionOf(state, a.cardInstanceId)).toBe('wuxie');
  });

  it('lets the scripted seat pick only its Wuxie', () => {
    const { afterFirst } = playChain();
    const bot = step('countered').bot![0];
    const picked = bot.pick(legalFor(afterFirst, 'seat-1'), afterFirst);
    expect(picked && picked.kind === 'RespondAction' && definitionOf(afterFirst, picked.cardInstanceId)).toBe('wuxie');
    expect(respondWith('wuxie')).toBeInstanceOf(Function);
  });

  it('spotlights the whole window for both of the beginner’s plays', () => {
    expect(step('wuxie-first').target).toBe('response-dialog');
    expect(step('wuxie-second').target).toBe('response-dialog');
  });
});
