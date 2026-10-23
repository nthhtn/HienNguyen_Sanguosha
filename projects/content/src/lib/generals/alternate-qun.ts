import type { CardInstance, CardMovedEvent, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SeatEliminatedEvent, SkillDefinition, UsedCard } from 'engine';
import { discardOwed, endFlagOf, requireZoneOfKind, slotSilenced } from 'engine';
import { seatCardOptions } from '../shared/choices';
import { exposedKingdom, exposedKingdomCounts, ownKingdom, sameKingdomSeatIds } from '../shared/kingdom';
import { abilityKey } from '../shared/steps';
import { handOf } from '../shared/queries';
import { equipSlotOf } from '../cards/equipment';
import { isShaDamage, untargetableBy } from '../shared/abilities';
import { competeStart, competeStep } from '../shared/compete';
import { makeCurtain, makeUpheaval } from './forest';
import { makeEclipseTheMoon, makeSowDiscord } from './qun';
import { horsemanship } from './shu';
import { killedByLivingOther } from './mountain';
import { ask, choiceOf, discardMoves, draw, equipZoneId, handZoneId, isLastMoveOfStep, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// Sorrow (compulsory): when a seat kills her, her player (she is out: afterDeath) chooses the killer's
// Main or Deputy General, and that General loses all its skills for the rest of the game; the other
// keeps its. The options are just Main and Deputy, whether or not the killer's Generals are revealed:
// they name no General and reveal none. A General that already lost its skills is not offered.
// (Default Heartbroken silences the whole seat.)
const SLOT_LABELS = { main: 'Main General', deputy: 'Deputy General' } as const;
const sorrow: SkillDefinition = {
  id: 'alternate:sorrow',
  compulsory: true,
  afterDeath: true,
  triggers: [
    on<SeatEliminatedEvent>('after:SeatEliminatedEvent', {
      condition: (state, event, owner) => {
        const killer = killedByLivingOther(state, event, owner) ? state.seats.find((s) => s.id === event.killerSeatId) : undefined;
        return !!killer?.generals && (['main', 'deputy'] as const).some((slot) => !slotSilenced(killer, slot));
      },
      effect: (state, event, owner) => {
        const killerId = event.killerSeatId!;
        const killer = state.seats.find((s) => s.id === killerId)!;
        const options = (['main', 'deputy'] as const)
          .filter((slot) => !slotSilenced(killer, slot))
          .map((slot) => ({
            id: slot,
            shows: { kind: 'label' as const, text: SLOT_LABELS[slot] },
            effects: [used(owner, `silenced-${slot}`, killerId), { kind: 'SilenceSeatEffect' as const, seatId: killerId, slot }],
          }));
        return [choiceOf(state, owner, { verb: 'pick', secret: true, targetSeatId: killerId, options })];
      },
    }),
  ],
};

// Insanity Axe (may): after his Sha damages a seat (not damage passed along a chain, nor damage from a
// Duel or a skill), once per damage he may pick a card in that seat's equipment area and either move it into
// his own equipment area or discard it. If his matching slot is full, a move replaces it: his old card there
// is discarded first. Asked only while the seat is still living and wears a card.
// A hidden Pan Feng's trigger is wrapped in the engine's reveal ask (withReveal), which then is the one
// ask: its Use reveals her and goes straight to the pick (`revealAsked`). That ask is queued behind any
// dying round too; a before-trigger drops it if by then the victim is out or wears nothing, so she is
// never asked to reveal for nothing.
const wornOf = (state: GameState, seatId: string): CardInstance[] => state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? [];
const axeVictimValid = (state: GameState, victim: string): boolean => isLiving(state, victim) && wornOf(state, victim).length > 0;
type AskStep = Extract<Effect, { kind: 'AskUseEffect' }>;
type SkillStep = Extract<Effect, { kind: 'SkillStepEffect' }>;
const generalHidden = (state: GameState, owner: GeneralOwner): boolean =>
  !state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].revealed;

