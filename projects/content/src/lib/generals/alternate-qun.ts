import type { CardInstance, DamageDealtEvent, Effect, GameState, SeatEliminatedEvent, SkillDefinition } from 'engine';
import { requireZoneOfKind, slotSilenced } from 'engine';
import { equipSlotOf } from '../cards/equipment';
import { isShaDamage } from '../shared/abilities';
import { makeCurtain } from './forest';
import { makeEclipseTheMoon, makeSowDiscord } from './qun';
import { killedByLivingOther } from './mountain';
import { ask, choiceOf, equipZoneId, hpOf, isLiving, on, skillStep, used } from '../shared/skills';

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
const wornOf = (state: GameState, seatId: string): CardInstance[] => {
  const seat = state.seats.find((s) => s.id === seatId);
  return state.zones.find((z) => z.id === seat?.equipped.zoneId)?.cards ?? [];
};

const insanityAxe: SkillDefinition = {
  id: 'alternate:insanity-axe',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        isShaDamage(event.damage) &&
        event.damage.source?.kind === 'seat' && event.damage.source.seatId === owner.seatId &&
        event.damage.target.kind === 'seat' && event.damage.target.seatId !== owner.seatId &&
        isLiving(state, owner.seatId) && isLiving(state, event.damage.target.seatId) && hpOf(state, event.damage.target.seatId) > 0 && wornOf(state, event.damage.target.seatId).length > 0,
      effect: (_state, event, owner) => [ask(owner, [skillStep(owner, 'pick', { victim: (event.damage.target as { seatId: string }).seatId })], [], (event.damage.target as { seatId: string }).seatId)],
    }),
  ],
  // 'pick': which of the victim's worn cards; 'handle': move it or discard it.
  onStep: (state, step) => {
    const { owner } = step;
    const victim = step.data?.['victim'] as string;
    if (!isLiving(state, owner.seatId)) return [];
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
  // Behind the Curtain: he can be chosen by black Tools, which are cancelled for him (Default: can't be chosen).
  'jia-xu': { 帷幕: { ...makeCurtain(true), id: 'alternate:behind-the-curtain' } },
};
