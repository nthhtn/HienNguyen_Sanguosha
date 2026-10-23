import type { CardInstance, CardMovedEvent, ContentRegistry, DamageDealtEvent, Effect, GameState, PhaseChangedEvent, SeatDyingEvent, SeatEliminatedEvent, SkillDefinition, UsedCard } from 'engine';
import { discardOwed, endFlagOf, requireZoneOfKind, slotSilenced } from 'engine';
import { seatCardOptions } from '../shared/choices';
import { exposedKingdom, exposedKingdomCounts, ownKingdom, sameKingdomSeatIds } from '../shared/kingdom';
import { abilityKey } from '../shared/steps';
import { handOf } from '../shared/queries';
import { equipSlotOf } from '../cards/equipment';
import { isShaDamage, untargetableBy } from '../shared/abilities';
import { competeStart, competeStep } from '../shared/compete';
import { makeCurtain } from './forest';
import { makeEclipseTheMoon, makeSowDiscord } from './qun';
import { horsemanship } from './shu';
import { killedByLivingOther } from './mountain';
import { ask, choiceOf, draw, equipZoneId, handZoneId, isLiving, on, otherLivingSeatIds, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

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
const wornOf = (state: GameState, seatId: string): CardInstance[] => state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? [];

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
      effect: (_state, event, owner) => {
        const victim = (event.damage.target as { seatId: string }).seatId;
        return [skillStep(owner, 'ask', { victim })];
      },
    }),
  ],
  // 'pick': which of the victim's worn cards; 'handle': move it or discard it.
  onStep: (state, step) => {
    const { owner } = step;
    const victim = step.data?.['victim'] as string;
    if (!isLiving(state, owner.seatId)) return [];
    // 'ask': runs once the damage and any dying round are over; a victim that died (its cards gone) is not asked.
    if (step.step === 'ask') return isLiving(state, victim) && wornOf(state, victim).length > 0 ? [ask(owner, [skillStep(owner, 'pick', { victim })], [], victim)] : [];
    if (step.step === 'pick') {
      const worn = wornOf(state, victim);
      if (!isLiving(state, victim) || worn.length === 0) return [];
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
// living seat has such a card.
const discardableSeats = (state: GameState, seatId: string): string[] =>
  otherLivingSeatIds(state, seatId).filter((id) => seatCardOptions(state, id, '', { judgment: false }).length > 0);

const deathlyCounsel: SkillDefinition = {
  id: 'alternate:deathly-counsel',
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) =>
        event.fromZoneId === handZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId && handOf(state, owner.seatId).length === 0 &&
        isLiving(state, owner.seatId) && discardableSeats(state, owner.seatId).length > 0,
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
// are exposed ones (a source with both Generals hidden is in none; a death reveals the seat first).
// His own Kingdom is the seat's, else his General's (a hidden General's compulsory skill asks to reveal).
const withTheTide: SkillDefinition = {
  id: 'alternate:with-the-tide',
  compulsory: true,
  triggers: [
    on<SeatDyingEvent>('after:SeatDyingEvent', {
      condition: (state, event, owner, registry) => {
        const own = ownKingdom(state, owner, registry);
        return !!own && isLiving(state, owner.seatId) && event.seatId !== owner.seatId && !!event.killerSeatId && exposedKingdom(state, event.killerSeatId) === own;
      },
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 1)],
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
        const last = state.log.at(-1);
        if (last?.kind !== 'CardMovedEvent' || last.cardInstanceId !== event.cardInstanceId) return false;
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
  'jia-xu': { 帷幕: { ...makeCurtain(true), id: 'alternate:behind-the-curtain' } },
};