const insanityAxe: SkillDefinition = {
  id: 'alternate:insanity-axe',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => {
        const { damage } = event;
        return isShaDamage(damage) &&
        damage.source?.kind === 'seat' && damage.source.seatId === owner.seatId &&
        damage.target.kind === 'seat' && damage.target.seatId !== owner.seatId &&
        isLiving(state, owner.seatId) && isLiving(state, damage.target.seatId) && wornOf(state, damage.target.seatId).length > 0;
      },
      effect: (state, event, owner) => {
        const victim = (event.damage.target as { seatId: string }).seatId;
        return [skillStep(owner, 'ask', { victim, ...(generalHidden(state, owner) ? { revealAsked: true } : {}) })];
      },
    }),
    // The reveal ask wrapping a hidden Pan Feng's step: dropped when the victim no longer qualifies.
    on<AskStep>('before:AskUseEffect', {
      condition: (state, ask, owner) => {
        if (ask.owner.kind !== 'general' || ask.owner.seatId !== owner.seatId || ask.owner.slot !== owner.slot || ask.abilityId !== owner.skillId) return false;
        const step = ask.effects.find((e): e is SkillStep => e.kind === 'SkillStepEffect' && e.step === 'ask');
        return !!step && !axeVictimValid(state, step.data?.['victim'] as string);
      },
      effect: () => [],
    }),
  ],
  // 'pick': which of the victim's worn cards; 'handle': move it or discard it.
  onStep: (state, step) => {
    const { owner } = step;
    const victim = step.data?.['victim'] as string;
    if (!isLiving(state, owner.seatId)) return [];
    // 'ask': runs once the damage and any dying round are over; a victim that died (its cards gone) is not asked.
    // After the reveal ask (`revealAsked`) she has already said Use: straight to the pick.
    if (step.step === 'ask') {
      if (!axeVictimValid(state, victim)) return [];
      const pick = skillStep(owner, 'pick', { victim });
      return step.data?.['revealAsked'] ? [pick] : [ask(owner, [pick], [], victim)];
    }
    if (step.step === 'pick') {
      const worn = wornOf(state, victim);
      if (!axeVictimValid(state, victim)) return [];
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          targetSeatId: victim,
          options: worn.map((c) => ({ id: c.instanceId, shows: { kind: 'card' as const, card: c }, effects: [skillStep(owner, 'handle', { victim, cardId: c.instanceId })] })),
        }),
      ];
    }
    const cardId = step.data?.['cardId'] as string;
    const card = wornOf(state, victim).find((c) => c.instanceId === cardId);
    if (!card) return [];
    const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
    const slot = equipSlotOf(card.definitionId);
    const old = slot ? wornOf(state, owner.seatId).find((c) => equipSlotOf(c.definitionId) === slot) : undefined;
    const move: Effect[] = [
      ...(old ? [{ kind: 'MoveCardEffect' as const, cardInstanceId: old.instanceId, toZoneId: discardPileId }] : []),
      { kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: equipZoneId(state, owner.seatId) },
    ];
    return [
      choiceOf(state, owner, {
        verb: 'pick',
        targetSeatId: victim,
        options: [
          { id: 'move-card', shows: { kind: 'label', text: 'Move It to Your Equipment Area' }, effects: [used(owner, 'used', victim, cardId), ...move] },
          { id: 'discard-card', shows: { kind: 'label', text: 'Discard It' }, effects: [used(owner, 'used', victim, cardId), { kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: discardPileId }] },
        ],
      }),
    ];
  },
};

// Deathly Counsel (may): whenever he loses his last hand card, however it happens, he may discard 1
// card of another seat, from its hand or equipment area (not its judgment area). Not asked when no other
// living seat has such a card. Once per loss: a whole hand taken in one step asks once (isLastMoveOfStep).
const discardableSeats = (state: GameState, seatId: string): string[] =>
  otherLivingSeatIds(state, seatId).filter((id) => seatCardOptions(state, id, '', { judgment: false }).length > 0);

