import type { CardInstance, CardMovedEvent, DamageDealtEvent, Effect, GameState, SeatDyingEvent, SeatEliminatedEvent, SkillDefinition } from 'engine';
import { requireZoneOfKind, slotSilenced } from 'engine';
import { seatCardOptions } from '../shared/choices';
import { exposedKingdom, ownKingdom } from '../shared/kingdom';
import { handOf } from '../shared/queries';
import { equipSlotOf } from '../cards/equipment';
import { isShaDamage } from '../shared/abilities';
import { makeCurtain } from './forest';
import { makeEclipseTheMoon, makeSowDiscord } from './qun';
import { killedByLivingOther } from './mountain';
import { ask, choiceOf, draw, equipZoneId, handZoneId, isLiving, on, otherLivingSeatIds, seatOptions, skillStep, used } from '../shared/skills';

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
  // Behind the Curtain: he can be chosen by black Tools, which are cancelled for him (Default: can't be chosen).
  'jia-xu': { 帷幕: { ...makeCurtain(true), id: 'alternate:behind-the-curtain' } },
};
