import type { CardInstance, CardMovedEvent, CardZone, ContentRegistry, Effect, GameEvent, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard, DamageDealtEvent, GeneralRevealedEvent, SeatEliminatedEvent } from 'engine';
import { cardCountsAs, discardOwed, endFlagOf, requireZoneOfKind, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { isShaDamage, untargetableBy } from '../shared/abilities';
import { CardStep, actedOn, atStep } from '../shared/steps';
import { shaAt } from '../cards/sha';
import { seatCardOptions } from '../shared/choices';
import { equipSlotOf } from '../cards/equipment';
import { suitOf } from '../shared/suits';
import { awakeningAtTurnStart, isAwakened } from '../shared/awaken';
import { farmCount, stashMove } from '../shared/farm';
import { formSkillOptions } from '../shared/forms';
import { abilityName, generalDisplayData } from '../display';
import {
  ask, atDrawPhase, choiceOf, discardMoves, draw, handZoneId, heal, hpOf, isHurt, isLiving, on, otherLivingSeatIds, seatOptions, selectionOf, skillStep, used,
} from '../shared/skills';

// The Mountain Generals' skills (stage 11 spec, "Rule text"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const picked = (step: { data?: Record<string, unknown> }) => (step.data?.['picked'] as string[] | undefined) ?? [];
const zoneOf = (state: GameState, zoneId: string): CardZone | undefined => state.zones.find((z) => z.id === zoneId);
const cardsIn = (state: GameState, zoneId: string): CardInstance[] => zoneOf(state, zoneId)?.cards ?? [];
const seatOf = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId);

// ── Zhang He: Clever Change ─────────────────────────────────────────────────

interface Move { from: string; to: string; cardId: string }

// Every move Clever Change's Play Phase version could make: a worn card to a
// seat whose slot of that kind is empty, or a delayed Tool to a seat not
// already holding one of that name.
function movesOf(state: GameState): Move[] {
  const living = state.seats.filter((s) => !s.eliminated);
  const moves: Move[] = [];
  for (const from of living) {
    const worn = cardsIn(state, from.equipped.zoneId);
    const judgedZone = zoneOf(state, from.judgment.zoneId);
    for (const to of living) {
      if (to.id === from.id) continue;
      const toWorn = cardsIn(state, to.equipped.zoneId);
      for (const c of worn) {
        const slot = equipSlotOf(c.definitionId);
        if (slot && !toWorn.some((w) => equipSlotOf(w.definitionId) === slot)) moves.push({ from: from.id, to: to.id, cardId: c.instanceId });
      }
      const toJudged = zoneOf(state, to.judgment.zoneId);
      for (const c of judgedZone?.cards ?? []) {
        const name = cardCountsAs(judgedZone!, c);
        if (!(toJudged?.cards ?? []).some((d) => cardCountsAs(toJudged!, d) === name)) moves.push({ from: from.id, to: to.id, cardId: c.instanceId });
      }
    }
  }
  return moves;
}

// Selects the hand card Clever Change costs; `phase` rides on to the 'paid' step.
const payFor = (state: GameState, owner: GeneralOwner, phase: string, onCancel: Effect[] = []): Effect =>
  selectionOf(state, owner, {
    of: 'cards',
    eligibleIds: handOf(state, owner.seatId).map((c) => c.instanceId),
    min: 1,
    max: 1,
    then: { kind: 'skill-step', step: skillStep(owner, 'paid', { phase }) },
    onCancel,
  });

const takeableSeats = (state: GameState, seatId: string) => otherLivingSeatIds(state, seatId).filter((id) => handOf(state, id).length > 0);