const deathlyCounsel: SkillDefinition = {
  id: 'alternate:deathly-counsel',
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) =>
        event.fromZoneId === handZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId && handOf(state, owner.seatId).length === 0 &&
        isLastMoveOfStep(state, event) && isLiving(state, owner.seatId) && discardableSeats(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  // 'pick': which seat; 'card': which of its cards.
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    if (step.step === 'pick') {
      const seats = discardableSeats(state, owner.seatId);
      return seats.length === 0 ? [] : [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (seatId) => [skillStep(owner, 'card', { seatId })]) })];
    }
    const seatId = step.data?.['seatId'] as string;
    if (!isLiving(state, seatId)) return [];
    const options = seatCardOptions(state, seatId, requireZoneOfKind(state.zones, 'discardPile').id, { judgment: false });
    if (options.length === 0) return [];
    return [
      choiceOf(state, owner, { verb: 'discard', targetSeatId: seatId, options: options.map((o) => ({ ...o, effects: [used(owner, 'used', seatId), ...o.effects] })) }),
    ];
  },
};

// With the Tide (compulsory): when another seat enters dying and the damage source is a seat of his
// Kingdom (himself included), he draws 1. When another seat of his Kingdom dies, he loses 1 HP. Kingdoms
// are exposed ones (a source with both Generals hidden is in none, unless it is he himself, who reveals on
// use; a death reveals the seat first).
// His own Kingdom is the seat's, else his General's (a hidden General's compulsory skill asks to reveal).
// The draw comes as the seat enters dying, ahead of the rescue asks (a drawn Peach can save it): a
// before-trigger on the entering DyingEffect, once per entry (`acted`), that draws and lets it go on.
type Dying = Extract<Effect, { kind: 'DyingEffect' }>;
const withTheTide: SkillDefinition = {
  id: 'alternate:with-the-tide',
  compulsory: true,
  triggers: [
    on<Dying>('before:DyingEffect', {
      condition: (state, dying, owner, registry) => {
        if (dying.entering !== true || dying.seatId === owner.seatId || !dying.killerSeatId || (dying.acted ?? []).includes(abilityKey(owner))) return false;
        const seat = state.seats.find((s) => s.id === dying.seatId);
        if (!seat || seat.eliminated || seat.combinedHp > 0) return false;
        const own = ownKingdom(state, owner, registry);
        return !!own && isLiving(state, owner.seatId) && (dying.killerSeatId === owner.seatId || exposedKingdom(state, dying.killerSeatId) === own);
      },
      effect: (_state, dying, owner) => [used(owner), draw(owner.seatId, 1), { ...dying, acted: [...(dying.acted ?? []), abilityKey(owner)] }],
    }),
    on<SeatEliminatedEvent>('after:SeatEliminatedEvent', {
      condition: (state, event, owner, registry) => {
        const own = ownKingdom(state, owner, registry);
        return !!own && isLiving(state, owner.seatId) && event.seatId !== owner.seatId && exposedKingdom(state, event.seatId) === own;
      },
      effect: (_state, _event, owner) => [used(owner), { kind: 'LoseHpEffect', seatId: owner.seatId, amount: 1, abilityId: owner.skillId }],
    }),
  ],
};

