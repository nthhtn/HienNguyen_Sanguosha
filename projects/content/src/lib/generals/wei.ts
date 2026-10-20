import type { CardInstance, ContentRegistry, DamageDealtEvent, Effect, GameState, PhaseChangedEvent, SkillDefinition } from 'engine';
import { livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { abilityKey } from '../shared/steps';
import { nextToChange } from '../shared/judgments';
import { colourFor, suitOf } from '../shared/suits';
import type { GeneralSkillSet } from './types';
import { seatCardOptions } from '../shared/choices';
import { handOf } from '../shared/queries';
import { ask, atDrawPhase, choiceOf, handZoneId, isLiving, lastDrawnBy, on, otherLivingSeatIds, selectionOf, skillDamage, skillStep, used } from '../shared/skills';

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
// What the damage source owes: 2 discards or 1 damage, and just the damage with fewer than 2 hand cards.
const unyieldingCost = (state: GameState, sourceSeatId: string): 'discard-or-damage' | 'damage' => (handOf(state, sourceSeatId).length < 2 ? 'damage' : 'discard-or-damage');

// What a judged card does to the damage source: nothing on a heart (as the owner counts suits) or when
// it is gone; else its cost.
export function unyieldingOutcome(state: GameState, ownerSeatId: string, judged: CardInstance, sourceSeatId: string, registry: ContentRegistry): 'spared' | 'discard-or-damage' | 'damage' {
  if (suitOf(state, ownerSeatId, judged, registry) === 'heart' || !isLiving(state, sourceSeatId)) return 'spared';
  return unyieldingCost(state, sourceSeatId);
}

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
  onJudged: (state, { owner, judged, data, done }, registry) => {
    const sourceSeatId = data?.['sourceSeatId'] as string;
    if (unyieldingOutcome(state, owner.seatId, judged, sourceSeatId, registry) === 'spared') return [done];
    return [done, skillStep(owner, 'outcome', { sourceSeatId })];
  },
  onStep: (state, step) => {
    const { owner } = step;
    const sourceSeatId = step.data?.['sourceSeatId'] as string;
    if (!isLiving(state, sourceSeatId)) return [];
    const damage = skillDamage(owner, sourceSeatId);
    const hand = handOf(state, sourceSeatId);
    if (unyieldingCost(state, sourceSeatId) === 'damage') return [damage];
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

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;
type Done = Extract<Effect, { kind: 'JudgmentDoneEffect' }>;

const inProcessing = (state: GameState, cardInstanceId: string) => requireZoneOfKind(state.zones, 'processing').cards.some((c) => c.instanceId === cardInstanceId);

// Heaven's Envy (may): after a judgment of yours takes effect (Lightning has
// struck), you may take the judged card into your hand instead of discarding it.
export const heavensEnvy: SkillDefinition = {
  id: 'heavens-envy',
  triggers: [
    on<Done>('before:JudgmentDoneEffect', {
      condition: (state, done, owner) =>
        done.judgment.seatId === owner.seatId && !(done.acted ?? []).includes(abilityKey(owner)) && inProcessing(state, done.judgment.card.instanceId),
      effect: (state, done, owner) => {
        const passed: Done = { ...done, acted: [...(done.acted ?? []), abilityKey(owner)] };
        const take: Effect = { kind: 'MoveCardEffect', cardInstanceId: done.judgment.card.instanceId, toZoneId: handZoneId(state, owner.seatId) };
        return [ask(owner, [take, passed], [passed])];
      },
    }),
  ],
};

// Devil (may): when any seat's judgment card is turned up, before it takes
// effect, you may play a hand card to replace it; the old card is discarded.
// Asked in seat order from the judged seat; after a replacement, again from
// the seat after the one that replaced it (shared/judgments.ts).
export const devil: SkillDefinition = {
  id: 'devil',
  triggers: [
    on<Shown>('before:JudgmentShownEffect', {
      condition: (state, shown, owner, registry) => nextToChange(state, shown, owner, registry),
      effect: (state, shown, owner) => {
        const passed: Shown = { ...shown, acted: [...(shown.acted ?? []), owner.seatId] };
        const pick = selectionOf(state, owner, {
          of: 'cards', eligibleIds: handOf(state, owner.seatId).map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'replace-judgment', judgment: shown.judgment, owner, abilityId: owner.skillId },
          onCancel: [passed], targetSeatId: shown.judgment.seatId,
        });
        return [ask(owner, [pick], [passed], shown.judgment.seatId)];
      },
    }),
  ],
};

// Overturned Country (conversion, respond): any black hand card as a Shan.
export const overturnedCountry: SkillDefinition = {
  id: 'overturned-country',
  conversions: [{ id: 'overturned-country', as: 'shan', cards: 1, accepts: (c, state, seatId, registry) => colourFor(state, seatId, c, registry) === 'black', when: 'respond' }],
};

// The ask that starts one River Goddess judgment.
const riverGoddessAsk = (owner: Parameters<typeof ask>[0]): Effect => ask(owner, [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner } }]);

