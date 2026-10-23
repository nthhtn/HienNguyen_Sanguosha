import type { CardInstance, CardMovedEvent, ContentRegistry, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { cardsOverHandLimit, skipFlagOf } from 'engine';
import { colourFor, suitOf } from '../shared/suits';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { seatGender } from '../shared/gender';
import { CardStep, actedOn, askAtStep, atStep } from '../shared/steps';
import { shaStep } from '../cards/sha';
import { cancelsCardsOnOwner, SHA_AIMED_STEP } from '../shared/cancel';
import {
  ask, atDrawPhase, choiceOf, discardMoves, draw, equipZoneId, handZoneId, heal, isHurt, isLastMoveOfStep, isLiving, lastMoveBetween, on,
  otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillDamage, skillStep, used,
} from '../shared/skills';

// The Wu base Generals' skills (General Skills spec, "Wu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

// Brave Gesture (may): in your Draw Phase you may draw 1 extra card.
export const braveGesture: SkillDefinition = {
  id: 'brave-gesture',
  triggers: [atDrawPhase({ use: (_state, passed) => [{ ...passed, count: passed.count + 1 }] })],
};

const black = (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) => colourFor(state, seatId, card, registry) === 'black';

// Country Scene (conversion, play): any diamond card from your hand or equipment as a Capture.
export const countryScene: SkillDefinition = {
  id: 'country-scene',
  conversions: [{ id: 'country-scene', as: 'capture', cards: 1, from: 'hand-and-equipment', accepts: (c, state, seatId, registry) => suitOf(state, seatId, c, registry) === 'diamond', when: 'play' }],
};

// Surprise (conversion, play): any black card from your hand or equipment as a Break.
export const surprise: SkillDefinition = {
  id: 'surprise',
  conversions: [{ id: 'surprise', as: 'break', cards: 1, from: 'hand-and-equipment', accepts: black, when: 'play' }],
};

// Humility (compulsory): Steal and Capture can't target you. `cancels` (Alternate): they can, and are
// cancelled for you instead (used, but with no effect on you; a Capture is not placed).
const HUMILITY_CARDS = ['steal', 'capture'];
export function makeHumility(cancels: boolean): SkillDefinition {
  return cancels
    ? { id: 'humility', compulsory: true, triggers: cancelsCardsOnOwner((_state, card) => HUMILITY_CARDS.includes(card.as)) }
    : { id: 'humility', compulsory: true, modifiers: { untargetableBy: HUMILITY_CARDS } };
}
export const humility = makeHumility(false);

// Linked Camps (compulsory): whenever you lose your last hand card, however it
// happens, you draw 1. A whole hand lost in one step (the kill penalty) is one loss: one draw.
export const linkedCamps: SkillDefinition = {
  id: 'linked-camps',
  compulsory: true,
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) =>
        event.fromZoneId === handZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId && handOf(state, owner.seatId).length === 0 && isLastMoveOfStep(state, event),
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 1)],
    }),
  ],
};

// Whether `event` is the last of its instance: one effect resolution that moves one or more cards out of
// `owner`'s equipment. The engine gives events no resolution id, so an instance is a run of moves that
// resolve back to back: a later leaving move already in the log (one effect moving several cards, such
// as a seat's whole equipment area) or queued right behind this one (one discard of several picked
// cards, such as the Axe's two, queues its moves in a row) belongs to the same instance. Only the last
// move of the run is the instance's trigger, so the skill is asked once per instance.
function lastOfInstance(state: GameState, event: CardMovedEvent, ownerSeatId: string): boolean {
  const equip = equipZoneId(state, ownerSeatId);
  const leaves = (e: CardMovedEvent) => e.fromZoneId === equip && e.toZoneId !== equip;
  const at = state.log.lastIndexOf(event);
  const laterInLog = at >= 0 && state.log.slice(at + 1).some((e) => e.kind === 'CardMovedEvent' && leaves(e));
  if (laterInLog) return false;
  const inEquip = state.zones.find((z) => z.id === equip)?.cards ?? [];
  for (const item of state.resolutionQueue ?? []) {
    if (item.kind !== 'MoveCardEffect') break;
    if (item.toZoneId !== equip && inEquip.some((c) => c.instanceId === item.cardInstanceId)) return false;
  }
  return true;
}

