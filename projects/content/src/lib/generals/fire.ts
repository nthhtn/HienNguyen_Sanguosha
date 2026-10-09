import type { ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { competeStart, competeStep } from '../shared/compete';
import { ask, choiceOf, discardMoves, draw, hpOf, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillDamage, skillStep, used } from '../shared/skills';

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

export const FIRE_GENERALS: GeneralSkillSet[] = [
  { id: 'dian-wei', skills: [assault] },
  { id: 'xun-yu', skills: [rouseTheTiger, eternalLoyalty] },
];