// Black goes to the owner's hand and judges again; the first red card (or an owner who is gone) ends it.
export const riverGoddessOutcome = (state: GameState, ownerSeatId: string, judged: CardInstance, registry: ContentRegistry): 'again' | 'ends' =>
  colourFor(state, ownerSeatId, judged, registry) === 'red' || !isLiving(state, ownerSeatId) ? 'ends' : 'again';

// River Goddess (may): in your Start Phase you may judge again and again: each
// black card goes into your hand and you may judge again; the first red card
// is discarded, and that ends it.
export const riverGoddess: SkillDefinition = {
  id: 'river-goddess',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [riverGoddessAsk(owner)],
    }),
  ],
  onJudged: (state, { owner, judged, done }, registry) => {
    if (riverGoddessOutcome(state, owner.seatId, judged, registry) === 'ends') return [done];
    const keep: Effect = { kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: requireZoneOfKind(state.zones, 'processing').id };
    return [keep, done, riverGoddessAsk(owner)];
  },
};

// The turn flag Bare the Chest sets: this turn, its owner's Sha and Duel deal 1 more.
export const BARE_THE_CHEST_FLAG = 'bare-the-chest';

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;

// Bare the Chest (may): in your Draw Phase you may draw 1 fewer card. If you
// do, damage from your Sha and Duel this turn is 1 greater.
export const bareTheChest: SkillDefinition = {
  id: 'bare-the-chest',
  triggers: [
    atDrawPhase({
      condition: (_state, draw) => draw.count > 0,
      // The flag first: a skill that would replace the draw (Raid) sees it and stays out.
      use: (_state, passed) => [{ kind: 'SetTurnFlagEffect', flag: BARE_THE_CHEST_FLAG }, { ...passed, count: passed.count - 1 }],
    }),
    on<DamageStep>('before:DamageEffect', {
      // Once per damage (`acted`): an ask later in the chain (Fantasy) sends the
      // damage back through these triggers, and it must not grow again.
      condition: (state, { damage, acted }, owner) =>
        !(acted ?? []).includes(abilityKey(owner)) &&
        !!state.turn.flags?.[BARE_THE_CHEST_FLAG] &&
        state.turn.ownerSeatId === owner.seatId &&
        damage.source?.kind === 'seat' &&
        damage.source.seatId === owner.seatId &&
        !damage.chained && ['sha', 'duel'].includes(damage.cause?.card?.as ?? ''),
      // A source-side bonus: fire or thunder damage's original amount (`base`,
      // what a chain passes on) grows too; the chained hits then carry it.
      effect: (_state, step, owner) => [
        {
          ...step,
          damage: { ...step.damage, amount: step.damage.amount + 1, ...(step.damage.base !== undefined ? { base: step.damage.base + 1 } : {}) },
          acted: [...(step.acted ?? []), abilityKey(owner)],
        },
        used(owner, 'more-damage', step.damage.target.seatId),
      ],
    }),
  ],
};

// The other living seats holding a hand card, in turn order.
const raidable = (state: GameState, seatId: string) => otherLivingSeatIds(state, seatId).filter((id) => handOf(state, id).length > 0);

// Raid (may): in your Draw Phase, instead of drawing, you may choose 1 or 2
// other seats that hold hand cards and take 1 random hand card from each, in
// seat order. Cancel at the pick goes back to the draw.
export const raid: SkillDefinition = {
  id: 'raid',
  triggers: [
    atDrawPhase({
      // Not once Bare the Chest has cut this draw: its 1 fewer card must be drawn.
      condition: (state, _draw, owner) => raidable(state, owner.seatId).length > 0 && !state.turn.flags?.[BARE_THE_CHEST_FLAG],
      use: (state, passed, owner) => [
        selectionOf(state, owner, { of: 'seats', eligibleIds: raidable(state, owner.seatId), min: 1, max: 2, then: { kind: 'skill-step', step: skillStep(owner, 'take') }, onCancel: [passed] }),
      ],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const order = livingSeatOrderFrom(state, owner.seatId);
    const picked = [...((step.data?.['picked'] as string[]) ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return picked.flatMap((seatId): Effect[] => [
      { kind: 'MoveRandomCardEffect', fromZoneId: handZoneId(state, seatId), toZoneId: handZoneId(state, owner.seatId) },
      used(owner, 'took-hand-card', seatId),
    ]);
  },
};

export const WEI_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-cao', skills: [evilHero, escort] },
  { id: 'sima-yi', skills: [feedback, devil] },
  { id: 'xiahou-dun', skills: [unyielding] },
  { id: 'guo-jia', skills: [heavensEnvy, bestowedRouse] },
  { id: 'zhen-ji', skills: [overturnedCountry, riverGoddess] },
  { id: 'xu-chu', skills: [bareTheChest] },
  { id: 'zhang-liao', skills: [raid] },
];