// Clever Change (may; each of four phases): as the Judgment, Draw, Play or
// Discard Phase begins, discard a hand card to skip it. Skipping Draw takes a
// hand card from each of up to 2 seats; skipping Play moves a worn card or a
// delayed Tool to another seat. Each is offered only when it can matter.
export const cleverChange: SkillDefinition = {
  id: 'clever-change',
  triggers: [
    // Judgment: asked as the turn starts (the Judgment Phase judges on entry).
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Start' && event.seatId === owner.seatId && cardsIn(state, seatOf(state, owner.seatId)!.judgment.zoneId).length > 0 && handOf(state, owner.seatId).length > 0,
      effect: (state, _event, owner) => [ask(owner, [payFor(state, owner, 'Judgment')])],
    }),
    atDrawPhase({
      condition: (state, draw, owner) => draw.count > 0 && handOf(state, owner.seatId).length > 0 && takeableSeats(state, owner.seatId).length > 0,
      // Cancelling the payment goes back to the draw.
      use: (state, passed, owner) => [payFor(state, owner, 'Draw', [passed])],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Play' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && handOf(state, owner.seatId).length > 0 && movesOf(state).length > 0,
      effect: (state, _event, owner) => [ask(owner, [payFor(state, owner, 'Play')])],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Discard' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && handOf(state, owner.seatId).length > 0 && discardOwed(state, owner.seatId) > 0,
      effect: (state, _event, owner) => [ask(owner, [payFor(state, owner, 'Discard')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const phase = step.data?.['phase'] as string;
    if (step.step === 'paid') {
      const discards = discardMoves(state, picked(step));
      switch (phase) {
        case 'Judgment':
          return [...discards, used(owner, 'skipped-judgment'), { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Judgment') }];
        case 'Discard':
          return [...discards, used(owner, 'skipped-discard'), { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Discard') }];
        case 'Draw': {
          const eligible = takeableSeats(state, owner.seatId);
          return [
            ...discards,
            used(owner, 'skipped-draw'),
            ...(eligible.length > 0
              ? [selectionOf(state, owner, { of: 'seats', eligibleIds: eligible, min: 1, max: 2, then: { kind: 'skill-step', step: skillStep(owner, 'draw-take') }, onCancel: [] })]
              : []),
          ];
        }
        default:
          return [...discards, used(owner, 'skipped-play'), { kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }, skillStep(owner, 'move-from')];
      }
    }
    if (step.step === 'draw-take') {
      return picked(step)
        .filter((id) => isLiving(state, id) && handOf(state, id).length > 0)
        .flatMap((id): Effect[] => [used(owner, 'took-hand-card', id), { kind: 'MoveRandomCardEffect', fromZoneId: handZoneId(state, id), toZoneId: handZoneId(state, owner.seatId) }]);
    }
    const moves = movesOf(state);
    if (step.step === 'move-from') {
      const from = [...new Set(moves.map((m) => m.from))];
      return from.length === 0 ? [] : [selectionOf(state, owner, { of: 'seats', eligibleIds: from, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'move-card') }, onCancel: [] })];
    }
    if (step.step === 'move-card') {
      const from = picked(step)[0];
      const seat = seatOf(state, from);
      if (!seat) return [];
      const cards = [...cardsIn(state, seat.equipped.zoneId), ...cardsIn(state, seat.judgment.zoneId)];
      const options = [...new Set(moves.filter((m) => m.from === from).map((m) => m.cardId))].flatMap((cardId) => {
        const card = cards.find((c) => c.instanceId === cardId);
        return card ? [{ id: cardId, shows: { kind: 'card' as const, card }, effects: [skillStep(owner, 'move-to', { from, cardId })] }] : [];
      });
      return options.length === 0 ? [] : [choiceOf(state, owner, { verb: 'pick', targetSeatId: from, options })];
    }
    if (step.step === 'move-to') {
      const from = step.data?.['from'] as string;
      const cardId = step.data?.['cardId'] as string;
      const source = seatOf(state, from);
      const judgedZone = source && zoneOf(state, source.judgment.zoneId);
      const card = judgedZone?.cards.find((c) => c.instanceId === cardId);
      const targets = [...new Set(moves.filter((m) => m.from === from && m.cardId === cardId).map((m) => m.to))];
      if (targets.length === 0) return [];
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          targetSeatId: from,
          options: seatOptions(targets, (to): Effect[] => {
            const dest = seatOf(state, to)!;
            const as = card ? cardCountsAs(judgedZone!, card) : undefined;
            return [
              used(owner, 'moved-card', to, cardId),
              { kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: card ? dest.judgment.zoneId : dest.equipped.zoneId, ...(card && as !== card.definitionId ? { countsAs: as } : {}) },
            ];
          }),
        }),
      ];
    }
    return [];
  },
};

// ── Deng Ai: Military Farm, Strategic Pass ─────────────────────────────────

// Military Farm (may): when you lose a card from hand or equipment outside your
// own turn, you may judge. A card that is not a heart becomes a Farm in your
// stash. Each Farm is a −1 horse for your distance to others.
// A heart (as the owner counts suits), or an owner who is gone, is discarded; any other card is stashed.
export const militaryFarmOutcome = (state: GameState, ownerSeatId: string, judged: CardInstance, registry: ContentRegistry): 'farm' | 'discard' =>
  !isLiving(state, ownerSeatId) || suitOf(state, ownerSeatId, judged, registry) === 'heart' ? 'discard' : 'farm';

export const militaryFarm: SkillDefinition = {
  id: 'military-farm',
  modifiers: { distanceToOthersFrom: (state, seatId) => -farmCount(state, seatId) },
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) => {
        const seat = seatOf(state, owner.seatId);
        if (!seat?.stash || seat.eliminated || state.turn.ownerSeatId === owner.seatId) return false;
        const own = [seat.hand.zoneId, seat.equipped.zoneId];
        return own.includes(event.fromZoneId) && !own.includes(event.toZoneId);
      },
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner } }])],
    }),
  ],
  // A heart is discarded as usual; any other card goes to the stash first.
  onJudged: (state, { owner, judged, done }, registry) => {
    if (militaryFarmOutcome(state, owner.seatId, judged, registry) === 'discard') return [done];
    return [stashMove(state, owner.seatId, judged.instanceId, requireZoneOfKind(state.zones, 'processing').id), used(owner, 'farmed'), done];
  },
};