// Celebrity (compulsory): damage to him from a seat with at least one hidden General is reduced by 1, to
// a minimum of 0. Damage with no source is not reduced; neither is damage from a seat whose Generals are
// both revealed (or that has not chosen Generals). Once per damage (`acted`), as an ask later in the
// chain sends the damage back through the before-triggers.
type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
const celebrity: SkillDefinition = {
  id: 'alternate:celebrity',
  compulsory: true,
  triggers: [
    on<DamageStep>('before:DamageEffect', {
      condition: (state, { damage, acted }, owner) => {
        if ((acted ?? []).includes(abilityKey(owner)) || damage.amount <= 0) return false;
        if (damage.target.kind !== 'seat' || damage.target.seatId !== owner.seatId || damage.source?.kind !== 'seat') return false;
        const { seatId } = damage.source;
        const source = state.seats.find((s) => s.id === seatId);
        return !!source?.generals && !(source.generals.main.revealed && source.generals.deputy.revealed);
      },
      // Reduced to 0 there is no damage at all: the step is dropped (no DamageDealtEvent, no after-damage
      // trigger, no chain), only the log line stays.
      effect: (_state, step, owner) => {
        const log = used(owner, 'used', (step.damage.source as { seatId: string }).seatId);
        const amount = step.damage.amount - 1;
        return amount <= 0 ? [log] : [{ ...step, damage: { ...step.damage, amount }, acted: [...(step.acted ?? []), abilityKey(owner)] }, log];
      },
    }),
  ],
};

// Comity (may): cards he discards or loses from his hand or equipment area on their way to the discard
// pile may be given to another living seat instead, who takes them into hand. One ask per instance (one
// effect, or one Discard Phase, however many cards). Cards he used go from his hand to the pile at once,
// behind their CardPlayedEvent, and are left out (see discardedRun). The cards are given back from the pile right after the last move of
// the run (`onlyFrom` leaves any card that has since gone elsewhere alone), so no discard path needs to
// know about the skill: the Discard Phase, a skill cost, Dismantle, a replaced Equipment card.
type MoveStep = Extract<Effect, { kind: 'MoveCardEffect' }>;
const ownCardZones = (state: GameState, seatId: string): string[] => [handZoneId(state, seatId), equipZoneId(state, seatId)];
const isOwnDiscard = (event: { kind: string }, state: GameState, seatId: string, pileId: string): event is CardMovedEvent =>
  event.kind === 'CardMovedEvent' && (event as CardMovedEvent).toZoneId === pileId && ownCardZones(state, seatId).includes((event as CardMovedEvent).fromZoneId);

// The cards of the instance that has just ended: the unbroken run of his discards at the end of the log
// that are still in the pile. A card he uses leaves his hand for the pile at once, right behind its
// CardPlayedEvent, so the cards that event names are left out: using a card is not discarding it.
const discardedRun = (state: GameState, seatId: string): string[] => {
  const pile = requireZoneOfKind(state.zones, 'discardPile');
  const run: string[] = [];
  let i = state.log.length - 1;
  for (; i >= 0 && isOwnDiscard(state.log[i], state, seatId, pile.id); i--) {
    const { cardInstanceId } = state.log[i] as CardMovedEvent;
    if (pile.cards.some((c) => c.instanceId === cardInstanceId)) run.unshift(cardInstanceId);
  }
  const before = state.log[i];
  const usedIds = before?.kind === 'CardPlayedEvent' ? before.card.physical.map((c) => c.instanceId) : [];
  return run.filter((id) => !usedIds.includes(id));
};

