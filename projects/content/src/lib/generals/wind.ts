import type { AbilityUsedEvent, CardPlayedEvent, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, HealEvent, PendingResponse, PhaseChangedEvent, SkillDefinition, Target, UsedCard } from 'engine';
import { drawPileTop, endFlagOf, pileZoneOf, skipFlagOf, usedCardFrom } from 'engine';
import { colourFor, suitOf } from '../shared/suits';
import { JUDGMENT_CHANGERS, nextToChange } from '../shared/judgments';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { abilityKey, actedOn, askAtStep, atStep } from '../shared/steps';
import { ask, choiceOf, discardMoves, draw, equipZoneId, handZoneId, heal, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Wind Generals' skills (stage 8 spec, "Rule text"). Every skill acts for
// the `owner` the engine passes in: the same General can sit at two seats in
// tests, so a skill must never find "its" seat by searching for its id.

// Entrench (may): at the start of your End Phase, you may turn your seat face
// down and draw 3 cards.
export const entrench: SkillDefinition = {
  id: 'entrench',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'End' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'TurnFaceDownEffect', seatId: owner.seatId }, draw(owner.seatId, 3)])],
    }),
  ],
};

// Godspeed's Sha: no physical card, outside the Sha limit.
export const GODSPEED_SHA: UsedCard = { as: 'sha', colour: 'none', physical: [] };

// The seats a Sha of `seatId` may target, ignoring distance.
const anyShaTarget = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => !untargetableBy(state, id, 'sha', registry));

// The Equipment cards `seatId` holds or wears.
const equipmentOf = (state: GameState, seatId: string, registry: ContentRegistry) => [
  ...handOf(state, seatId).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment'),
  ...(state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []),
];

// Godspeed (may; each option at most once per turn): skip your Judgment and
// Draw Phases (asked as the turn starts, since the Judgment Phase judges on
// entry), or skip your Play Phase and discard an Equipment card (asked as it
// begins). Either way you use a Sha on any seat a Sha may target, ignoring
// distance.
export const godspeed: SkillDefinition = {
  id: 'godspeed',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) => event.phase === 'Start' && event.seatId === owner.seatId && anyShaTarget(state, owner.seatId, registry).length > 0,
      effect: (_state, _event, owner) => [
        ask(owner, [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Judgment') }, { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Draw') }, skillStep(owner, 'sha')]),
      ],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) =>
        event.phase === 'Play' && event.seatId === owner.seatId && equipmentOf(state, owner.seatId, registry).length > 0 && anyShaTarget(state, owner.seatId, registry).length > 0,
      effect: (state, _event, owner, registry) => [
        ask(owner, [
          selectionOf(state, owner, {
            of: 'cards', eligibleIds: equipmentOf(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
            then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [],
          }),
        ]),
      ],
    }),
  ],
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'discarded') {
      // The Play Phase ends once the Sha is done (endFlagOf).
      return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), { kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }, skillStep(owner, 'sha')];
    }
    const targets = anyShaTarget(state, owner.seatId, registry);
    const shaAt = (seatId: string): Effect[] => [{ kind: 'UseCardEffect', seatId: owner.seatId, card: GODSPEED_SHA, targets: [{ kind: 'seat', seatId }] }];
    return targets.length > 0 && isLiving(state, owner.seatId) ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(targets, shaAt) })] : [];
  },
};

const hpOf = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId)?.combinedHp ?? 0;

// Strong Bow (may): in your turn, after your Sha targets a seat whose hand size
// is at least your HP, or at most your attack range, you may make it
// unblockable.
export const strongBow: SkillDefinition = {
  id: 'strong-bow',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner, registry) => {
        if (owner.kind !== 'general' || step.userSeatId !== owner.seatId || state.turn.ownerSeatId !== owner.seatId) return false;
        const cards = handOf(state, step.target.seatId).length;
        return cards >= hpOf(state, owner.seatId) || cards <= attackRange(state, owner.seatId, registry);
      },
      effect: (_state, step, owner) => {
        const passed = actedOn(step, owner);
        return [askAtStep(owner, 'strong-bow', step, [used(owner as GeneralOwner, 'unblockable', step.target.seatId), { ...passed, data: { ...passed.data, unblockable: true } }])];
      },
    }),
  ],
};

