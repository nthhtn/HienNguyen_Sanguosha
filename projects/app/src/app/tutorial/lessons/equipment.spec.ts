import { buildContentRegistry } from 'content';
import { GameState, getActiveSeatId, getLegalActions } from 'engine';
import { playCard } from '../../scenario-kit/recipe';
import { EQUIPMENT_LESSON } from './equipment';
import { definitionOf, handOf } from './lesson-kit';
import { allows } from '../step-rules';
import { playLesson } from './play-lesson.testing';

const registry = buildContentRegistry();
const equippedOf = (state: GameState, seatId: string) => state.zones.find((z) => z.id === `${seatId}:equip`)!.cards.map((c) => c.definitionId);
// The seats the beginner can legally Sha right now.
const shaTargets = (state: GameState): string[] =>
  getLegalActions(state, 'seat-0', registry).flatMap((a) =>
    a.kind === 'PlayCardAction' && definitionOf(state, a.cardInstanceId) === 'sha' ? a.targets.flatMap((t) => (t.kind === 'seat' ? [t.seatId] : [])) : []
  );

describe('the Equipment lesson start', () => {
  const state = EQUIPMENT_LESSON.build(registry);

  it('is in the cards group, with six seats so a seat sits three steps away', () => {
    expect(EQUIPMENT_LESSON.group).toBe('cards');
    expect(state.seats).toHaveLength(6);
  });

  it('opens in the beginner’s Play Phase holding a Weapon, an Armor, a Mount and a Sha, with nothing worn', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect([...handOf(state, 'seat-0')].sort()).toEqual(['black-pommel', 'eight-trigrams', 'red-hare', 'sha']);
    expect(equippedOf(state, 'seat-0')).toEqual([]);
  });

  it('leaves the bots with no cards, so nothing can answer the Sha but a pass', () => {
    for (const id of ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5']) expect(handOf(state, id)).toEqual([]);
  });

  it('only lets a Sha reach the seat next to the beginner before any Equipment is worn', () => {
    expect(shaTargets(state).sort()).toEqual(['seat-1', 'seat-5']);
  });
});

describe('what the Equipment changes, as the lesson teaches it', () => {
  const start = EQUIPMENT_LESSON.build(registry);
  const withWeapon = playCard(start, registry, 'seat-0', 'black-pommel');
  const withMount = playCard(start, registry, 'seat-0', 'red-hare');
  const withBoth = playCard(withWeapon, registry, 'seat-0', 'red-hare');

  it('a Weapon alone leaves the seat opposite out of reach: range 2, distance 3', () => {
    expect(shaTargets(withWeapon)).not.toContain('seat-3');
    expect(shaTargets(withWeapon)).toEqual(expect.arrayContaining(['seat-1', 'seat-2', 'seat-4', 'seat-5']));
  });

  it('a Mount alone leaves it out of reach too: range 1, distance 2', () => {
    expect(shaTargets(withMount)).not.toContain('seat-3');
  });

  it('the Weapon and the Mount together bring the seat opposite into reach', () => {
    expect(shaTargets(withBoth)).toContain('seat-3');
  });

  it('the Armor is worn as well after the three plays', () => {
    const all = playCard(withBoth, registry, 'seat-0', 'eight-trigrams');
    expect(equippedOf(all, 'seat-0').sort()).toEqual(['black-pommel', 'eight-trigrams', 'red-hare']);
  });
});

describe('the Equipment lesson steps', () => {
  const step = (id: string) => EQUIPMENT_LESSON.steps.find((s) => s.id === id)!;

  it('plays to the end', () => {
    const played = playLesson(EQUIPMENT_LESSON, registry);
    expect(played.find((s) => !s.ok)).toBeUndefined();
    expect(played).toHaveLength(EQUIPMENT_LESSON.steps.length);
  });

  it('asks for the Weapon, then the Armor, then the Mount, then the Sha, in that order', () => {
    const order = EQUIPMENT_LESSON.steps.filter((s) => s.completes.kind === 'action').map((s) => s.id);
    expect(order).toEqual(['play-weapon', 'play-armor', 'play-mount', 'play-sha']);
  });

  it('spotlights each card and then its Play button, and the Sha’s target seat', () => {
    expect(step('play-weapon').target).toEqual(['play-button:black-pommel', 'hand-card:black-pommel']);
    expect(step('play-armor').target).toEqual(['play-button:eight-trigrams', 'hand-card:eight-trigrams']);
    expect(step('play-mount').target).toEqual(['play-button:red-hare', 'hand-card:red-hare']);
    expect(step('play-sha').target).toEqual(['target-seat:seat-3', 'hand-card:sha']);
    expect(step('play-sha').phone?.target).toEqual(['target-seat:seat-3', 'play-button:sha', 'hand-card:sha']);
  });

  // The beginner's legal play of the `definitionId` card (on `targetSeatId` if it is aimed).
  const playOf = (state: GameState, definitionId: string, targetSeatId?: string) =>
    getLegalActions(state, 'seat-0', registry).find(
      (a) =>
        a.kind === 'PlayCardAction' &&
        definitionOf(state, a.cardInstanceId) === definitionId &&
        (targetSeatId === undefined || (a.targets.length === 1 && a.targets[0].kind === 'seat' && a.targets[0].seatId === targetSeatId))
    )!;

  it('lets through only the card each step asks for', () => {
    const state = EQUIPMENT_LESSON.build(registry);
    expect(allows(step('play-weapon'), playOf(state, 'black-pommel'), state)).toBe(true);
    expect(allows(step('play-weapon'), playOf(state, 'eight-trigrams'), state)).toBe(false);
    expect(allows(step('play-armor'), playOf(state, 'red-hare'), state)).toBe(false);
    expect(allows(step('play-mount'), playOf(state, 'red-hare'), state)).toBe(true);
  });

  it('lets through the Sha at the seat opposite and no other seat', () => {
    let state = EQUIPMENT_LESSON.build(registry);
    for (const card of ['black-pommel', 'eight-trigrams', 'red-hare']) state = playCard(state, registry, 'seat-0', card);
    expect(allows(step('play-sha'), playOf(state, 'sha', 'seat-3'), state)).toBe(true);
    expect(allows(step('play-sha'), playOf(state, 'sha', 'seat-1'), state)).toBe(false);
  });

  it('lets the seat opposite answer with a pass, since it holds no card', () => {
    const hit = step('hit');
    expect(hit.bot?.[0].seatId).toBe('seat-3');
  });
});