// Armed Consorts. 'per-card-compulsory' (Default, compulsory): each time a card leaves your equipment
// (replaced, taken, discarded, or used through a conversion), you draw 2. 'per-instance-may'
// (Alternate Warrior Lady, may): once per instance of cards leaving your equipment (see lastOfInstance),
// you may draw 2, asked each time.
export const makeArmedConsorts = (mode: 'per-card-compulsory' | 'per-instance-may'): SkillDefinition => ({
  id: 'armed-consorts',
  ...(mode === 'per-card-compulsory' ? { compulsory: true } : {}),
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) =>
        event.fromZoneId === equipZoneId(state, owner.seatId) &&
        event.toZoneId !== event.fromZoneId &&
        (mode === 'per-card-compulsory' || lastOfInstance(state, event, owner.seatId)),
      effect: (_state, _event, owner) =>
        mode === 'per-card-compulsory' ? [used(owner), draw(owner.seatId, 2)] : [ask(owner, [used(owner), draw(owner.seatId, 2)])],
    }),
  ],
});
export const armedConsorts: SkillDefinition = makeArmedConsorts('per-card-compulsory');

// Self-Restraint (may): if you played or used no Sha this turn, answers
// included, you may skip your Discard Phase. Asked as it begins, and only when
// there is something to discard.
export const selfRestraint: SkillDefinition = {
  id: 'self-restraint',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Discard' &&
        event.seatId === owner.seatId &&
        state.turn.ownerSeatId === owner.seatId &&
        (state.turn.ownerUses?.['sha'] ?? 0) === 0 &&
        cardsOverHandLimit(state, owner.seatId) > 0,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Discard') }])],
    }),
  ],
};

// The state as if `cardInstanceId` were gone (to work out range after a discard).
const without = (state: GameState, cardInstanceId: string): GameState => ({
  ...state,
  zones: state.zones.map((z) => ({ ...z, cards: z.cards.filter((c) => c.instanceId !== cardInstanceId) })),
});

// Where Da Qiao could move the Sha: other living seats in her attack range,
// not its user, that a Sha may target.
function displaceTargets(state: GameState, step: CardStep, ownerSeatId: string, registry: ContentRegistry): string[] {
  const range = attackRange(state, ownerSeatId, registry);
  return otherLivingSeatIds(state, ownerSeatId).filter(
    (id) => id !== step.userSeatId && seatDistance(state, ownerSeatId, id, registry) <= range && !untargetableBy(state, id, 'sha', registry)
  );
}

// The cards she could discard that still leave a seat to move the Sha to.
const spareCards = (state: GameState, step: CardStep, ownerSeatId: string, registry: ContentRegistry) =>
  ownCards(state, ownerSeatId, true)
    .filter((c) => displaceTargets(without(state, c.instanceId), step, ownerSeatId, registry).length > 0)
    .map((c) => c.instanceId);

// Displace (may): when a Sha targets you, you may discard 1 card to move it
// onto another living seat within your attack range (worked out after the
// discard), not its user. It goes on against that seat from its armour check.
export const displace: SkillDefinition = {
  id: 'displace',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner, registry) => owner.kind === 'general' && step.target.seatId === owner.seatId && spareCards(state, step, owner.seatId, registry).length > 0,
      effect: (state, step, owner, registry) => {
        const general = owner as GeneralOwner;
        const passed = actedOn(step, owner);
        const pick = selectionOf(state, general, {
          of: 'cards', eligibleIds: spareCards(state, step, owner.seatId, registry), min: 1, max: 1,
          then: { kind: 'skill-step', step: skillStep(general, 'discarded', { step: passed }) },
          onCancel: [passed], targetSeatId: step.userSeatId,
        });
        return [askAtStep(owner, 'displace', step, [pick], step.userSeatId)];
      },
    }),
  ],
  onStep: (state, s, registry) => {
    const step = s.data?.['step'] as CardStep;
    if (s.step === 'discarded') return [...discardMoves(state, (s.data?.['picked'] as string[]) ?? []), skillStep(s.owner, 'move', { step })];
    const targets = displaceTargets(state, step, s.owner.seatId, registry);
    if (targets.length === 0) return [step];
    // Aimed at the new seat (a skill there may cancel it), then on from the armour check. Iron Cavalry's
    // red judgment was about Da Qiao, so it doesn't follow the Sha.
    const moved = (seatId: string) => {
      const next = shaStep(step, SHA_AIMED_STEP, { then: 'sha-armor' });
      const { unblockable: _ironCavalry, ...data } = next.data ?? {};
      return { ...next, target: { kind: 'seat' as const, seatId }, data };
    };
    const options = seatOptions(targets, (seatId) => [used(s.owner, 'moved', seatId), moved(seatId)]);
    return [choiceOf(state, s.owner, { verb: 'pick', options, targetSeatId: step.userSeatId })];
  },
};

