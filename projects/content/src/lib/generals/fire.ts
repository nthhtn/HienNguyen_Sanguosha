import type { CardInstance, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { competeStart, competeStep } from '../shared/compete';
import { colourFor, suitOf } from '../shared/suits';
import { abilityKey } from '../shared/steps';
import { eightTrigramsJudged, eightTrigramsTrigger } from '../cards/equipment/eight-trigrams';
import { ask, choiceOf, discardMoves, draw, equipZoneId, hpOf, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillDamage, skillStep, used } from '../shared/skills';

// The Fire Generals' skills (stage 9 spec, "Rule text"). Every skill acts for
// the `owner` the engine passes in: the same General can sit at two seats in
// tests, so a skill must never find "its" seat by searching for its id.

const picked = (step: { data?: Record<string, unknown> }) => (step.data?.['picked'] as string[] | undefined) ?? [];

// The Weapons a seat holds or wears.
const weaponsOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
  ownCards(state, seatId, true).filter((c) => registry.cards.get(c.definitionId)?.equipSlot === 'weapon');

// Other living seats within `seatId`'s attack range, in seat order.
const inRangeOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => seatDistance(state, seatId, id, registry) <= attackRange(state, seatId, registry));

// 1 damage from `sourceSeatId` to `targetSeatId`, caused by `skillId`.
const damageFrom = (sourceSeatId: string, targetSeatId: string, skillId: string): Effect => ({
  kind: 'DamageEffect',
  damage: { source: { kind: 'seat', seatId: sourceSeatId }, target: { kind: 'seat', seatId: targetSeatId }, amount: 1, nature: 'normal', cause: { skillId } },
});

// Assault (active, once per turn): discard a Weapon (hand or worn) or lose 1
// HP; then deal 1 damage to a seat within your attack range, measured after
// the discard. Losing HP to dying: the dying round comes first.
export const assault: SkillDefinition = {
  id: 'assault',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => isLiving(state, seatId) && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }, registry) => {
      const weapons = weaponsOf(state, seatId, registry).map((c) => c.instanceId);
      const payWeapon = selectionOf(state, owner, { of: 'cards', eligibleIds: weapons, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'paid-weapon') } });
      const loseHp: Effect[] = [{ kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId }, used(owner, 'paid-hp'), skillStep(owner, 'strike')];
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          options: [
            ...(weapons.length > 0 ? [{ id: 'discard-weapon', shows: { kind: 'label' as const, text: 'Discard a Weapon' }, effects: [payWeapon] }] : []),
            { id: 'lose-hp', shows: { kind: 'label' as const, text: 'Lose 1 HP' }, effects: loseHp },
          ],
        }),
      ];
    },
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'paid-weapon') return [...discardMoves(state, picked(step)), used(owner, 'paid-weapon'), skillStep(owner, 'strike')];
    // 'strike'
    const seats = inRangeOf(state, owner.seatId, registry);
    if (!isLiving(state, owner.seatId) || seats.length === 0) return [];
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [used(owner, 'struck', id), skillDamage(owner, id)]) })];
  },
};

// Seats with more HP than `seatId` and a hand card to compete with.
const stronger = (state: GameState, seatId: string) =>
  otherLivingSeatIds(state, seatId).filter((id) => hpOf(state, id) > hpOf(state, seatId) && handOf(state, id).length > 0);

// Rouse the Tiger (active, once per turn): compete with a seat with more HP
// than you. Win: pick a seat within its attack range (not itself); it deals 1
// damage to that seat. Lose: it deals 1 damage to you.
export const rouseTheTiger: SkillDefinition = {
  id: 'rouse-the-tiger',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && stronger(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'seats', eligibleIds: stronger(state, seatId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen') }, onCancel: [] }),
    ],
  },
  onStep: (state, step, registry) => {
    const competing = competeStep(state, step);
    if (competing) return competing;
    const { owner } = step;
    if (step.step === 'chosen') return competeStart(state, owner, picked(step)[0], 'result');
    // 'result'
    const target = step.data?.['target'] as string;
    if (!isLiving(state, target)) return [];
    if (!step.data?.['won']) return isLiving(state, owner.seatId) ? [damageFrom(target, owner.seatId, owner.skillId)] : [];
    const victims = inRangeOf(state, target, registry);
    if (victims.length === 0) return [];
    return [choiceOf(state, owner, { verb: 'pick', targetSeatId: target, options: seatOptions(victims, (id) => [damageFrom(target, id, owner.skillId)]) })];
  },
};

// One Eternal Loyalty ask, with `left` points of damage still to answer.
const loyaltyAsk = (owner: GeneralOwner, left: number): Effect => ask(owner, [skillStep(owner, 'pick', { left })]);

