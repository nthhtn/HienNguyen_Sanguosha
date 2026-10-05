import { CardInstance, CardZone, EngineEvent, Player, Seat } from 'engine';
import { cardDisplayData } from 'content';
import { Force, cardFaceLabel, cardIdDisplayName, forceOf, seatName, targetLabel } from '../labels';

export type ActionHistoryEntry =
  | { kind: 'turn'; turnNumber: number; seatName: string }
  // `force` is set on a line about a player's status (HP lost or recovered,
  // dying, saved, eliminated): that player's force colour.
  | { kind: 'action'; text: string; card: CardInstance | null; force?: Force };

function cardName(definitionId: string): string {
  return cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);
}

const named = (card: CardInstance) => `${cardName(card.definitionId)} (${cardFaceLabel(card)})`;

// What happened at the table, read off the public log, most recent first, with
// a marker at the start of each turn. Phase changes are left out, and so is a
// used card's own trip to the discard pile: the "used" line already says it.
export function actionHistory(
  log: EngineEvent[],
  zones: CardZone[],
  players: readonly Player[] = [],
  seats: readonly Seat[] = []
): ActionHistoryEntry[] {
  const name = (seatId: string) => seatName(players, seatId);
  const target = (t: Parameters<typeof targetLabel>[0]) => targetLabel(t, players);
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const playedCards = new Map<string, CardInstance>();
  // Cards used but not yet moved on: their next move is the play's own.
  const awaitingMove = new Set<string>();
  const entries: ActionHistoryEntry[] = [];
  const forceOfSeat = (seatId: string) => forceOf(seats.find((s) => s.id === seatId)?.kingdom);
  const status = (seatId: string, text: string) => entries.push({ kind: 'action', text, card: null, force: forceOfSeat(seatId) });
  let sawTurn = false;
  const action = (text: string, card: CardInstance | null = null) => entries.push({ kind: 'action', text, card });

  for (const event of log) {
    switch (event.kind) {
      case 'TurnAdvancedEvent':
        sawTurn = true;
        entries.push({ kind: 'turn', turnNumber: event.turnNumber, seatName: name(event.seatId) });
        break;
      case 'PhaseChangedEvent':
        // Turn 1 starts without a TurnAdvancedEvent.
        if (!sawTurn) {
          sawTurn = true;
          entries.push({ kind: 'turn', turnNumber: 1, seatName: name(event.seatId) });
        }
        break;
      case 'CardPlayedEvent': {
        playedCards.set(event.card.instanceId, event.card);
        awaitingMove.add(event.card.instanceId);
        const answered = event.inResponseTo;
        if (answered?.dyingSeatId) {
          const saved = answered.dyingSeatId === event.seatId ? 'themselves' : name(answered.dyingSeatId);
          action(`${name(event.seatId)} used ${named(event.card)} to save ${saved}`, event.card);
        } else if (answered) {
          const answeredCard = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const against = answered.seatId
            ? ` against ${name(answered.seatId)}${answeredCard ? `'s ${cardName(answeredCard.definitionId)}` : ''}`
            : ' in response';
          action(`${name(event.seatId)} used ${named(event.card)}${against}`, event.card);
        } else if (cardDisplayData(event.card.definitionId)?.category === 'equipment') {
          action(`${name(event.seatId)} equipped ${named(event.card)}`, event.card);
        } else if (event.targets.length > 0) {
          action(`${name(event.seatId)} used ${named(event.card)} on ${event.targets.map(target).join(', ')}`, event.card);
        } else {
          action(`${name(event.seatId)} used ${named(event.card)}`, event.card);
        }
        break;
      }
      case 'CardMovedEvent': {
        if (awaitingMove.delete(event.cardInstanceId)) break;
        const from = zoneById.get(event.fromZoneId);
        const to = zoneById.get(event.toZoneId);
        if (!event.card || to?.kind !== 'discardPile' || !from?.ownerSeatId) break;
        if (from.kind === 'hand') action(`${name(from.ownerSeatId)} discarded ${named(event.card)}`, event.card);
        if (from.kind === 'equip') action(`${name(from.ownerSeatId)}'s ${cardName(event.card.definitionId)} was discarded`, event.card);
        break;
      }
      case 'DamageDealtEvent': {
        const { source, target: victim, amount, nature } = event.damage;
        const kind = nature === 'normal' ? 'damage' : `${nature} damage`;
        status(victim.seatId, `${target(victim)} took ${amount} ${kind}${source ? ` from ${target(source)}` : ''}`);
        break;
      }
      case 'HealEvent':
        status(event.target.seatId, `${target(event.target)} recovered ${event.amount} health`);
        break;
      case 'CardsDrawnEvent':
        action(`${name(event.seatId)} drew ${event.cardInstanceIds.length} ${event.cardInstanceIds.length === 1 ? 'card' : 'cards'}`);
        break;
      case 'GeneralRevealedEvent':
        action(`${name(event.seatId)} revealed their ${event.slot === 'main' ? 'Main' : 'Deputy'} General`);
        break;
      case 'SeatDyingEvent':
        status(event.seatId, `${name(event.seatId)} is dying`);
        break;
      case 'SeatSavedEvent':
        status(event.seatId, `${name(event.seatId)} was saved`);
        break;
      case 'SeatEliminatedEvent':
        status(event.seatId, `${name(event.seatId)} was eliminated`);
        break;
      case 'GeneralsChosenEvent':
        action(`${name(event.seatId)} chose their generals`);
        break;
      case 'DiscardPileReshuffledEvent':
        action(`The discard pile (${event.cardCount}) was shuffled into the draw pile`);
        break;
    }
  }
  return entries.reverse();
}