// Battered Body (active, any number of times): lose 1 HP, then draw 2. If that
// leaves you dying, the dying round comes first; you draw only if you survive.
export const batteredBody: SkillDefinition = {
  id: 'battered-body',
  active: {
    canUse: (state, { seatId }) => isLiving(state, seatId),
    start: (_state, { seatId, owner }) => [{ kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId }, skillStep(owner, 'draw')],
  },
  onStep: (state, step) => (isLiving(state, step.owner.seatId) ? [draw(step.owner.seatId, 2)] : []),
};

// Reconsider (active, once per turn): discard any number of cards (at least 1)
// from your hand or equipment, then draw that many. Default has no limit; the
// Alternate Balance of Power variant caps the cards discarded at `limit(state, seatId)`.
export const makeReconsider = (limit?: (state: GameState, seatId: string) => number): SkillDefinition => ({
  id: 'reconsider',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => ownCards(state, seatId, true).length > 0,
    start: (state, { seatId, owner }) => {
      const cards = ownCards(state, seatId, true).map((c) => c.instanceId);
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: cards, min: 1, max: limit ? Math.min(cards.length, limit(state, seatId)) : cards.length, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] })];
    },
  },
  onStep: (state, step) => {
    const picked = (step.data?.['picked'] as string[]) ?? [];
    return [...discardMoves(state, picked), draw(step.owner.seatId, picked.length)];
  },
});

export const reconsider: SkillDefinition = makeReconsider();

// Rescued: a Lord skill, inactive in Kingdom War.
export const rescued: SkillDefinition = { id: 'rescued', lord: true };

// Other living male seats below their max HP.
const hurtMales = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => isHurt(state, id) && seatGender(state, id, registry) === 'male');

// Marriage (active, once per turn): discard 2 hand cards and choose a male seat
// below its max HP; you and that seat each recover 1 HP.
export const marriage: SkillDefinition = {
  id: 'marriage',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }, registry) => handOf(state, seatId).length >= 2 && hurtMales(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'cards', eligibleIds: handOf(state, seatId).map((c) => c.instanceId), min: 2, max: 2, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] }),
    ],
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'discarded') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'pick')];
    const seats = hurtMales(state, owner.seatId, registry);
    return seats.length > 0 ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [heal(owner.seatId), heal(id)]) })] : [];
  },
};

const SUITS: CardInstance['suit'][] = ['spade', 'heart', 'club', 'diamond'];

// Sow Revolt (active, once per turn, needs a hand card): choose another seat.
// It names a suit, then takes 1 of your hand cards at random, shown to all,
// into its hand. If the card's suit isn't the one it named, it takes 1 damage
// from you.
export const sowRevolt: SkillDefinition = {
  id: 'sow-revolt',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'seats', eligibleIds: otherLivingSeatIds(state, seatId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen') }, onCancel: [] }),
    ],
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    const data = step.data ?? {};
    switch (step.step) {
      case 'chosen': {
        const target = (data['picked'] as string[])[0];
        const options = SUITS.map((suit) => ({ id: suit, shows: { kind: 'suit' as const, suit }, effects: [skillStep(owner, 'named', { target, suit })] }));
        return [choiceOf(state, owner, { seatId: target, targetSeatId: target, verb: 'pick', options })];
      }
      case 'named': {
        const target = data['target'] as string;
        if (!isLiving(state, target) || handOf(state, owner.seatId).length === 0) return [];
        return [{ kind: 'MoveRandomCardEffect', fromZoneId: handZoneId(state, owner.seatId), toZoneId: handZoneId(state, target) }, skillStep(owner, 'taken', data)];
      }
      default: {
        // 'taken': show it, and the damage on a wrong suit.
        const target = data['target'] as string;
        const takenId = lastMoveBetween(state, handZoneId(state, owner.seatId), handZoneId(state, target));
        const taken = handOf(state, target).find((c) => c.instanceId === takenId);
        if (!taken) return [];
        const show = { kind: 'ShowCardEffect' as const, seatId: target, cardInstanceId: taken.instanceId, abilityId: owner.skillId };
        return suitOf(state, target, taken, registry) !== data['suit'] && isLiving(state, target) ? [show, skillDamage(owner, target)] : [show];
      }
    }
  },
};

export const WU_GENERALS: GeneralSkillSet[] = [
  { id: 'da-qiao', skills: [countryScene, displace] },
  { id: 'gan-ning', skills: [surprise] },
  { id: 'huang-gai', skills: [batteredBody] },
  { id: 'lu-meng', skills: [selfRestraint] },
  { id: 'lu-xun', skills: [humility, linkedCamps] },
  { id: 'sun-quan', skills: [reconsider, rescued] },
  { id: 'sun-shangxiang', skills: [marriage, armedConsorts] },
  { id: 'zhou-yu', skills: [braveGesture, sowRevolt] },
];