// Eternal Loyalty (may, per point of damage you take): pick any living seat,
// you included; it draws until it holds as many hand cards as its max HP.
export const eternalLoyalty: SkillDefinition = {
  id: 'eternal-loyalty',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0 && isLiving(state, owner.seatId),
      effect: (_state, event, owner) => [loyaltyAsk(owner, event.damage.amount)],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const left = (step.data?.['left'] as number | undefined) ?? 1;
    const living = [...state.seats].filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
    const drawUp = (id: string): Effect[] => {
      const seat = state.seats.find((s) => s.id === id)!;
      const short = Math.max(0, seat.maxCombinedHp - handOf(state, id).length);
      return [used(owner, 'drew-up', id), ...(short > 0 ? [draw(id, short)] : []), ...(left > 1 ? [loyaltyAsk(owner, left - 1)] : [])];
    };
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(living.map((s) => s.id), drawUp) })];
  },
};

type Dying = Extract<Effect, { kind: 'DyingEffect' }>;

// Club hand cards (as the seat's suits count).
const clubsIn = (state: GameState, seatId: string, registry: ContentRegistry) => handOf(state, seatId).filter((c) => suitOf(state, seatId, c, registry) === 'club');

// Shackle (active, any number of times): discard a club hand card, then draw 1
// (Chains isn't in the game: the club is recast).
export const shackle: SkillDefinition = {
  id: 'shackle',
  active: {
    canUse: (state, { seatId }, registry) => clubsIn(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, {
        of: 'cards', eligibleIds: clubsIn(state, seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'recast') }, onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => [...discardMoves(state, picked(step)), used(step.owner, 'recast'), draw(step.owner.seatId, 1)],
};

// The seat mark that records Nirvana's one use.
const NIRVANA_MARK = 'nirvana-used';

// Nirvana (may, once per game): when you would enter the dying round, discard
// every card you have (hand, equipment, judgment area), draw 3, recover to 3 HP
// (at most your max HP) and turn face up. You don't enter the dying round.
export const nirvana: SkillDefinition = {
  id: 'nirvana',
  triggers: [
    on<Dying>('before:DyingEffect', {
      condition: (state, dying, owner) =>
        dying.entering === true &&
        dying.seatId === owner.seatId &&
        !(dying.acted ?? []).includes(abilityKey(owner)) &&
        !state.seats.find((s) => s.id === owner.seatId)?.marks?.[NIRVANA_MARK],
      effect: (_state, dying, owner) => {
        const passed: Dying = { ...dying, acted: [...(dying.acted ?? []), abilityKey(owner)] };
        return [ask(owner, [{ kind: 'IncrementEffect', scope: 'seat', seatId: owner.seatId, key: NIRVANA_MARK, by: 1 }, skillStep(owner, 'reborn')], [passed])];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const seat = state.seats.find((s) => s.id === owner.seatId)!;
    const all = state.zones.filter((z) => z.ownerSeatId === owner.seatId && ['hand', 'equip', 'judgment'].includes(z.kind)).flatMap((z) => z.cards.map((c) => c.instanceId));
    const to = Math.min(3, seat.maxCombinedHp);
    return [
      used(owner, 'reborn'),
      ...discardMoves(state, all),
      draw(owner.seatId, 3),
      ...(to > seat.combinedHp ? [{ kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: owner.seatId }, amount: to - seat.combinedHp }] : []),
      { kind: 'TurnFaceUpEffect', seatId: owner.seatId },
    ];
  },
};

// Whether the seat wears armour.
const wearsArmour = (state: GameState, seatId: string, registry: ContentRegistry) =>
  (state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []).some((c) => registry.cards.get(c.definitionId)?.equipSlot === 'armor');

// Eight Arrays (compulsory): while you wear no armour, you have Eight Trigrams'
// ability (shared with the card, Black Pommel included).
export const eightArrays: SkillDefinition = {
  id: 'eight-arrays',
  compulsory: true,
  triggers: [
    eightTrigramsTrigger(
      'eight-arrays',
      (_state, owner) => (owner.kind === 'general' ? { kind: 'skill', owner } : null),
      (state, owner, registry) => !wearsArmour(state, owner.seatId, registry)
    ),
  ],
  onJudged: (state, { owner, judged, data, done }, registry) => eightTrigramsJudged(state, owner, 'eight-arrays', judged, data, done, registry),
};

// Accepts hand cards of one colour (as the holder's suits count).
const ofColour = (colour: 'red' | 'black') => (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) => colourFor(state, seatId, card, registry) === colour;

// Fire Strategy: a red hand card may be played as Blaze.
export const fireStrategy: SkillDefinition = { id: 'fire-strategy', conversions: [{ id: 'fire-strategy', as: 'blaze', cards: 1, accepts: ofColour('red'), when: 'play' }] };

// See Through: a black hand card may be used as Wuxie.
export const seeThrough: SkillDefinition = { id: 'see-through', conversions: [{ id: 'see-through', as: 'wuxie', cards: 1, accepts: ofColour('black'), when: 'respond' }] };

export const FIRE_GENERALS: GeneralSkillSet[] = [
  { id: 'dian-wei', skills: [assault] },
  { id: 'xun-yu', skills: [rouseTheTiger, eternalLoyalty] },
  { id: 'pang-tong', skills: [shackle, nirvana] },
  { id: 'fire-zhuge-liang', skills: [eightArrays, fireStrategy, seeThrough] },
];
