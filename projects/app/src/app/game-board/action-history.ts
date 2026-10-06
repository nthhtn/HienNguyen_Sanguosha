import { CardInstance, CardZone, ChoiceMadeEvent, EngineEvent, Player, Seat, UsedCard } from 'engine';
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
// A used card for a history line: "Sha (7 ♠)" for one card used as itself,
// otherwise its name.
const usedLabel = (used: UsedCard) =>
  used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
// The card shown beside a line: the physical card, when there is exactly one.
const faceOf = (used: UsedCard): CardInstance | null => (used.physical.length === 1 ? used.physical[0] : null);

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
  const playedCards = new Map<string, UsedCard>();
  // Cards used but not yet moved on: their next move is the play's own.
  const awaitingMove = new Set<string>();
  // A pick waiting for its card's move, which says what was picked.
  let picked: ChoiceMadeEvent | null = null;
  // The last face seen of each card, from moves into face-up zones.
  const knownFaces = new Map<string, CardInstance>();
  // "Seat 1 took Hing's Silver Lion (A ♣) with Steal", "Seat 1 took a hand card
  // from Hing with Steal", "Seat 1 discarded Sha (7 ♠) from Hing's hand with Break".
  const pickLine = (made: ChoiceMadeEvent, face: CardInstance | undefined, ownerSeatId: string | undefined): string => {
    const tool = made.reason.kind === 'choice' ? ` with ${cardName(made.reason.card.as)}` : '';
    const chooser = name(made.seatId);
    if (made.shows.kind === 'hidden-hand') {
      return made.verb === 'take'
        ? `${chooser} took a hand card from ${name(made.shows.seatId)}${tool}`
        : `${chooser} discarded ${face ? named(face) : 'a card'} from ${name(made.shows.seatId)}'s hand${tool}`;
    }
    const what = face ? named(face) : 'a card';
    return `${chooser} ${made.verb === 'take' ? 'took' : 'discarded'} ${ownerSeatId ? `${name(ownerSeatId)}'s ${what}` : what}${tool}`;
  };
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
        const used = event.card;
        for (const c of used.physical) {
          playedCards.set(c.instanceId, used);
          awaitingMove.add(c.instanceId);
        }
        const face = faceOf(used);
        const answered = event.inResponseTo;
        if (answered?.dyingSeatId) {
          const saved = answered.dyingSeatId === event.seatId ? 'themselves' : name(answered.dyingSeatId);
          action(`${name(event.seatId)} used ${usedLabel(used)} to save ${saved}`, face);
        } else if (answered?.counters && answered.seatId) {
          action(`${name(event.seatId)} cancelled ${name(answered.seatId)}'s ${cardName(used.as)} with ${usedLabel(used)}`, face);
        } else if (answered?.targetSeatId && answered.seatId) {
          const tool = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const toolName = tool ? cardName(tool.as) : 'Tool';
          const on = answered.targetSeatId === answered.seatId ? '' : ` on ${name(answered.targetSeatId)}`;
          action(`${name(event.seatId)} cancelled ${name(answered.seatId)}'s ${toolName}${on} with ${usedLabel(used)}`, face);
        } else if (answered) {
          const answeredCard = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const against = answered.seatId
            ? ` against ${name(answered.seatId)}${answeredCard ? `'s ${cardName(answeredCard.as)}` : ''}`
            : ' in response';
          action(`${name(event.seatId)} used ${usedLabel(used)}${against}`, face);
        } else if (cardDisplayData(used.as)?.category === 'equipment') {
          action(`${name(event.seatId)} equipped ${usedLabel(used)}`, face);
        } else if (event.targets.length > 0) {
          action(`${name(event.seatId)} used ${usedLabel(used)} on ${event.targets.map(target).join(', ')}`, face);
        } else {
          action(`${name(event.seatId)} used ${usedLabel(used)}`, face);
        }
        break;
      }
      case 'CardMovedEvent': {
        if (event.card) knownFaces.set(event.cardInstanceId, event.card);
        if (awaitingMove.delete(event.cardInstanceId)) break;
        const from = zoneById.get(event.fromZoneId);
        const to = zoneById.get(event.toZoneId);
        if (picked) {
          const face = event.card ?? (picked.shows.kind === 'card' ? picked.shows.card : undefined);
          action(pickLine(picked, face, from?.ownerSeatId), face ?? null);
          picked = null;
          break;
        }
        // A worn card handed to another seat (Coerce's weapon).
        if (from?.kind === 'equip' && to?.kind === 'hand' && from.ownerSeatId && to.ownerSeatId && from.ownerSeatId !== to.ownerSeatId) {
          const face = knownFaces.get(event.cardInstanceId);
          action(`${name(to.ownerSeatId)} took ${name(from.ownerSeatId)}'s ${face ? named(face) : 'card'}`, face ?? null);
          break;
        }
        // Lightning moving on to the next seat's judgment area.
        if (event.card && from?.kind === 'judgment' && to?.kind === 'judgment' && from.ownerSeatId && to.ownerSeatId) {
          action(`${named(event.card)} moved on from ${name(from.ownerSeatId)} to ${name(to.ownerSeatId)}`, event.card);
          break;
        }
        if (!event.card || to?.kind !== 'discardPile' || !from?.ownerSeatId) break;
        if (from.kind === 'hand') action(`${name(from.ownerSeatId)} discarded ${named(event.card)}`, event.card);
        if (from.kind === 'equip' || from.kind === 'judgment') action(`${name(from.ownerSeatId)}'s ${cardName(event.card.definitionId)} was discarded`, event.card);
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
      case 'ChoiceMadeEvent':
        if (event.shows.kind === 'card' || event.shows.kind === 'hidden-hand') picked = event;
        break;
      case 'CardsTurnedUpEvent':
        action(`Turned up ${event.cards.length} ${event.cards.length === 1 ? 'card' : 'cards'}: ${event.cards.map(named).join(', ')}`);
        break;
      case 'JudgmentEvent':
        action(`${name(event.seatId)}'s ${cardName(event.tool.as)} judgment: ${cardFaceLabel(event.card)}`, event.card);
        break;
      case 'PhaseSkippedEvent':
        action(`${name(event.seatId)} skipped the ${event.phase} Phase`);
        break;
      case 'DiscardPileReshuffledEvent':
        action(`The discard pile (${event.cardCount}) was shuffled into the draw pile`);
        break;
    }
  }
  return entries.reverse();
}