// Violent Spirit (compulsory): after you deal damage to a seat within your
// attack range (measured after the damage), you recover 1 HP per point dealt.
export const violentSpirit: SkillDefinition = {
  id: 'violent-spirit',
  compulsory: true,
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner, registry) => {
        const { source, target, amount } = event.damage;
        return (
          source?.kind === 'seat' && source.seatId === owner.seatId && target.seatId !== owner.seatId && amount > 0 &&
          seatDistance(state, owner.seatId, target.seatId, registry) <= attackRange(state, owner.seatId, registry)
        );
      },
      effect: (_state, event, owner) => [used(owner), heal(owner.seatId, event.damage.amount)],
    }),
  ],
};

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
type Dying = Extract<Effect, { kind: 'DyingEffect' }>;

// Her hand cards that count as hearts.
const heartsIn = (state: GameState, seatId: string, registry: ContentRegistry) => handOf(state, seatId).filter((c) => suitOf(state, seatId, c, registry) === 'heart');

// Fantasy (may): when damage would be dealt to you, you may discard a heart
// card to move it onto another living seat (same source, amount and cause).
// After it is dealt, that seat draws as many cards as it is missing HP.
export const fantasy: SkillDefinition = {
  id: 'fantasy',
  triggers: [
    on<DamageStep>('before:DamageEffect', {
      condition: (state, step, owner, registry) =>
        step.damage.target.seatId === owner.seatId && step.damage.amount > 0 && !(step.acted ?? []).includes(abilityKey(owner)) &&
        heartsIn(state, owner.seatId, registry).length > 0 && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (state, step, owner, registry) => {
        const passed: DamageStep = { ...step, acted: [...(step.acted ?? []), abilityKey(owner)] };
        const pick = selectionOf(state, owner, {
          of: 'cards', eligibleIds: heartsIn(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'skill-step', step: skillStep(owner, 'discarded', { damage: passed }) }, onCancel: [passed],
        });
        return [ask(owner, [pick], [passed])];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const damage = step.data?.['damage'] as DamageStep;
    if (step.step === 'discarded') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'move', { damage })];
    if (step.step === 'move') {
      const moveTo = (seatId: string): Effect[] => [{ ...damage, damage: { ...damage.damage, target: { kind: 'seat', seatId } } }, skillStep(owner, 'draw', { seatId })];
      return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(otherLivingSeatIds(state, owner.seatId), moveTo) })];
    }
    // 'draw': the seat that took it draws as many cards as it is missing HP.
    const seatId = step.data?.['seatId'] as string;
    const seat = state.seats.find((s) => s.id === seatId);
    const missing = seat && !seat.eliminated ? seat.maxCombinedHp - Math.max(seat.combinedHp, 0) : 0;
    return missing > 0 ? [draw(seatId, missing)] : [];
  },
};

// Beauty (compulsory): your spades count as hearts (suitOf).
export const beauty: SkillDefinition = { id: 'beauty', compulsory: true, modifiers: { suitAs: { spade: 'heart' } } };

// One Refusing Death card: asked, then turned up under the General and checked.
const refusingAsk = (owner: GeneralOwner, dying: Dying, left: number): Effect => ask(owner, [skillStep(owner, 'turn', { dying, left })], [dying]);