// Strategic Pass (awakening): at the start of your turn with 3 or more Farms,
// reduce your max HP by 1 and awaken: from then on a Farm may be used as Steal.
export const strategicPass: SkillDefinition = {
  id: 'strategic-pass',
  compulsory: true,
  awakening: true,
  triggers: [
    awakeningAtTurnStart({
      skillId: 'strategic-pass',
      condition: (state, owner) => farmCount(state, owner.seatId) >= 3,
      effects: (_state, owner) => [{ kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 }],
    }),
  ],
  conversions: [{ id: 'strategic-pass', as: 'steal', cards: 1, from: 'stash', when: 'play', accepts: (_card, state, seatId) => isAwakened(state, seatId, 'strategic-pass') }],
};

// ── Liu Shan ───────────────────────────────────────────────────────────────

const isBasic = (card: CardInstance, registry: ContentRegistry) => registry.cards.get(card.definitionId)?.category === 'basic';

// Pleasure (compulsory): a Sha used on you costs its user another Basic hand
// card, or it has no effect on you. The user may refuse (Cancel): the same.
export const pleasure: SkillDefinition = {
  id: 'pleasure',
  compulsory: true,
  triggers: [
    atStep(['sha-targeted'], {
      condition: (_state, step, owner) => step.card.as === 'sha' && step.target.seatId === owner.seatId && step.userSeatId !== owner.seatId,
      effect: (state, step, owner, registry) => {
        const basics = handOf(state, step.userSeatId).filter((c) => isBasic(c, registry));
        const noEffect = used(owner as GeneralOwner, 'no-effect', step.userSeatId);
        if (basics.length === 0) return [noEffect];
        return [
          selectionOf(state, owner as GeneralOwner, {
            of: 'cards',
            eligibleIds: basics.map((c) => c.instanceId),
            min: 1,
            max: 1,
            seatId: step.userSeatId,
            then: { kind: 'skill-step', step: skillStep(owner as GeneralOwner, 'paid', { sha: actedOn(step, owner) }) },
            onCancel: [noEffect],
          }),
        ];
      },
    }),
  ],
  // Paid: the card is discarded and the Sha goes on, marked so it is not charged again.
  onStep: (state, step) => {
    const sha = step.data?.['sha'] as CardStep;
    return [...discardMoves(state, picked(step)), used(step.owner, 'paid', sha.userSeatId), sha];
  },
};

