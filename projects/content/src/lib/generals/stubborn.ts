import type { Effect, GameState, PhaseChangedEvent, SkillDefinition } from 'engine';
import { requireZoneOfKind } from 'engine';
import { ask, choiceOf, handZoneId, isLiving, on, skillStep, used } from '../shared/skills';

// Stubborn lives apart from mountain.ts so the Alternate variant file can import its factory without a
// cycle (mountain.ts reaches display.ts, which reaches the variants).

const zoneCards = (state: GameState, zoneId: string) => state.zones.find((z) => z.id === zoneId)?.cards ?? [];
const seatOf = (state: GameState, seatId: string) => state.seats.find((x) => x.id === seatId);

// The cards `seatId` discarded in its latest Discard Phase that still lie in the discard pile.
function discardedInDiscardPhase(state: GameState, seatId: string): string[] {
  let start = -1;
  state.log.forEach((e, i) => {
    if (e.kind === 'PhaseChangedEvent' && e.phase === 'Discard' && e.seatId === seatId) start = i;
  });
  if (start === -1) return [];
  const seat = seatOf(state, seatId);
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const stillThere = new Set(zoneCards(state, discardPileId).map((c) => c.instanceId));
  return state.log
    .slice(start)
    .flatMap((e) => (e.kind === 'CardMovedEvent' && seat && e.fromZoneId === seat.hand.zoneId && e.toZoneId === discardPileId && stillThere.has(e.cardInstanceId) ? [e.cardInstanceId] : []));
}

// Stubborn (may): at the end of another seat's Discard Phase, if it discarded
// `minDiscarded` or more cards, give one of them back to it and take the others.
// Default needs 2; Alternate's Stabilization works with 1 (nothing is taken then).
export const makeStubborn = (minDiscarded: number): SkillDefinition => ({
  id: 'stubborn',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'End' && event.seatId !== owner.seatId && state.turn.ownerSeatId === event.seatId && isLiving(state, event.seatId) && isLiving(state, owner.seatId) &&
        discardedInDiscardPhase(state, event.seatId).length >= minDiscarded,
      effect: (state, event, owner) => [ask(owner, [skillStep(owner, 'give', { seat: event.seatId, cards: discardedInDiscardPhase(state, event.seatId) })], [], event.seatId)],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const seat = step.data?.['seat'] as string;
    const discardPile = requireZoneOfKind(state.zones, 'discardPile');
    const cards = ((step.data?.['cards'] as string[] | undefined) ?? []).flatMap((id) => discardPile.cards.filter((c) => c.instanceId === id));
    if (cards.length < minDiscarded || !isLiving(state, seat) || !isLiving(state, owner.seatId)) return [];
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
});

export const stubborn: SkillDefinition = makeStubborn(2);