const comity: SkillDefinition = {
  id: 'alternate:comity',
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) => {
        const pileId = requireZoneOfKind(state.zones, 'discardPile').id;
        if (!isOwnDiscard(event, state, owner.seatId, pileId) || !isLiving(state, owner.seatId) || otherLivingSeatIds(state, owner.seatId).length === 0) return false;
        // One effect can move several cards in one step (DiscardZoneEffect): only its last event asks.
        if (!isLastMoveOfStep(state, event)) return false;
        // The run goes on while the next effect in the queue is another such discard.
        const next = state.resolutionQueue?.[0] as MoveStep | undefined;
        if (next?.kind === 'MoveCardEffect' && next.toZoneId === pileId && ownCardZones(state, owner.seatId).some((z) => state.zones.find((x) => x.id === z)?.cards.some((c) => c.instanceId === next.cardInstanceId))) return false;
        // The Discard Phase discards one card per action: ask after the last one owed.
        if (state.phase === 'Discard' && state.turn.ownerSeatId === owner.seatId && discardOwed(state, owner.seatId) > 0) return false;
        return discardedRun(state, owner.seatId).length > 0;
      },
      effect: (state, _event, owner) => [ask(owner, [skillStep(owner, 'pick', { cardIds: discardedRun(state, owner.seatId) })])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const pile = requireZoneOfKind(state.zones, 'discardPile');
    const cardIds = ((step.data?.['cardIds'] as string[]) ?? []).filter((id) => pile.cards.some((c) => c.instanceId === id));
    const others = otherLivingSeatIds(state, owner.seatId);
    if (cardIds.length === 0 || others.length === 0) return [];
    return [
      choiceOf(state, owner, {
        verb: 'give',
        options: seatOptions(others, (seatId) => [
          used(owner, 'used', seatId),
          ...cardIds.map((cardInstanceId): Effect => ({ kind: 'MoveCardEffect', cardInstanceId, toZoneId: handZoneId(state, seatId), onlyFrom: pile.id })),
        ]),
      }),
    ];
  },
};

// The seat mark that records Call of Valour's one use.
const CALL_OF_VALOUR_MARK = 'call-of-valour-used';

// Call of Valour (active, Play Phase, once per game): every living exposed seat of his Kingdom, himself
// first, draws 3. Then, if his Kingdom has the fewest exposed seats of the Kingdoms in play (a tie
// included), he regains 1 HP (nothing at full HP). His Kingdom is his own once the skill has revealed him.
const callOfValour: SkillDefinition = {
  id: 'alternate:call-of-valour',
  limited: true,
  active: {
    canUse: (state, { seatId }, registry) =>
      isLiving(state, seatId) && !state.seats.find((s) => s.id === seatId)?.marks?.[CALL_OF_VALOUR_MARK] &&
      !!ownKingdom(state, { kind: 'general', seatId, slot: 'main', skillId: 'alternate:call-of-valour' }, registry),
    start: (_state, { seatId, owner }) => [
      { kind: 'IncrementEffect', scope: 'seat', seatId, key: CALL_OF_VALOUR_MARK, by: 1 },
      skillStep(owner, 'resolve'),
    ],
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    const own = isLiving(state, owner.seatId) ? ownKingdom(state, owner, registry) : null;
    if (!own) return [];
    const counts = exposedKingdomCounts(state);
    const smallest = (counts.get(own) ?? 0) <= Math.min(...counts.values());
    const seat = state.seats.find((s) => s.id === owner.seatId)!;
    return [
      used(owner),
      ...sameKingdomSeatIds(state, owner.seatId).map((seatId) => draw(seatId, 3)),
      ...(smallest && seat.combinedHp < seat.maxCombinedHp ? [{ kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: owner.seatId }, amount: 1 }] : []),
    ];
  },
};

// Double Edged's Sha: viewed as used, so no card at all (colourless: Black Shield does not stop it).
const DOUBLE_EDGED_SHA: UsedCard = { as: 'sha', colour: 'none', physical: [] };

// Other living seats holding a hand card to compete with.
const competable = (state: GameState, seatId: string) => otherLivingSeatIds(state, seatId).filter((id) => handOf(state, id).length > 0);

// The seats Double Edged's Sha may go at: the loser, or another living seat exposed in the loser's Kingdom
// (a hidden loser has none), never Ji Ling himself, and only seats a Sha may target. Distance is ignored.
const doubleEdgedTargets = (state: GameState, ownerId: string, loser: string, registry: ContentRegistry): string[] => {
  const kingdom = exposedKingdom(state, loser);
  const others = kingdom === null ? [] : otherLivingSeatIds(state, loser).filter((id) => exposedKingdom(state, id) === kingdom);
  return [...(isLiving(state, loser) ? [loser] : []), ...others].filter((id) => id !== ownerId && !untargetableBy(state, id, 'sha', registry, 'none'));
};

