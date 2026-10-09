import type { CardInstance, CardsTurnedUpEvent, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { requireZoneOfKind } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { competeStart, competeStep } from '../shared/compete';
import { colourFor } from '../shared/suits';
import { abilityKey } from '../shared/steps';
import { seatCardOptions } from '../shared/choices';
import { shaAt } from '../cards/sha';
import { ask, atDrawPhase, choiceOf, discardMoves, draw, handZoneId, heal, hpOf, isHurt, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Forest Generals' skills (stage 10 spec, "Rule text"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const picked = (step: { data?: Record<string, unknown> }) => (step.data?.['picked'] as string[] | undefined) ?? [];

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
type DiscardZone = Extract<Effect, { kind: 'DiscardZoneEffect' }>;
type ToolResolved = Extract<Effect, { kind: 'ToolResolvedEffect' }>;
type ToolOnTarget = Extract<Effect, { kind: 'ToolOnTargetEffect' }>;

// The HP `seatId` is missing.
const missingHp = (state: GameState, seatId: string) => {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat ? Math.max(0, seat.maxCombinedHp - seat.combinedHp) : 0;
};

// Exaltation and Violent Tyrant: Lord skills, inactive in Kingdom War.
export const exaltation: SkillDefinition = { id: 'exaltation', lord: true };
export const violentTyrant: SkillDefinition = { id: 'violent-tyrant', lord: true };

// Accepts black Basic and Equipment hand cards (as the holder's suits count).
const blackBasicOrEquipment = (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) =>
  colourFor(state, seatId, card, registry) === 'black' && ['basic', 'equipment'].includes(registry.cards.get(card.definitionId)?.category ?? '');

// Blockade: a black Basic or Equipment hand card may be used as Starvation, and
// reaches 1 further (counted while Xu Huang is revealed).
export const blockade: SkillDefinition = {
  id: 'blockade',
  modifiers: { rangeBonusFor: { starvation: 1 } },
  conversions: [{ id: 'blockade', as: 'starvation', cards: 1, accepts: blackBasicOrEquipment, when: 'play' }],
};

// The cards of a seat's hand, equipment and Judgment slot.
const everyCardOf = (state: GameState, seat: { hand: { zoneId: string }; equipped: { zoneId: string }; judgment: { zoneId: string } }) =>
  [seat.hand, seat.equipped, seat.judgment].flatMap(({ zoneId }) => state.zones.find((z) => z.id === zoneId)?.cards ?? []);

// Unnatural Death (may): when another seat dies, take all its hand, equipment
// and Judgment cards instead of letting them be discarded. Asked in front of
// the mode's discard of the dead seat's hand; Use takes the three zones, so
// the discards that follow find nothing, and Don't lets the discard go on.
export const unnaturalDeath: SkillDefinition = {
  id: 'unnatural-death',
  triggers: [
    on<DiscardZone>('before:DiscardZoneEffect', {
      condition: (state, effect, owner) => {
        if (!isLiving(state, owner.seatId) || (effect.acted ?? []).includes(abilityKey(owner))) return false;
        const dead = state.seats.find((s) => s.eliminated && s.hand.zoneId === effect.zoneId);
        return !!dead && dead.id !== owner.seatId && everyCardOf(state, dead).length > 0;
      },
      effect: (state, effect, owner) => {
        const dead = state.seats.find((s) => s.hand.zoneId === effect.zoneId)!;
        const passed: DiscardZone = { ...effect, acted: [...(effect.acted ?? []), abilityKey(owner)] };
        const take: Effect[] = everyCardOf(state, dead).map((c) => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, owner.seatId) }));
        return [ask(owner, [used(owner, 'took-cards', dead.id), ...take], [passed], dead.id)];
      },
    }),
  ],
};

// Exile (may): after you take damage, choose another living seat: it turns
// over (face up if it was down) and draws as many cards as you are now missing
// HP. Once per damage event.
export const exile: SkillDefinition = {
  id: 'exile',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0 && isLiving(state, owner.seatId) && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const missing = missingHp(state, owner.seatId);
    const turnOver = (id: string): Effect =>
      state.seats.find((s) => s.id === id)?.faceDown ? { kind: 'TurnFaceUpEffect', seatId: id } : { kind: 'TurnFaceDownEffect', seatId: id };
    return [
      choiceOf(state, owner, {
        verb: 'pick',
        options: seatOptions(otherLivingSeatIds(state, owner.seatId), (id) => [used(owner, 'exiled', id), turnOver(id), ...(missing > 0 ? [draw(id, missing)] : [])]),
      }),
    ];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
];
