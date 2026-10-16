import { advanceToDecision, resolve, usedCardOf } from 'engine';
import type { Action, CardDefinition, CardInstance, ContentRegistry, Effect, GameModeDefinition, GameState, SkillTrigger } from 'engine';
import { shaCard } from './sha';
import { shanCard } from './shan';
import { wineCard } from './wine';
import { coerceCard } from './coerce';
import { hailOfArrowsCard } from './mass-attack';
import { crossbowCard } from './equipment';
import { CardStep, cardStep } from '../shared/steps';

const wuxie: CardDefinition = { id: 'wuxie', name: 'Wuxie Kongjie', category: 'tool', play: () => [] };
const cards = [shaCard, shanCard, wineCard, coerceCard, hailOfArrowsCard, crossbowCard, wuxie];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
const seenSteps: string[] = [];
// Notes every step of every card, and lets it through unchanged.
const recorder: SkillTrigger = {
  point: 'before:CardStepEffect',
  condition: () => true,
  effect: (_s, step) => {
    seenSteps.push((step as CardStep).step);
    return [step];
  },
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [recorder] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

// Four seats round the table at 4/4 HP; seat-a's Play phase. `cards` fills zones by id.
function table(cards: Record<string, CardInstance[]> = {}, flags?: Record<string, boolean>): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], eliminated: false,
      generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(flags ? { flags } : {}) }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const play = (s: GameState, cardInstanceId: string, ...targets: string[]) => act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;

beforeEach(() => {
  seenSteps.length = 0;
});

describe('Sha steps', () => {
  it('a Sha that hits goes through every step, in order', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('s1', 'sha')] }), 's1', 'seat-b'));
    expect(seenSteps).toEqual(['sha-use', 'sha-targeted', 'sha-armor', 'sha-shan', 'sha-hit', 'sha-damage', 'sha-damaged', 'sha-after-damage']);
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('a Shan counts toward the Shan needed, then the Sha is dodged, with no damage', () => {
    const s = respond(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('d1', 'shan')] }), 's1', 'seat-b'), 'd1');
    expect(seenSteps).toEqual(['sha-use', 'sha-targeted', 'sha-armor', 'sha-shan', 'sha-shan', 'sha-dodged']);
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('the Shan window names the Sha and its user, and shows the damage it would deal, Wine included', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { wine: true }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({
      respondingSeatId: 'seat-b',
      allowedCardIds: ['shan'],
      reason: { kind: 'card-effect', card: { as: 'sha' }, userSeatId: 'seat-a' },
      context: { effect: { kind: 'CardStepEffect', step: 'sha-hit' } },
      outcome: { kind: 'DamageEffect', damage: { amount: 2, target: seat('seat-b') } },
    });
    expect(hp(pass(s), 'seat-b')).toBe(2);
  });

  it('Coerce’s Sha runs on the same steps, from step 1, and isn’t counted', () => {
    // seat-b wears a Crossbow (range 1) and holds a Sha; seat-a Coerces it at seat-c.
    let s = play(table({ 'seat-a:hand': [card('co', 'coerce')], 'seat-b:equip': [card('x', 'crossbow')], 'seat-b:hand': [card('bs', 'sha')] }), 'co', 'seat-b', 'seat-c');
    s = respond(s, 'bs');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(seenSteps).toEqual(['sha-targeted', 'sha-armor', 'sha-shan', 'sha-hit', 'sha-damage', 'sha-damaged', 'sha-after-damage']);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.turn.cardPlays?.['sha'] ?? 0).toBe(0);
  });

  it('a target gone before its steps is skipped', () => {
    const t = table();
    const gone: GameState = {
      ...t,
      seats: t.seats.map((x) => (x.id === 'seat-b' ? { ...x, eliminated: true } : x)),
      resolutionQueue: [cardStep('sha-targeted', usedCardOf(card('s1', 'sha')), 'seat-a', seat('seat-b'))],
    };
    expect(advanceToDecision(gone, ctx).state.pendingResponse).toBeNull();
  });
});

describe('sha-after-damage', () => {
  // Plays a Sha at seat-b under a test-only before-trigger on DamageEffect.
  const withDamageTrigger = (effect: (damage: Effect) => Effect[]) => {
    const trigger: SkillTrigger = { point: 'before:DamageEffect', condition: () => true, effect: (_s, e) => effect(e as Effect) };
    const custom = { registry, mode: { ...mode, triggers: [recorder, trigger] } };
    const s = resolve(table({ 'seat-a:hand': [card('s1', 'sha')] }), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [seat('seat-b')] }, custom).state;
    return resolve(s, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: s.pendingResponse!.id }, custom).state;
  };

  it('runs sha-after-damage when the target took the damage', () => {
    pass(play(table({ 'seat-a:hand': [card('s1', 'sha')] }), 's1', 'seat-b'));
    expect(seenSteps).toContain('sha-after-damage');
  });

  it('skips sha-after-damage when the damage was cancelled', () => {
    const s = withDamageTrigger(() => []);
    expect(hp(s, 'seat-b')).toBe(4);
    expect(seenSteps).not.toContain('sha-after-damage');
  });

  it('skips sha-after-damage when the damage was redirected to another seat', () => {
    const s = withDamageTrigger((e) => {
      const d = (e as Extract<Effect, { kind: 'DamageEffect' }>).damage;
      return [{ ...e, damage: { ...d, target: seat('seat-c') } } as Effect];
    });
    expect(hp(s, 'seat-b')).toBe(4);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(seenSteps).not.toContain('sha-after-damage');
  });
});

describe('Hail of Arrows on steps', () => {
  it('asks each target through a hail-shan step', () => {
    const s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')] }), 'h');
    expect(seenSteps).toEqual(['hail-shan']);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });

  it('opens no window once its Shan is provided', () => {
    const provided = cardStep('hail-shan', usedCardOf(card('h', 'hail-of-arrows')), 'seat-a', seat('seat-b'), { needed: 1, provided: 1 });
    expect(advanceToDecision({ ...table(), resolutionQueue: [provided] }, ctx).state.pendingResponse).toBeNull();
  });
});
