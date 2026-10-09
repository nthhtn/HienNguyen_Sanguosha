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

// Brave Spirit (may): at the start of your Start Phase, if damaged (X = missing
// HP), pick any seat (yourself included). It chooses: draw X then discard 1, or
// draw 1 then discard X.
export const braveSpirit: SkillDefinition = {
  id: 'brave-spirit',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId && isHurt(state, owner.seatId),
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'pick') {
      const x = missingHp(state, owner.seatId);
      if (x < 1 || !isLiving(state, owner.seatId)) return [];
      const seats = [...state.seats].filter((s) => !s.eliminated).sort((a, b) => a.index - b.index).map((s) => s.id);
      return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [skillStep(owner, 'forced', { target: id, x })]) })];
    }
    if (step.step === 'discarded') return discardMoves(state, picked(step));
    const target = step.data?.['target'] as string;
    if (!isLiving(state, target)) return [];
    if (step.step === 'forced') {
      const x = step.data?.['x'] as number;
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          seatId: target,
          targetSeatId: owner.seatId,
          options: [
            { id: 'draw-x', shows: { kind: 'label', text: `Draw ${x}, Then Discard 1` }, effects: [used(owner, 'drew', target), draw(target, x), skillStep(owner, 'discard', { target, n: 1 })] },
            { id: 'draw-1', shows: { kind: 'label', text: `Draw 1, Then Discard ${x}` }, effects: [used(owner, 'drew', target), draw(target, 1), skillStep(owner, 'discard', { target, n: x })] },
          ],
        }),
      ];
    }
    if (step.step === 'discard') {
      const hand = handOf(state, target);
      const n = Math.min(step.data?.['n'] as number, hand.length);
      if (n === 0) return [];
      return [
        selectionOf(state, owner, {
          seatId: target, of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: n, max: n, targetSeatId: owner.seatId,
          then: { kind: 'skill-step', step: skillStep(owner, 'discarded') },
        }),
      ];
    }
    return [];
  },
};

// Charity (may): in your Draw Phase draw 2 more. Then, holding more than 5 hand
// cards, give half of them (rounded down) to the other seat with the fewest
// hand cards (you choose among a tie).
export const charity: SkillDefinition = {
  id: 'charity',
  triggers: [
    atDrawPhase({
      condition: (_state, draw) => draw.count > 0,
      use: (_state, passed, owner) => [{ ...passed, count: passed.count + 2 }, skillStep(owner, 'give')],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const others = otherLivingSeatIds(state, owner.seatId);
    if (step.step === 'give') {
      const hand = handOf(state, owner.seatId);
      if (hand.length <= 5 || others.length === 0) return [];
      const half = Math.floor(hand.length / 2);
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: half, max: half, then: { kind: 'skill-step', step: skillStep(owner, 'to') } })];
    }
    // 'to'
    const cards = picked(step);
    const fewest = Math.min(...others.map((id) => handOf(state, id).length));
    const tied = others.filter((id) => handOf(state, id).length === fewest);
    const moves = (id: string): Effect[] => cards.map((cardInstanceId) => ({ kind: 'MoveCardEffect', cardInstanceId, toZoneId: handZoneId(state, id) }));
    if (tied.length === 1) return [used(owner, 'gave', tied[0]), ...moves(tied[0])];
    return [choiceOf(state, owner, { verb: 'give', options: seatOptions(tied, moves) })];
  },
};

// Cards a seat holds in hand and worn.
const cardCount = (state: GameState, seatId: string) => ownCards(state, seatId, true).length;

// The seats Lu Su can pair with `first`: other living seats (not him, not
// `first`) whose hand size differs, at a difference he can pay in cards.
const alliancePartners = (state: GameState, luSu: string, first: string) =>
  otherLivingSeatIds(state, luSu).filter((id) => {
    const cost = Math.abs(handOf(state, first).length - handOf(state, id).length);
    return id !== first && cost > 0 && cost <= cardCount(state, luSu);
  });

// Alliance (active, once per turn): choose two other seats with different hand
// sizes; discard as many cards as the difference; they swap hands.
export const alliance: SkillDefinition = {
  id: 'alliance',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => otherLivingSeatIds(state, seatId).some((id) => alliancePartners(state, seatId, id).length > 0),
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, {
        of: 'seats',
        eligibleIds: otherLivingSeatIds(state, seatId).filter((id) => alliancePartners(state, seatId, id).length > 0),
        min: 1, max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'second') },
        onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'second') {
      const first = picked(step)[0];
      return [choiceOf(state, owner, { verb: 'pick', targetSeatId: first, options: seatOptions(alliancePartners(state, owner.seatId, first), (second) => [skillStep(owner, 'pay', { first, second })]) })];
    }
    const first = step.data?.['first'] as string;
    const second = step.data?.['second'] as string;
    if (!isLiving(state, first) || !isLiving(state, second) || !isLiving(state, owner.seatId)) return [];
    if (step.step === 'pay') {
      const cost = Math.abs(handOf(state, first).length - handOf(state, second).length);
      if (cost === 0) return [];
      return [
        selectionOf(state, owner, {
          of: 'cards', eligibleIds: ownCards(state, owner.seatId, true).map((c) => c.instanceId), min: cost, max: cost,
          then: { kind: 'skill-step', step: skillStep(owner, 'swap', { first, second }) },
        }),
      ];
    }
    // 'swap'
    const toSecond = handOf(state, first).map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, second) }));
    const toFirst = handOf(state, second).map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, first) }));
    return [...discardMoves(state, picked(step)), used(owner, 'swap-first', first), used(owner, 'swapped', second), ...toSecond, ...toFirst];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
  { id: 'meng-huo', skills: [culprit, resurgence] },
  { id: 'zhu-rong', skills: [giantElephant, intenseEdge] },
  { id: 'sun-jian', skills: [braveSpirit] },
  { id: 'lu-su', skills: [charity, alliance] },
];