// Decentralization (may): skip your Play Phase. At the end of your turn
// discard a hand card (if you hold one), then another living seat takes an
// extra turn; the order resumes after you.
export const decentralization: SkillDefinition = {
  id: 'decentralization',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Play' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'SetTurnFlagEffect', flag: 'decentralization' }, { kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }])],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'End' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && !!state.turn.flags?.['decentralization'] && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (state, _event, owner) => {
        const cards = handOf(state, owner.seatId);
        return cards.length === 0
          ? [skillStep(owner, 'pick')]
          : [selectionOf(state, owner, { of: 'cards', eligibleIds: cards.map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') } })];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'discarded') return [...discardMoves(state, picked(step)), skillStep(owner, 'pick')];
    // 'pick': another living seat takes the extra turn.
    const others = otherLivingSeatIds(state, owner.seatId);
    return others.length === 0
      ? []
      : [choiceOf(state, owner, { verb: 'pick', options: seatOptions(others, (id) => [used(owner, 'extra-turn', id), { kind: 'GrantExtraTurnEffect', seatId: id, resumeAfterSeatId: owner.seatId }]) })];
  },
};

// Seem Foolish: a Lord skill, inactive in Kingdom War.
export const seemFoolish: SkillDefinition = { id: 'seem-foolish', lord: true };

// ── Jiang Wei ──────────────────────────────────────────────────────────────

// Seats with `seatId` in their Sha range (a Sha may target him).
const instigateTargets = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter(
    (id) => seatDistance(state, id, seatId, registry) <= attackRange(state, id, registry) && !untargetableBy(state, seatId, 'sha', registry)
  );

// Instigate (active, once per turn): a seat with you in its Sha range must use a
// Sha on you (a window, as Upheaval's); if it does not, you discard one of its
// cards.
export const instigate: SkillDefinition = {
  id: 'instigate',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }, registry) => isLiving(state, seatId) && instigateTargets(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, {
        of: 'seats',
        eligibleIds: instigateTargets(state, seatId, registry),
        min: 1,
        max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'ask') },
        onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    const target = step.data?.['seatId'] ?? picked(step)[0];
    if (step.step === 'ask') {
      if (typeof target !== 'string' || !isLiving(state, target) || !isLiving(state, owner.seatId)) return [];
      return [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: `instigate-${target}-${state.log.length}`,
            respondingSeatId: target,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            allowedCardIds: ['sha'],
            reason: { kind: 'ability', owner, abilityId: owner.skillId, targetSeatId: owner.seatId },
            // No Sha: its user's card is discarded by Jiang Wei.
            context: { effect: skillStep(owner, 'penalty', { seatId: target }) },
            sourceSkill: { owner, step: 'sha', data: { seatId: target } },
          },
        },
      ];
    }
    if (step.step === 'penalty') {
      if (typeof target !== 'string' || !isLiving(state, target) || !isLiving(state, owner.seatId)) return [];
      const options = seatCardOptions(state, target, requireZoneOfKind(state.zones, 'discardPile').id, { judgment: false });
      return options.length === 0 ? [] : [choiceOf(state, owner, { verb: 'discard', targetSeatId: target, options })];
    }
    // 'sha': it answered with a Sha (a real card or a conversion's).
    const answeredBy = step.data?.['answeredBy'] as string;
    const sha = step.data?.['answeredCard'] as UsedCard;
    return isLiving(state, answeredBy) && isLiving(state, owner.seatId) ? shaAt(state, sha, answeredBy, [{ kind: 'seat', seatId: owner.seatId }]) : [];
  },
};