// Refusing Death (may): when you would enter the dying round, you may turn the
// top card of the draw pile face up under your General, and again for each
// further point the drop took below 1. A rank already there: the dying round
// goes ahead. Otherwise you stay alive below 0 HP. Each time you recover HP,
// you may discard one of those cards.
export const refusingDeath: SkillDefinition = {
  id: 'refusing-death',
  triggers: [
    on<Dying>('before:DyingEffect', {
      condition: (state, dying, owner) =>
        dying.entering === true && dying.seatId === owner.seatId && !(dying.acted ?? []).includes(abilityKey(owner)) && !!pileZoneOf(state, owner.seatId) && drawPileTop(state, 1).length > 0,
      effect: (_state, dying, owner) => [refusingAsk(owner, { ...dying, acted: [...(dying.acted ?? []), abilityKey(owner)] }, Math.max(1, dying.pointsBelowOne ?? 1))],
    }),
    on<HealEvent>('after:HealEvent', {
      condition: (state, event, owner) => event.target.seatId === owner.seatId && isLiving(state, owner.seatId) && (pileZoneOf(state, owner.seatId)?.cards.length ?? 0) > 0,
      effect: (state, _event, owner) => [
        ask(owner, [
          selectionOf(state, owner, { of: 'cards', eligibleIds: pileZoneOf(state, owner.seatId)!.cards.map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'discard' }, onCancel: [] }),
        ]),
      ],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const dying = step.data?.['dying'] as Dying;
    const left = step.data?.['left'] as number;
    const pile = pileZoneOf(state, owner.seatId);
    if (step.step === 'turn') {
      const [top] = drawPileTop(state, 1);
      if (!top || !pile) return [dying];
      return [{ kind: 'MoveCardEffect', cardInstanceId: top.instanceId, toZoneId: pile.id }, skillStep(owner, 'check', { dying, left, cardInstanceId: top.instanceId })];
    }
    // 'check': a matching rank sends him to the dying round.
    const turned = pile?.cards.find((c) => c.instanceId === step.data?.['cardInstanceId']);
    if (!turned || pile!.cards.some((c) => c.instanceId !== turned.instanceId && c.rank === turned.rank)) return [used(owner, 'matched'), dying];
    return left > 1 ? [refusingAsk(owner, dying, left - 1)] : [used(owner, 'stays-alive')];
  },
};

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;

// Lightning Strike (may): after you play or use a Shan, you may pick any
// living seat. It judges: on a spade it takes 2 plain damage with no source.
export const lightningStrike: SkillDefinition = {
  id: 'lightning-strike',
  triggers: [
    on<CardPlayedEvent>('after:CardPlayedEvent', {
      condition: (_state, event, owner) => event.seatId === owner.seatId && event.card.as === 'shan',
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
    // A worn card's judgment that counts as his Shan (Eight Trigrams) is using one too.
    on<AbilityUsedEvent>('after:AbilityUsedEvent', {
      condition: (_state, event, owner) => event.owner.seatId === owner.seatId && event.outcome === 'counts-as-shan',
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index).map((s) => s.id);
    const judge = (seatId: string): Effect[] => [{ kind: 'JudgeEffect', seatId, reader: { kind: 'skill', owner } }];
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(living, judge) })];
  },
  onJudged: (state, { owner, seatId, judged, done }, registry) =>
    suitOf(state, seatId, judged, registry) === 'spade' && isLiving(state, seatId)
      ? [done, { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId }, amount: 2, nature: 'normal', cause: { skillId: owner.skillId } } }]
      : [done],
};

// The black cards in a seat's hand and equipment (Dark Magic's).
const blackCards = (state: GameState, seatId: string, registry: ContentRegistry) => ownCards(state, seatId, true).filter((c) => colourFor(state, seatId, c, registry) === 'black');
JUDGMENT_CHANGERS.set('dark-magic', blackCards);

// Dark Magic (may): when any seat's judgment card is turned up, before it takes
// effect, you may replace it with a black card from your hand or equipment;
// the old card goes into your hand. Ordered with Devil (shared/judgments.ts).
export const darkMagic: SkillDefinition = {
  id: 'dark-magic',
  triggers: [
    on<Shown>('before:JudgmentShownEffect', {
      condition: (state, shown, owner, registry) => nextToChange(state, shown, owner, registry) && blackCards(state, owner.seatId, registry).length > 0,
      effect: (state, shown, owner, registry) => {
        const passed: Shown = { ...shown, acted: [...(shown.acted ?? []), owner.seatId] };
        const pick = selectionOf(state, owner, {
          of: 'cards', eligibleIds: blackCards(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'replace-judgment', judgment: shown.judgment, owner, abilityId: owner.skillId, oldTo: handZoneId(state, owner.seatId) },
          onCancel: [passed], targetSeatId: shown.judgment.seatId,
        });
        return [ask(owner, [pick], [passed], shown.judgment.seatId)];
      },
    }),
  ],
};

// Amber Sky: a Lord skill, inactive in Kingdom War.
export const amberSky: SkillDefinition = { id: 'amber-sky', lord: true };

// The cards Yu Ji may name: every Basic card and non-delayed Tool.
export const BEWILDER_CARDS = ['sha', 'shan', 'peach', 'wine', 'duel', 'draw-two', 'barbarians', 'hail-of-arrows', 'peach-garden', 'steal', 'break', 'harvest', 'coerce', 'wuxie'];

// A Bewilder claim on its way: what was named, at whom, the face-down card,
// the window it answers (set aside meanwhile), and the doubt round so far.
interface Claim {
  as: string;
  conversionId: string;
  targets: Target[];
  cardInstanceId: string;
  window?: PendingResponse;
  order: string[];
  next: number;
  doubters: string[];
}

