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

// Culprit (compulsory): Barbarians skips you, and the damage another seat's
// Barbarians deals counts as yours.
export const culprit: SkillDefinition = {
  id: 'culprit',
  compulsory: true,
  modifiers: { untargetableBy: ['barbarians'] },
  triggers: [
    on<DamageStep>('before:DamageEffect', {
      // Once per damage (`acted`): an ask later in the chain sends the damage back through here.
      condition: (state, { damage, acted }, owner) =>
        !(acted ?? []).includes(abilityKey(owner)) &&
        damage.cause?.card?.as === 'barbarians' &&
        damage.source?.kind === 'seat' &&
        damage.source.seatId !== owner.seatId &&
        isLiving(state, owner.seatId),
      effect: (_state, step, owner) => [
        { ...step, damage: { ...step.damage, source: { kind: 'seat', seatId: owner.seatId } }, acted: [...(step.acted ?? []), abilityKey(owner)] },
        used(owner, 'culprit', (step.damage.target as { seatId: string }).seatId),
      ],
    }),
  ],
};

// Resurgence (may): in your Draw Phase, if hurt, instead of drawing reveal as
// many cards as you miss HP. Each heart recovers 1 HP and is discarded; the
// rest go to your hand.
export const resurgence: SkillDefinition = {
  id: 'resurgence',
  triggers: [
    atDrawPhase({
      condition: (state, draw, owner) => draw.count > 0 && isHurt(state, owner.seatId),
      use: (state, _passed, owner) => [{ kind: 'RevealToProcessingEffect', count: missingHp(state, owner.seatId) }, skillStep(owner, 'sort')],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const processing = requireZoneOfKind(state.zones, 'processing');
    const turnedUp = [...state.log].reverse().find((e): e is CardsTurnedUpEvent => e.kind === 'CardsTurnedUpEvent');
    const here = new Set(processing.cards.map((c) => c.instanceId));
    const revealed = (turnedUp?.cards ?? []).filter((c) => here.has(c.instanceId));
    const hearts = revealed.filter((c) => c.suit === 'heart');
    const rest = revealed.filter((c) => c.suit !== 'heart');
    return [
      used(owner, 'revealed'),
      ...hearts.map(() => heal(owner.seatId, 1)),
      ...discardMoves(state, hearts.map((c) => c.instanceId)),
      ...rest.map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: processing.id })),
    ];
  },
};

// Giant Elephant (compulsory): another seat's Barbarians skips you; once it has
// finished resolving, you take it into your hand (if it still lies discarded).
export const giantElephant: SkillDefinition = {
  id: 'giant-elephant',
  compulsory: true,
  modifiers: { untargetableBy: ['barbarians'] },
  triggers: [
    on<ToolResolved>('before:ToolResolvedEffect', {
      condition: (state, effect, owner) => {
        const discard = requireZoneOfKind(state.zones, 'discardPile');
        return (
          effect.tool.as === 'barbarians' &&
          effect.seatId !== owner.seatId &&
          isLiving(state, owner.seatId) &&
          effect.tool.physical.some((c) => discard.cards.some((d) => d.instanceId === c.instanceId))
        );
      },
      effect: (state, effect, owner) => {
        const discard = requireZoneOfKind(state.zones, 'discardPile');
        const moves = effect.tool.physical.map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: discard.id }));
        // The first effect stands in for the marker; the log line follows.
        return [...moves, used(owner, 'took-card')];
      },
    }),
  ],
};

// Intense Edge (may): when your Sha damages another seat, compete with it; on a
// win take one of its cards (a hidden hand card, or a worn or Judgment card).
export const intenseEdge: SkillDefinition = {
  id: 'intense-edge',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => {
        const { source, target, amount, cause } = event.damage;
        return (
          source?.kind === 'seat' && source.seatId === owner.seatId &&
          target.kind === 'seat' && target.seatId !== owner.seatId &&
          amount > 0 && cause?.card?.as === 'sha' &&
          isLiving(state, owner.seatId) && isLiving(state, target.seatId) &&
          handOf(state, owner.seatId).length > 0 && handOf(state, target.seatId).length > 0
        );
      },
      effect: (_state, event, owner) => {
        const target = (event.damage.target as { seatId: string }).seatId;
        return [ask(owner, [skillStep(owner, 'start', { target })], [], target)];
      },
    }),
  ],
  onStep: (state, step) => {
    const competing = competeStep(state, step);
    if (competing) return competing;
    const { owner } = step;
    const target = step.data?.['target'] as string;
    if (step.step === 'start') return competeStart(state, owner, target, 'result');
    // 'result'
    if (!step.data?.['won'] || !isLiving(state, target) || !isLiving(state, owner.seatId)) return [];
    const options = seatCardOptions(state, target, handZoneId(state, owner.seatId));
    return options.length > 0 ? [choiceOf(state, owner, { verb: 'take', targetSeatId: target, options })] : [];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
  { id: 'meng-huo', skills: [culprit, resurgence] },
  { id: 'zhu-rong', skills: [giantElephant, intenseEdge] },
];