// Follow the Master (awakening): at the start of your turn with no hand cards,
// recover 1 HP (only if hurt) or draw 2, then reduce your max HP by 1 and gain
// Astrology.
export const followTheMaster: SkillDefinition = {
  id: 'follow-the-master',
  compulsory: true,
  awakening: true,
  triggers: [
    awakeningAtTurnStart({
      skillId: 'follow-the-master',
      condition: (state, owner) => handOf(state, owner.seatId).length === 0,
      effects: (state, owner) => {
        const after: Effect[] = [
          { kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 },
          { kind: 'GainSkillEffect', seatId: owner.seatId, slot: owner.slot, skillId: 'astrology' },
        ];
        const hurt = isHurt(state, owner.seatId);
        return hurt
          ? [choiceOf(state, owner, { verb: 'pick', options: [
              { id: 'recover', shows: { kind: 'label', text: 'Recover 1 HP' }, effects: [heal(owner.seatId, 1), ...after] },
              { id: 'draw', shows: { kind: 'label', text: 'Draw 2 Cards' }, effects: [draw(owner.seatId, 2), ...after] },
            ] })]
          : [draw(owner.seatId, 2), ...after];
      },
    }),
  ],
};

// ── Sun Ce ─────────────────────────────────────────────────────────────────

type ToolOnTarget = Extract<Effect, { kind: 'ToolOnTargetEffect' }>;

// Passion (compulsory): you draw 1 card when you use a Duel or a red Sha, or
// when one is used on you (a Sha: once per target).
export const passion: SkillDefinition = {
  id: 'passion',
  compulsory: true,
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner) =>
        step.card.colour === 'red' && (step.userSeatId === owner.seatId || step.target.seatId === owner.seatId) && isLiving(state, (owner as GeneralOwner).seatId),
      // The step goes on, marked so the draw is paid once; the draw follows it.
      effect: (_state, step, owner) => [actedOn(step, owner), used(owner as GeneralOwner, 'drew'), draw((owner as GeneralOwner).seatId, 1)],
    }),
    on<ToolOnTarget>('before:ToolOnTargetEffect', {
      condition: (state, effect, owner) =>
        effect.tool.as === 'duel' && effect.target.kind === 'seat' && (effect.userSeatId === owner.seatId || effect.target.seatId === owner.seatId) && isLiving(state, owner.seatId),
      effect: (_state, effect, owner) => [effect, used(owner, 'drew'), draw(owner.seatId, 1)],
    }),
  ],
};

// Soul Position (awakening): at the start of your turn with exactly 1 HP,
// reduce your max HP by 1 and gain Brave Gesture and Brave Spirit.
export const soulPosition: SkillDefinition = {
  id: 'soul-position',
  compulsory: true,
  awakening: true,
  triggers: [
    awakeningAtTurnStart({
      skillId: 'soul-position',
      condition: (state, owner) => hpOf(state, owner.seatId) === 1,
      effects: (_state, owner) => [
        { kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 },
        { kind: 'GainSkillEffect', seatId: owner.seatId, slot: owner.slot, skillId: 'brave-gesture' },
        { kind: 'GainSkillEffect', seatId: owner.seatId, slot: owner.slot, skillId: 'brave-spirit' },
      ],
    }),
  ],
};

// Takeover: a Lord skill, inactive in Kingdom War.
export const takeover: SkillDefinition = { id: 'takeover', lord: true };

// ── Zhang Zhao and Zhang Hong ──────────────────────────────────────────────

// The seats whose slot for `card` is empty, other than `seatId`.
const freeSlotSeats = (state: GameState, seatId: string, card: CardInstance) => {
  const slot = equipSlotOf(card.definitionId);
  return slot ? otherLivingSeatIds(state, seatId).filter((id) => !cardsIn(state, seatOf(state, id)!.equipped.zoneId).some((w) => equipSlotOf(w.definitionId) === slot)) : [];
};
const equipmentInHand = (state: GameState, seatId: string, registry: ContentRegistry) =>
  handOf(state, seatId).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment' && freeSlotSeats(state, seatId, c).length > 0);