// Double Edged (may): at the start of his Play Phase he competes with another seat holding a hand card.
// A win: it is viewed as him using Sha on the loser or on another seat of the loser's Kingdom, with no
// range limit; a full Sha (Shan, Armor, chains), but no card, outside his Sha limit and no Wine (`free`,
// as UseCardEffect gives an uncounted use). Not winning (a tie included): his Play Phase ends.
const doubleEdged: SkillDefinition = {
  id: 'alternate:double-edged',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Play' && event.seatId === owner.seatId && isLiving(state, owner.seatId) && handOf(state, owner.seatId).length > 0 && competable(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  // 'pick': whom to compete with; 'chosen': compete; 'result': the Sha, or the Play Phase ends; 'sha': the Sha at the picked seat.
  onStep: (state, step, registry) => {
    const competing = competeStep(state, step);
    if (competing) return competing;
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    if (step.step === 'pick') {
      const seats = handOf(state, owner.seatId).length > 0 ? competable(state, owner.seatId) : [];
      if (seats.length === 0) return [];
      return [selectionOf(state, owner, { of: 'seats', eligibleIds: seats, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen') }, onCancel: [] })];
    }
    if (step.step === 'chosen') return competeStart(state, owner, ((step.data?.['picked'] as string[]) ?? [])[0], 'result');
    const shaAt = (seatId: string): Effect[] => [{ kind: 'UseCardEffect', seatId: owner.seatId, card: DOUBLE_EDGED_SHA, targets: [{ kind: 'seat', seatId }] }];
    if (step.step === 'result') {
      if (!step.data?.['won']) return [{ kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }];
      const loser = step.data?.['target'] as string;
      const targets = doubleEdgedTargets(state, owner.seatId, loser, registry);
      if (targets.length === 0) return [];
      if (targets.length === 1) return shaAt(targets[0]);
      return [choiceOf(state, owner, { verb: 'pick', targetSeatId: loser, options: seatOptions(targets, shaAt) })];
    }
    return [];
  },
};

// Femme Fatale: in her Play Phase, while this General is hidden, she may expose it at no other cost (an
// active skill that does nothing: using a hidden General's skill reveals it). While it is exposed (and keeps
// its skills), no other seat may expose a General in her turn, by any means (blocksOtherReveals, Task 3's
// engine block); a death's reveal still happens, and her own seat is never blocked.
const femmeFatale: SkillDefinition = {
  id: 'alternate:femme-fatale',
  blocksOtherReveals: true,
  active: {
    canUse: (state, { seatId, owner }) => state.seats.find((s) => s.id === seatId)?.generals?.[owner.slot].revealed === false,
    start: () => [],
  },
};

// Impetus for Conflicts: in her Play Phase, any number of times, she discards an Equipment card (hand or
// worn) and picks another living seat with both Generals exposed, then one of its Generals (named: both
// are exposed), which is hidden again. The use counts once the card is picked (Cancel there undoes it);
// the discard and the hiding happen at the last pick, once the card is still hers and the seat still fits.
// The hidden General can be exposed again by the normal reveal conditions. The pick is a secret choice:
// its log line would otherwise name a General that is hidden from then on.
const equipmentOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
  ownCards(state, seatId, true).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment');
const fullyExposedOthers = (state: GameState, seatId: string) =>
  otherLivingSeatIds(state, seatId).filter((id) => {
    const generals = state.seats.find((s) => s.id === id)?.generals;
    return !!generals && generals.main.revealed && generals.deputy.revealed;
  });

const impetusForConflicts: SkillDefinition = {
  id: 'alternate:impetus-for-conflicts',
  active: {
    canUse: (state, { seatId }, registry) => equipmentOf(state, seatId, registry).length > 0 && fullyExposedOthers(state, seatId).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, {
        of: 'cards', eligibleIds: equipmentOf(state, seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [],
      }),
    ],
  },
  // 'discarded': which seat; 'chosen': which of its Generals; 'hide': discard the card and hide it.
  onStep: (state, step, registry) => {
    const { owner } = step;
    const data = step.data ?? {};
    if (!isLiving(state, owner.seatId)) return [];
    if (step.step === 'discarded') {
      const cardId = (data['picked'] as string[])[0];
      const seats = fullyExposedOthers(state, owner.seatId);
      return seats.length === 0 ? [] : [selectionOf(state, owner, { of: 'seats', eligibleIds: seats, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen', { cardId }) }, onCancel: [] })];
    }
    const cardId = data['cardId'] as string;
    const target = step.step === 'chosen' ? (data['picked'] as string[])[0] : (data['target'] as string);
    const generals = state.seats.find((s) => s.id === target)?.generals;
    if (!fullyExposedOthers(state, owner.seatId).includes(target) || !generals || !equipmentOf(state, owner.seatId, registry).some((c) => c.instanceId === cardId)) return [];
    if (step.step === 'chosen') {
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          secret: true,
          targetSeatId: target,
          options: (['main', 'deputy'] as const).map((slot) => ({
            id: slot,
            shows: { kind: 'general' as const, generalId: generals[slot].generalDefinitionId },
            effects: [skillStep(owner, 'hide', { cardId, target, slot })],
          })),
        }),
      ];
    }
    const slot = data['slot'] as 'main' | 'deputy';
    return [...discardMoves(state, [cardId]), used(owner, 'used', target), { kind: 'HideGeneralEffect', seatId: target, slot }];
  },
};

// Alternate Qun skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_QUN_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  'diao-chan': {
    // Seed of Animosity: the Duel it makes cannot be answered by Wuxie or Wuxie Kingdom.
    离间: { ...makeSowDiscord(false), id: 'alternate:seed-of-animosity' },
    // Envious Moon: asked whether to draw 1 at the start of the End Phase (Default: compulsory).
    闭月: { ...makeEclipseTheMoon(true), id: 'alternate:envious-moon' },
  },
  // Sorrow: the killer loses one General's skills, Main or Deputy as her player chooses (Default: the whole seat).
  'cai-wenji': { 断肠: sorrow },
  // Insanity Axe: Pan Feng is new to Alternate (Default has no such General).
  'pan-feng': { 狂斧: insanityAxe },
  // Deathly Counsel, With the Tide: Tian Feng is new to Alternate (Default has no such General).
  'tian-feng': { 死谏: deathlyCounsel, 随势: withTheTide },
  // Celebrity, Comity: Kong Rong is new to Alternate (Default has no such General).
  'kong-rong': { 名士: celebrity, 礼让: comity },
  // Horsemanship, Call of Valour: Ma Teng is new to Alternate (Default has no such General); his Horsemanship is Ma Chao's.
  // Double Edged: Ji Ling is new to Alternate (Default has no such General).
  'ji-ling': { 双刃: doubleEdged },
  'ma-teng': { 马术: { ...horsemanship, id: 'alternate:horsemanship' }, 雄异: callOfValour },
  // Behind the Curtain: he can be chosen by black Tools, which are cancelled for him (Default: can't be chosen).
  // Descend into Chaos: each seat must pick among the nearest seats (Default: any seat in its attack range).
  'jia-xu': { 帷幕: { ...makeCurtain(true), id: 'alternate:behind-the-curtain' }, 乱武: { ...makeUpheaval(true), id: 'alternate:descend-into-chaos' } },
  // Femme Fatale, Impetus for Conflicts: Zou Shi is new to Alternate (Default has no such General).
  'zou-shi': { 祸水: femmeFatale, 倾城: impetusForConflicts },
};
