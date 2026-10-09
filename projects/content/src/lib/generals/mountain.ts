import type { CardInstance, CardMovedEvent, CardZone, ContentRegistry, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { cardCountsAs, discardOwed, endFlagOf, requireZoneOfKind, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { CardStep, actedOn, atStep } from '../shared/steps';
import { shaAt } from '../cards/sha';
import { seatCardOptions } from '../shared/choices';
import { equipSlotOf } from '../cards/equipment';
import { suitOf } from '../shared/suits';
import { awakeningAtTurnStart, isAwakened } from '../shared/awaken';
import { farmCount, stashMove } from '../shared/farm';
import {
  ask, atDrawPhase, choiceOf, discardMoves, draw, handZoneId, heal, isHurt, isLiving, on, otherLivingSeatIds, seatOptions, selectionOf, skillStep, used,
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
    if (!isLiving(state, owner.seatId) || suitOf(state, owner.seatId, judged, registry) === 'heart') return [done];
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

export const MOUNTAIN_GENERALS: GeneralSkillSet[] = [
  { id: 'zhang-he', skills: [cleverChange] },
  { id: 'deng-ai', skills: [militaryFarm, strategicPass] },
  { id: 'liu-shan', skills: [pleasure, decentralization, seemFoolish] },
  { id: 'jiang-wei', skills: [instigate, followTheMaster] },
];