// Direct Instruction (active, any number of times in your Play Phase): place an
// equipment card from your hand in another seat's empty slot, then draw 1.
export const directInstruction: SkillDefinition = {
  id: 'direct-instruction',
  active: {
    canUse: (state, { seatId }, registry) => isLiving(state, seatId) && equipmentInHand(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, {
        of: 'cards',
        eligibleIds: equipmentInHand(state, seatId, registry).map((c) => c.instanceId),
        min: 1,
        max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'to') },
        onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    const card = handOf(state, owner.seatId).find((c) => c.instanceId === picked(step)[0]);
    if (!card) return [];
    const seats = freeSlotSeats(state, owner.seatId, card);
    return seats.length === 0
      ? []
      : [
          choiceOf(state, owner, {
            verb: 'pick',
            options: seatOptions(seats, (to) => [
              used(owner, 'placed', to, card.instanceId),
              { kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: seatOf(state, to)!.equipped.zoneId },
              draw(owner.seatId, 1),
            ]),
          }),
        ];
  },
};

// The cards `seatId` discarded in its latest Discard Phase that still lie in the discard pile.
function discardedInDiscardPhase(state: GameState, seatId: string): string[] {
  let start = -1;
  state.log.forEach((e, i) => {
    if (e.kind === 'PhaseChangedEvent' && e.phase === 'Discard' && e.seatId === seatId) start = i;
  });
  if (start === -1) return [];
  const seat = seatOf(state, seatId);
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const stillThere = new Set(cardsIn(state, discardPileId).map((c) => c.instanceId));
  return state.log
    .slice(start)
    .flatMap((e) => (e.kind === 'CardMovedEvent' && seat && e.fromZoneId === seat.hand.zoneId && e.toZoneId === discardPileId && stillThere.has(e.cardInstanceId) ? [e.cardInstanceId] : []));
}

// Stubborn (may): at the end of another seat's Discard Phase, if it discarded
// 2 or more cards, give one of them back to it and take the others.
export const stubborn: SkillDefinition = {
  id: 'stubborn',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'End' && event.seatId !== owner.seatId && state.turn.ownerSeatId === event.seatId && isLiving(state, event.seatId) && isLiving(state, owner.seatId) &&
        discardedInDiscardPhase(state, event.seatId).length >= 2,
      effect: (state, event, owner) => [ask(owner, [skillStep(owner, 'give', { seat: event.seatId, cards: discardedInDiscardPhase(state, event.seatId) })], [], event.seatId)],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const seat = step.data?.['seat'] as string;
    const discardPile = requireZoneOfKind(state.zones, 'discardPile');
    const cards = ((step.data?.['cards'] as string[] | undefined) ?? []).flatMap((id) => discardPile.cards.filter((c) => c.instanceId === id));
    if (cards.length < 2 || !isLiving(state, seat) || !isLiving(state, owner.seatId)) return [];
    const move = (id: string, to: string): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: id, toZoneId: handZoneId(state, to), onlyFrom: discardPile.id });
    return [
      choiceOf(state, owner, {
        verb: 'pick',
        targetSeatId: seat,
        options: cards.map((card) => ({
          id: card.instanceId,
          shows: { kind: 'card' as const, card },
          effects: [used(owner, 'gave-back', seat), move(card.instanceId, seat), ...cards.filter((c) => c.instanceId !== card.instanceId).map((c) => move(c.instanceId, owner.seatId))],
        })),
      }),
    ];
  },
};

// ── Cai Wenji ──────────────────────────────────────────────────────────────

const ownedCards = (state: GameState, seatId: string) => [...handOf(state, seatId), ...cardsIn(state, seatOf(state, seatId)!.equipped.zoneId)];

