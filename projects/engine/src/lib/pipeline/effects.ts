import { GameState, Damage, PendingChoice, PendingResponse, Target, UsedCard, WuxieSubject } from '../domain/types';
import { nextInt } from '../rng/rng';
import { drawTop, moveCard, requireZoneOfKind } from '../cards/zones';
import { EngineEvent } from './events';
import { isFaceUpZoneKind } from '../domain/redact';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse }
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'HealEffect'; target: Target; amount: number }
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string }
  | { kind: 'EliminateSeatEffect'; seatId: string }
  // The dying round for `seatId`: ask the seats in `order` (turn order from the
  // turn owner) one at a time. Any seat may save it with `rescueCardIds.any`
  // (Peach); only the dying seat itself may also use `rescueCardIds.self`
  // (Wine). Content says which. See the Peach and dying spec.
  | { kind: 'DyingEffect'; seatId: string; order: string[]; rescueCardIds: { any: string[]; self: string[] }; entering?: boolean }
  // The Tool lifecycle (see the Tools spec). One per target: a Wuxie check,
  // then the Tool's own rule (CardDefinition.onTarget). Content supplies the
  // counter card ids, so the engine names no card.
  | { kind: 'ToolOnTargetEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[]; counterCardIds: string[] }
  | { kind: 'ToolRuleEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[] }
  // Asks, in `order`, the next living seat holding a counter card; none left = no cancel.
  | { kind: 'WuxieCheckEffect'; subject: WuxieSubject; order: string[]; counterCardIds: string[] }
  // Removes the next queued item: a counter card's way of cancelling what it guards.
  | { kind: 'SkipNextEffect' }
  // Asks `choice.seatId` to pick one option; the queue waits for the pick.
  | { kind: 'OpenChoiceEffect'; choice: PendingChoice }
  // Moves a random card (seeded) of `fromZoneId` to `toZoneId`: a pick from a
  // hand the chooser can't see. Nothing happens when the zone is empty.
  | { kind: 'MoveRandomCardEffect'; fromZoneId: string; toZoneId: string }
  // Turns `count` cards from the draw pile face up into the processing zone
  // (Harvest), shuffling the discard pile in first when the draw pile is short
  // (all but `keepInDiscard`: the Tool being resolved never turns itself up).
  | { kind: 'RevealToProcessingEffect'; count: number; keepInDiscard?: string[] }
  // Moves every card in `zoneId` to the discard pile, in order.
  | { kind: 'DiscardZoneEffect'; zoneId: string }
  // Sets a flag of the current turn (e.g. skipFlagOf('Play')), or clears it
  // with `value: false`. Flags end with the turn.
  | { kind: 'SetTurnFlagEffect'; flag: string; value?: boolean }
  // A judgment for `seatId`, read by the delayed Tool `tool` (CardDefinition.onJudged).
  | { kind: 'JudgeEffect'; seatId: string; tool: UsedCard }
  // A delayed Tool's turn in the Judgment phase is over (CardDefinition.onCleanup).
  | { kind: 'DelayedCleanupEffect'; tool: UsedCard; ownerSeatId: string };

export interface ApplyResult {
  state: GameState;
  events: EngineEvent[];
}

export function applyEffect(state: GameState, effect: Effect): ApplyResult {
  switch (effect.kind) {
    case 'DrawCardsEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, seat.hand.zoneId, effect.count, state.rng);
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'CardsDrawnEvent', seatId: seat.id, cardInstanceIds: drawn.map((c) => c.instanceId) },
      ];
      return { state: { ...state, zones, rng, log: [...state.log, ...events] }, events };
    }
    case 'DamageEffect': {
      if (effect.damage.target.kind !== 'seat') {
        throw new Error('DamageEffect currently only supports seat targets');
      }
      const seatId = effect.damage.target.seatId;
      const seat = state.seats.find((s) => s.id === seatId);
      if (!seat) throw new Error(`Unknown seat: ${seatId}`);
      const seats = state.seats.map((s) =>
        // HP may go below 0: a big hit needs more Peaches to recover from.
        s.id === seatId ? { ...s, combinedHp: s.combinedHp - effect.damage.amount } : s
      );
      const event: EngineEvent = { kind: 'DamageDealtEvent', damage: effect.damage };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'OpenResponseEffect':
      return { state: { ...state, pendingResponse: effect.pendingResponse }, events: [] };
    case 'RevealGeneralEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const generals = seat.generals;
      if (!generals) throw new Error(`Seat ${effect.seatId} has not chosen its generals yet`);
      if (generals[effect.slot].revealed) {
        return { state, events: [] };
      }
      const seats = state.seats.map((s) =>
        s.id === effect.seatId
          ? { ...s, generals: { ...generals, [effect.slot]: { ...generals[effect.slot], revealed: true } } }
          : s
      );
      const event: EngineEvent = { kind: 'GeneralRevealedEvent', seatId: effect.seatId, slot: effect.slot };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'HealEffect': {
      if (effect.target.kind !== 'seat') throw new Error('HealEffect currently only supports seat targets');
      const seat = state.seats.find((s) => s.id === effect.target.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.target.seatId}`);
      const combinedHp = Math.min(seat.maxCombinedHp, seat.combinedHp + effect.amount);
      const seats = state.seats.map((s) => (s.id === effect.target.seatId ? { ...s, combinedHp } : s));
      const event: EngineEvent = { kind: 'HealEvent', target: effect.target, amount: effect.amount };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'MoveCardEffect': {
      const origin = state.zones.find((z) => z.cards.some((c) => c.instanceId === effect.cardInstanceId));
      const zones = moveCard(state.zones, effect.cardInstanceId, effect.toZoneId);
      const destination = zones.find((z) => z.id === effect.toZoneId)!;
      const card = destination.cards.at(-1)!;
      const event: EngineEvent = {
        kind: 'CardMovedEvent',
        cardInstanceId: effect.cardInstanceId,
        // moveCard has already thrown if the card was in no zone.
        fromZoneId: origin!.id,
        toZoneId: effect.toZoneId,
        ...(isFaceUpZoneKind(destination.kind) ? { card } : {}),
      };
      return { state: { ...state, zones, log: [...state.log, event] }, events: [event] };
    }
    case 'EliminateSeatEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === effect.seatId ? { ...s, eliminated: true } : s));
      const event: EngineEvent = { kind: 'SeatEliminatedEvent', seatId: effect.seatId };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'OpenChoiceEffect':
      return { state: { ...state, pendingChoice: effect.choice }, events: [] };
    case 'MoveRandomCardEffect': {
      const from = state.zones.find((z) => z.id === effect.fromZoneId);
      if (!from) throw new Error(`Zone ${effect.fromZoneId} not found`);
      if (from.cards.length === 0) return { state, events: [] };
      const { value, rng } = nextInt(state.rng, from.cards.length);
      return applyEffect({ ...state, rng }, { kind: 'MoveCardEffect', cardInstanceId: from.cards[value].instanceId, toZoneId: effect.toZoneId });
    }
    case 'RevealToProcessingEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const processing = requireZoneOfKind(state.zones, 'processing');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, effect.count, state.rng, effect.keepInDiscard);
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'CardsTurnedUpEvent', zoneId: processing.id, cards: drawn },
      ];
      return { state: { ...state, zones, rng, log: [...state.log, ...events] }, events };
    }
    case 'DiscardZoneEffect': {
      const zone = state.zones.find((z) => z.id === effect.zoneId);
      if (!zone) throw new Error(`Zone ${effect.zoneId} not found`);
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      let current = state;
      const events: EngineEvent[] = [];
      for (const card of zone.cards) {
        const moved = applyEffect(current, { kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: discardPile.id });
        current = moved.state;
        events.push(...moved.events);
      }
      return { state: current, events };
    }
    case 'SetTurnFlagEffect': {
      const { [effect.flag]: _previous, ...others } = state.turn.flags ?? {};
      const flags = effect.value === false ? others : { ...others, [effect.flag]: true };
      const { flags: _old, ...turn } = state.turn;
      return { state: { ...state, turn: Object.keys(flags).length > 0 ? { ...turn, flags } : turn }, events: [] };
    }
    case 'DyingEffect':
      return applyDying(state, effect);
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}

// One step of the dying round. Saved once above 0 HP; otherwise ask the next
// seat in `order` that must be asked — the dying seat always, any other seat
// only while it holds a rescue card; eliminated when no one is left to ask.
function applyDying(state: GameState, effect: Extract<Effect, { kind: 'DyingEffect' }>): ApplyResult {
  const seat = state.seats.find((s) => s.id === effect.seatId);
  if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
  if (seat.eliminated) return { state, events: [] };
  const events: EngineEvent[] = effect.entering && seat.combinedHp <= 0 ? [{ kind: 'SeatDyingEvent', seatId: seat.id }] : [];
  const logged = (next: GameState, more: EngineEvent[] = []): ApplyResult => ({
    state: { ...next, log: [...next.log, ...events, ...more] },
    events: [...events, ...more],
  });

  if (seat.combinedHp > 0) return logged(state, [{ kind: 'SeatSavedEvent', seatId: seat.id }]);

  // Other seats are asked only while they hold a card that may save someone else.
  const holdsRescue = (seatId: string) => {
    const s = state.seats.find((x) => x.id === seatId);
    const hand = s && state.zones.find((z) => z.id === s.hand.zoneId);
    return !!hand?.cards.some((c) => effect.rescueCardIds.any.includes(c.definitionId));
  };
  const isLiving = (seatId: string) => !!state.seats.find((x) => x.id === seatId && !x.eliminated);
  const index = effect.order.findIndex((id) => isLiving(id) && (id === seat.id || holdsRescue(id)));
  if (index === -1) {
    const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, eliminated: true } : s));
    return logged({ ...state, seats }, [{ kind: 'SeatEliminatedEvent', seatId: seat.id }]);
  }

  const askerId = effect.order[index];
  const pendingResponse: PendingResponse = {
    id: `dying-${seat.id}-${state.log.length + events.length}`,
    respondingSeatId: askerId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: askerId === seat.id ? [...effect.rescueCardIds.any, ...effect.rescueCardIds.self] : effect.rescueCardIds.any,
    reason: { kind: 'dying', seatId: seat.id },
    // Pass: move on to the next seat.
    context: { effect: { kind: 'DyingEffect', seatId: seat.id, order: effect.order.slice(index + 1), rescueCardIds: effect.rescueCardIds } },
    // A rescue card: heal the dying seat, then ask again from this same seat.
    onAnswer: [
      { kind: 'HealEffect', target: { kind: 'seat', seatId: seat.id }, amount: 1 },
      { kind: 'DyingEffect', seatId: seat.id, order: effect.order.slice(index), rescueCardIds: effect.rescueCardIds },
    ],
  };
  return logged({ ...state, pendingResponse });
}
