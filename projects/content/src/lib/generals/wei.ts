import type { CardInstance, DamageDealtEvent, Effect, GameState, SkillDefinition } from 'engine';
import { requireZoneOfKind } from 'engine';
import type { GeneralSkillSet } from './types';
import { seatCardOptions } from '../shared/choices';
import { handOf } from '../shared/queries';
import { ask, choiceOf, handZoneId, isLiving, lastDrawnBy, on, otherLivingSeatIds, selectionOf, skillDamage, skillStep } from '../shared/skills';

// The Wei base Generals' skills (General Skills spec, "Wei"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const damagedSeatId = (event: DamageDealtEvent) => (event.damage.target.kind === 'seat' ? event.damage.target.seatId : null);

// The living seat other than `ownerSeatId` that dealt the damage, if any.
function otherSource(state: GameState, event: DamageDealtEvent, ownerSeatId: string): string | null {
  const source = event.damage.source;
  return source?.kind === 'seat' && source.seatId !== ownerSeatId && isLiving(state, source.seatId) ? source.seatId : null;
}

// The physical cards behind the damage that still lie in the discard pile or processing.
function takeableCards(state: GameState, event: DamageDealtEvent): CardInstance[] {
  const open = state.zones.filter((z) => z.kind === 'discardPile' || z.kind === 'processing');
  return (event.damage.cause?.card?.physical ?? []).filter((c) => open.some((z) => z.cards.some((x) => x.instanceId === c.instanceId)));
}

// Evil Hero (may): after you take damage caused by a card, you may take that
// card into your hand (both cards of a Serpent Spear Sha). Nothing happens if
// it has already left the discard pile and processing.
export const evilHero: SkillDefinition = {
  id: 'evil-hero',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => damagedSeatId(event) === owner.seatId && takeableCards(state, event).length > 0,
      effect: (state, event, owner) => {
        const hand = handZoneId(state, owner.seatId);
        const from = [requireZoneOfKind(state.zones, 'discardPile').id, requireZoneOfKind(state.zones, 'processing').id];
        // Each card from wherever it lies when Use is picked; a move from the other zone does nothing.
        const takes: Effect[] = takeableCards(state, event).flatMap((c) =>
          from.map((zoneId): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: hand, onlyFrom: zoneId }))
        );
        return [ask(owner, takes)];
      },
    }),
  ],
};

// Escort: a Lord skill, inactive in Kingdom War.
export const escort: SkillDefinition = { id: 'escort', lord: true };

// Feedback (may): after a seat damages you, you may take 1 of its cards: its
// hand as one face-down option, or a worn card. Nothing if it holds none.
export const feedback: SkillDefinition = {
  id: 'feedback',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => {
        const from = otherSource(state, event, owner.seatId);
        return damagedSeatId(event) === owner.seatId && !!from && seatCardOptions(state, from, '', { judgment: false }).length > 0;
      },
      effect: (state, event, owner) => {
        const from = otherSource(state, event, owner.seatId)!;
        return [ask(owner, [skillStep(owner, 'take', { from })], [], from)];
      },
    }),
  ],
  // Which card to take, offered as Use is picked.
  onStep: (state, step) => {
    const from = step.data?.['from'] as string;
    const options = isLiving(state, from) ? seatCardOptions(state, from, handZoneId(state, step.owner.seatId), { judgment: false }) : [];
    return options.length > 0 ? [choiceOf(state, step.owner, { verb: 'take', options, targetSeatId: from })] : [];
  },
};

// Unyielding (may): after another seat damages you, you may judge. If the card
// isn't a heart, that seat discards 2 hand cards or takes 1 damage from you;
// with fewer than 2 hand cards it must take the damage.
export const unyielding: SkillDefinition = {
  id: 'unyielding',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => damagedSeatId(event) === owner.seatId && !!otherSource(state, event, owner.seatId),
      effect: (state, event, owner) => {
        const sourceSeatId = otherSource(state, event, owner.seatId)!;
        return [ask(owner, [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner }, data: { sourceSeatId } }], [], sourceSeatId)];
      },
    }),
  ],
  // The judged card goes to the discard pile first; then the outcome.
  onJudged: (state, { owner, judged, data, done }) => {
    const sourceSeatId = data?.['sourceSeatId'] as string;
    if (judged.suit === 'heart' || !isLiving(state, sourceSeatId)) return [done];
    return [done, skillStep(owner, 'outcome', { sourceSeatId })];
  },
  onStep: (state, step) => {
    const { owner } = step;
    const sourceSeatId = step.data?.['sourceSeatId'] as string;
    if (!isLiving(state, sourceSeatId)) return [];
    const damage = skillDamage(owner, sourceSeatId);
    const hand = handOf(state, sourceSeatId);
    if (hand.length < 2) return [damage];
    const discard = selectionOf(state, owner, {
      seatId: sourceSeatId, targetSeatId: sourceSeatId, of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: 2, max: 2, then: { kind: 'discard' },
    });
    return [
      choiceOf(state, owner, {
        seatId: sourceSeatId,
        targetSeatId: sourceSeatId,
        verb: 'pick',
        options: [
          { id: 'discard', shows: { kind: 'label', text: 'Discard 2 Hand Cards' }, effects: [discard] },
          { id: 'damage', shows: { kind: 'label', text: 'Take 1 Damage' }, effects: [damage] },
        ],
      }),
    ];
  },
};

// Bestowed Rouse (may): for each 1 damage you take, you may draw 2 cards, then
// give any of those 2 to other living seats, in any split (Cancel keeps the rest).
export const bestowedRouse: SkillDefinition = {
  id: 'bestowed-rouse',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (_state, event, owner) => damagedSeatId(event) === owner.seatId && event.damage.amount > 0,
      effect: (_state, event, owner) =>
        Array.from({ length: event.damage.amount }, () => ask(owner, [{ kind: 'DrawCardsEffect', seatId: owner.seatId, count: 2 }, skillStep(owner, 'drawn')])),
    }),
  ],
  // 'drawn': just after the draw; 'give': after each gift. Offers whichever of
  // the drawn cards are still in hand.
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const cards = step.step === 'drawn' ? lastDrawnBy(state, owner.seatId) : (step.data?.['cards'] as string[]);
    const inHand = new Set(handOf(state, owner.seatId).map((c) => c.instanceId));
    const left = cards.filter((id) => inHand.has(id));
    const others = otherLivingSeatIds(state, owner.seatId);
    if (left.length === 0 || others.length === 0) return [];
    return [
      selectionOf(state, owner, {
        of: 'cards', eligibleIds: left, min: 1, max: left.length,
        then: { kind: 'give', toSeatIds: others, then: [skillStep(owner, 'give', { cards })] },
        onCancel: [],
      }),
    ];
  },
};

export const WEI_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-cao', skills: [evilHero, escort] },
  { id: 'sima-yi', skills: [feedback] },
  { id: 'xiahou-dun', skills: [unyielding] },
  { id: 'guo-jia', skills: [bestowedRouse] },
];