// Lament (may): whenever any seat takes damage from a Sha, discard a card; the
// victim then judges: heart it recovers 1 HP, diamond it draws 2, club the
// source discards 2 cards, spade the source turns over.
// What a judged card does, by its suit as the victim counts it: heart heals the victim, diamond has
// it draw 2; club has the damage source discard up to 2 cards, spade turns it face down (or up when
// it is down). Nothing without a living source, or a club source with no cards.
export function lamentOutcome(state: GameState, victimSeatId: string, sourceSeatId: string | undefined, judged: CardInstance, registry: ContentRegistry): 'heal' | 'draw' | 'discard2' | 'discard1' | 'face-down' | 'face-up' | 'none' {
  const suit = suitOf(state, victimSeatId, judged, registry);
  if (suit === 'heart') return 'heal';
  if (suit === 'diamond') return 'draw';
  if (!sourceSeatId || !isLiving(state, sourceSeatId)) return 'none';
  if (suit === 'club') {
    const count = Math.min(2, ownedCards(state, sourceSeatId).length);
    return count === 2 ? 'discard2' : count === 1 ? 'discard1' : 'none';
  }
  return seatOf(state, sourceSeatId)?.faceDown ? 'face-up' : 'face-down';
}

export const lament: SkillDefinition = {
  id: 'lament',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        isShaDamage(event.damage) && event.damage.target.kind === 'seat' && event.damage.amount > 0 && isLiving(state, event.damage.target.seatId) && isLiving(state, owner.seatId) && ownedCards(state, owner.seatId).length > 0,
      effect: (_state, event, owner) => {
        const victim = (event.damage.target as { seatId: string }).seatId;
        const source = event.damage.source?.kind === 'seat' ? event.damage.source.seatId : undefined;
        return [ask(owner, [skillStep(owner, 'pay', { victim, ...(source ? { source } : {}) })], [], victim)];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const victim = step.data?.['victim'] as string;
    const source = step.data?.['source'] as string | undefined;
    if (step.step === 'pay') {
      // The card may be gone by now (spent while a dying round came first).
      const cards = ownedCards(state, owner.seatId);
      if (cards.length === 0 || !isLiving(state, victim)) return [];
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: cards.map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'judge', { victim, ...(source ? { source } : {}) }) }, onCancel: [] })];
    }
    if (step.step === 'judge') {
      return isLiving(state, victim)
        ? [...discardMoves(state, picked(step)), used(owner, 'lamented', victim), { kind: 'JudgeEffect', seatId: victim, reader: { kind: 'skill', owner }, data: { victim, ...(source ? { source } : {}) } }]
        : discardMoves(state, picked(step));
    }
    if (step.step === 'club') {
      if (!source || !isLiving(state, source)) return [];
      const cards = ownedCards(state, source);
      const count = Math.min(2, cards.length);
      return count === 0 ? [] : [selectionOf(state, owner, { of: 'cards', seatId: source, targetSeatId: source, eligibleIds: cards.map((c) => c.instanceId), min: count, max: count, then: { kind: 'discard' } })];
    }
    return [];
  },
  // The judged card goes to the discard pile first; then what its suit does.
  onJudged: (state, { owner, judged, data, done }, registry) => {
    const victim = data?.['victim'] as string;
    const source = data?.['source'] as string | undefined;
    switch (lamentOutcome(state, victim, source, judged, registry)) {
      case 'heal':
        return [done, heal(victim, 1)];
      case 'draw':
        return [done, draw(victim, 2)];
      case 'discard2':
      case 'discard1':
        return [done, skillStep(owner, 'club', { source: source! })];
      case 'face-down':
        return [done, { kind: 'TurnFaceDownEffect', seatId: source! }];
      case 'face-up':
        return [done, { kind: 'TurnFaceUpEffect', seatId: source! }];
      case 'none':
        return [done];
    }
  },
};

// Heartbroken (compulsory): when a seat kills her, that seat loses all its
// skills for the rest of the game. She is out when it acts (afterDeath).
export const heartbroken: SkillDefinition = {
  id: 'heartbroken',
  compulsory: true,
  afterDeath: true,
  triggers: [
    on<SeatEliminatedEvent>('after:SeatEliminatedEvent', {
      condition: (state, event, owner) =>
        event.seatId === owner.seatId && !!event.killerSeatId && event.killerSeatId !== owner.seatId && isLiving(state, event.killerSeatId),
      effect: (_state, event, owner) => [used(owner, 'silenced', event.killerSeatId), { kind: 'SilenceSeatEffect', seatId: event.killerSeatId! }],
    }),
  ],
};