// Bewilder (in your Play Phase, and to answer a window): you pick a hand card
// face down and name a Basic or non-delayed Tool card you could use now. Each
// other living seat, in turn order, believes or doubts. Then the card is shown:
// nobody doubted, it takes effect as named; doubted and a lie, each doubter
// draws 1 and it is discarded; doubted and true, each doubter loses 1 HP, and it
// takes effect only if it is a heart.
export const bewilder: SkillDefinition = {
  id: 'bewilder',
  conversions: BEWILDER_CARDS.map((as) => ({ id: `bewilder-${as}`, as, cards: 1 as const, when: 'both' as const, deferred: true as const })),
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'deferred') {
      const data = step.data as { as: string; conversionId: string; targets: Target[]; picked: string[]; window?: PendingResponse };
      const claim: Claim = {
        as: data.as, conversionId: data.conversionId, targets: data.targets, cardInstanceId: data.picked[0],
        ...(data.window ? { window: data.window } : {}), order: otherLivingSeatIds(state, owner.seatId), next: 0, doubters: [],
      };
      return [skillStep(owner, 'ask', { claim })];
    }
    const claim = step.data?.['claim'] as Claim;
    if (step.step === 'ask') {
      let i = claim.next;
      while (i < claim.order.length && !isLiving(state, claim.order[i])) i++;
      if (i >= claim.order.length) return [skillStep(owner, 'reveal', { claim })];
      const seatId = claim.order[i];
      const after = (doubters: string[]) => [skillStep(owner, 'ask', { claim: { ...claim, next: i + 1, doubters } })];
      return [
        choiceOf(state, owner, {
          seatId, verb: 'pick', cardId: claim.as,
          options: [
            { id: 'believe', shows: { kind: 'label', text: 'Believe' }, effects: after(claim.doubters) },
            { id: 'doubt', shows: { kind: 'label', text: 'Doubt' }, effects: after([...claim.doubters, seatId]) },
          ],
        }),
      ];
    }
    if (step.step === 'use') {
      // A target that died meanwhile drops out; with none left, the card is discarded.
      const card = handOf(state, owner.seatId).find((c) => c.instanceId === claim.cardInstanceId);
      const reopenAfter: Effect[] = claim.window ? [{ kind: 'OpenResponseEffect', pendingResponse: claim.window }] : [];
      if (!card) return reopenAfter;
      const targets = claim.targets.filter((t) => isLiving(state, t.seatId));
      if (claim.targets.length > 0 && targets.length === 0) return [...discardMoves(state, [card.instanceId]), ...reopenAfter];
      return [{
        kind: 'UseCardEffect', seatId: owner.seatId,
        card: usedCardFrom([card], claim.as, { owner, abilityId: owner.skillId, conversionId: claim.conversionId }),
        targets, counted: !claim.window, ...(claim.window ? { answering: claim.window } : {}),
      }];
    }
    // 'reveal'
    const reopen: Effect[] = claim.window ? [{ kind: 'OpenResponseEffect', pendingResponse: claim.window }] : [];
    const picked = handOf(state, owner.seatId).find((c) => c.instanceId === claim.cardInstanceId);
    if (!picked) return reopen;
    const show: Effect = { kind: 'ShowCardEffect', seatId: owner.seatId, cardInstanceId: picked.instanceId, abilityId: owner.skillId };
    const useIt: Effect = {
      kind: 'UseCardEffect', seatId: owner.seatId,
      card: usedCardFrom([picked], claim.as, { owner, abilityId: owner.skillId, conversionId: claim.conversionId }),
      targets: claim.targets, counted: !claim.window, ...(claim.window ? { answering: claim.window } : {}),
    };
    const discard = [...discardMoves(state, [picked.instanceId]), ...reopen];
    if (claim.doubters.length === 0) return [show, used(owner, 'claim-believed', undefined, claim.as), useIt];
    if (picked.definitionId !== claim.as) return [show, used(owner, 'claim-false', undefined, claim.as), ...claim.doubters.map((id) => draw(id, 1)), ...discard];
    const losses: Effect[] = claim.doubters.map((seatId) => ({ kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId }));
    // A heart still takes effect, once the doubters' HP loss (and any dying round) is over.
    return [show, used(owner, 'claim-true', undefined, claim.as), ...losses, ...(suitOf(state, owner.seatId, picked, registry) === 'heart' ? [skillStep(owner, 'use', { claim })] : discard)];
  },
};

export const WIND_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-ren', skills: [entrench] },
  { id: 'xiahou-yuan', skills: [godspeed] },
  { id: 'huang-zhong', skills: [strongBow] },
  { id: 'wei-yan', skills: [violentSpirit] },
  { id: 'xiao-qiao', skills: [fantasy, beauty] },
  { id: 'zhou-tai', skills: [refusingDeath] },
  { id: 'zhang-jiao', skills: [lightningStrike, darkMagic, amberSky] },
  { id: 'yu-ji', skills: [bewilder] },
];