// ── Zuo Ci ─────────────────────────────────────────────────────────────────

// The pick of a Form's skill; secret, since the options name spare Generals.
// The chosen skill takes part in `event`, the one that offered the choice: its
// after-triggers for it fire now (a Start trigger at that Start), once. No
// `event`: a step queued before steps carried it (an older saved game).
function chooseForm(state: GameState, owner: GeneralOwner, registry: ContentRegistry, event?: GameEvent): Effect {
  const slot = seatOf(state, owner.seatId)!.forms!.slot;
  return choiceOf(state, owner, {
    verb: 'pick',
    secret: true,
    options: formSkillOptions(state, owner.seatId, registry).map(({ generalId, skillId }) => ({
      id: `${generalId}/${skillId}`,
      shows: { kind: 'label' as const, text: `${abilityName(skillId)} (${generalDisplayData(generalId)?.name ?? generalId})` },
      effects: [
        { kind: 'ChooseFormSkillEffect' as const, seatId: owner.seatId, generalId, skillId },
        used(owner, 'incarnated'),
        ...(event ? [{ kind: 'FireSkillTriggersEffect' as const, owner: { kind: 'general' as const, seatId: owner.seatId, slot, skillId }, point: `after:${event.kind}` as const, subject: event }] : []),
      ],
    })),
  });
}

// Incarnation (may): he holds 2 Forms (spare Generals, dealt when Generals are
// chosen) and may choose one skill of one of them when he is revealed and at
// the start and end of each of his turns. That Form turns face up; he holds the
// skill, and its gender. Lord, awakening and limited skills cannot be chosen.
export const incarnation: SkillDefinition = {
  id: 'incarnation',
  spareGenerals: 2,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) =>
        (event.phase === 'Start' || event.phase === 'End') && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && formSkillOptions(state, owner.seatId, registry).length > 0,
      effect: (_state, event, owner) => [ask(owner, [skillStep(owner, 'choose', { event })])],
    }),
    // Revealed for any reason but this skill: the first choice.
    on<GeneralRevealedEvent>('after:GeneralRevealedEvent', {
      condition: (state, event, owner, registry) =>
        !event.onDeath && event.seatId === owner.seatId && event.slot === owner.slot && event.forAbilityId !== 'incarnation' && !seatOf(state, owner.seatId)?.forms?.chosen && formSkillOptions(state, owner.seatId, registry).length > 0,
      effect: (_state, event, owner) => [ask(owner, [skillStep(owner, 'choose', { event })])],
    }),
  ],
  // The secret choice is built only now: the ask itself (public, and queued in the state) names no Form.
  onStep: (state, step, registry) => {
    const { owner } = step;
    return isLiving(state, owner.seatId) && formSkillOptions(state, owner.seatId, registry).length > 0 ? [chooseForm(state, owner, registry, step.data?.['event'] as GameEvent | undefined)] : [];
  },
};

// New Life (compulsory): each point of damage you take deals you one more Form.
export const newLife: SkillDefinition = {
  id: 'new-life',
  compulsory: true,
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0 && isLiving(state, owner.seatId) && (state.spareGenerals ?? []).length > 0,
      effect: (_state, event, owner) => [used(owner, 'new-form'), { kind: 'DealSpareGeneralsEffect', seatId: owner.seatId, slot: owner.slot, count: event.damage.amount }],
    }),
  ],
};

export const MOUNTAIN_GENERALS: GeneralSkillSet[] = [
  { id: 'zhang-he', skills: [cleverChange] },
  { id: 'deng-ai', skills: [militaryFarm, strategicPass] },
  { id: 'liu-shan', skills: [pleasure, decentralization, seemFoolish] },
  { id: 'jiang-wei', skills: [instigate, followTheMaster] },
  { id: 'sun-ce', skills: [passion, soulPosition, takeover] },
  { id: 'zhang-zhao-and-zhang-hong', skills: [directInstruction, stubborn] },
  { id: 'cai-wenji', skills: [lament, heartbroken] },
  { id: 'zuo-ci', skills: [incarnation, newLife] },
];
