import { CardInstance, CardZone, ChoiceMadeEvent, EngineEvent, Player, Seat, UsedCard } from 'engine';
import { abilityName, cardDisplayData, generalDisplayData } from 'content';
import { Force, cardFaceLabel, cardIdDisplayName, forceOf, generalDisplayName, judgmentReaderName, seatName, suitSymbol, targetLabel } from '../labels';

export type ActionHistoryEntry =
  | { kind: 'turn'; turnNumber: number; seatName: string }
  // `force` is set on a line about a player's status (HP lost or recovered,
  // dying, saved, eliminated): that player's force colour. `starts` marks the
  // first line of an action sequence (latestSequence).
  | { kind: 'action'; text: string; card: CardInstance | null; force?: Force; starts?: true };

export type ActionLine = Extract<ActionHistoryEntry, { kind: 'action' }>;

function cardName(definitionId: string): string {
  return cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);
}

const named = (card: CardInstance) => `${cardName(card.definitionId)} (${cardFaceLabel(card)})`;
// A used card for a history line: "Sha (7 ♠)" for one card used as itself,
// otherwise its name.
const usedLabel = (used: UsedCard) => {
  if (used.via) {
    const as = `${cardName(used.as)} (${abilityName(used.via.abilityId)})`;
    return used.physical.length === 1 ? `${named(used.physical[0])} as ${as}` : `${used.physical.length} cards as ${as}`;
  }
  return used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
};
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
  const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;
  // The General in `slot` of a seat, by name, when the viewer can see it.
  const generalIn = (seatId: string, slot: 'main' | 'deputy'): string | null => {
    const id = seats.find((s) => s.id === seatId)?.generals?.[slot].generalDefinitionId;
    return id && id !== 'hidden' ? (generalDisplayData(id)?.name ?? generalDisplayName(id)) : null;
  };
  // How many cards a seat picked last, for "gave 2 cards".
  let lastPicked: { seatId: string; count: number } | null = null;
  // The last face seen of each card, from moves into face-up zones.
  const knownFaces = new Map<string, CardInstance>();
  // The card each seat showed last, and its line (competing folds two into one).
  const lastShown = new Map<string, { card: CardInstance; line: ActionLine }>();
  let swapFirst: string | null = null;
  // "Seat 1 took Hing's Silver Lion (A ♣) with Steal", "Seat 1 took a hand card
  // from Hing with Steal", "Seat 1 discarded Sha (7 ♠) from Hing's hand with Break".
  const pickLine = (made: ChoiceMadeEvent, face: CardInstance | undefined, ownerSeatId: string | undefined): string => {
    const tool = made.reason.kind === 'choice' ? ` with ${cardName(made.reason.card.as)}` : made.reason.kind === 'ability' ? ` with ${abilityName(made.reason.abilityId)}` : '';
    const chooser = name(made.seatId);
    if (made.shows.kind === 'hidden-hand') {
      return made.verb === 'take'
        ? `${chooser} took a hand card from ${name(made.shows.seatId)}${tool}`
        : `${chooser} discarded ${face ? named(face) : 'a card'} from ${name(made.shows.seatId)}'s hand${tool}`;
    }
    const what = face ? named(face) : 'a card';
    const whose = ownerSeatId && ownerSeatId !== made.seatId ? `${name(ownerSeatId)}'s ${what}` : what;
    return `${chooser} ${made.verb === 'take' ? 'took' : 'discarded'} ${whose}${tool}`;
  };
  const entries: ActionHistoryEntry[] = [];
  // A sequence starts with a phase's first line, or a card used on its user's
  // own initiative (not as an answer).
  let phaseStarted = false;
  let initiative = false;
  const line = (entry: ActionLine) => {
    if (phaseStarted || initiative) entry.starts = true;
    phaseStarted = initiative = false;
    entries.push(entry);
  };
  const forceOfSeat = (seatId: string) => forceOf(seats.find((s) => s.id === seatId)?.kingdom);
  const status = (seatId: string, text: string) => line({ kind: 'action', text, card: null, force: forceOfSeat(seatId) });
  let sawTurn = false;
  const action = (text: string, card: CardInstance | null = null) => line({ kind: 'action', text, card });

  for (const event of log) {
    switch (event.kind) {
      case 'TurnAdvancedEvent':
        sawTurn = true;
        phaseStarted = true;
        entries.push({ kind: 'turn', turnNumber: event.turnNumber, seatName: name(event.seatId) });
        break;
      case 'PhaseChangedEvent':
        phaseStarted = true;
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
        if (!answered) initiative = true;
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
        // A card put under a General (Refusing Death).
        if (event.card && to?.kind === 'pile' && to.ownerSeatId) {
          action(`${name(to.ownerSeatId)} put ${named(event.card)} under their General`, event.card);
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
      case 'GeneralRevealedEvent': {
        const which = generalIn(event.seatId, event.slot) ?? `their ${event.slot === 'main' ? 'Main' : 'Deputy'} General`;
        action(event.forAbilityId ? `${name(event.seatId)} revealed ${which} to use ${abilityName(event.forAbilityId)}` : `${name(event.seatId)} revealed their ${event.slot === 'main' ? 'Main' : 'Deputy'} General`);
        break;
      }
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
      case 'ChoiceMadeEvent': {
        const { reason, shows } = event;
        const chooser = name(event.seatId);
        if (shows.kind === 'card' || shows.kind === 'hidden-hand') {
          picked = event;
        } else if (shows.kind === 'use' && reason.kind === 'ability') {
          // A reveal says it on its own line, next.
          if (!shows.reveals) {
            const on = reason.targetSeatId && reason.targetSeatId !== event.seatId ? ` on ${name(reason.targetSeatId)}` : '';
            action(`${chooser} used ${abilityName(reason.abilityId)}${on}`);
          }
        } else if (shows.kind === 'decline' && reason.kind === 'choice') {
          action(`${chooser} let ${name(reason.userSeatId)} draw a card (${cardName(reason.card.as)})`);
        } else if (shows.kind === 'seat') {
          const given = lastPicked?.seatId === event.seatId ? lastPicked.count : 0;
          action(event.verb === 'give' ? `${chooser} gave ${cards(given)} to ${name(shows.seatId)}` : `${chooser} chose ${name(shows.seatId)}`);
        } else if (shows.kind === 'suit') {
          action(`${chooser} named ${suitSymbol(shows.suit)}`);
        } else if (shows.kind === 'label' && reason.kind === 'ability' && reason.cardId) {
          // Believing or doubting a claim (Bewilder).
          action(`${chooser} ${shows.text === 'Doubt' ? 'doubted' : 'believed'} ${name(reason.owner.seatId)}'s ${cardName(reason.cardId)}`);
        } else if (shows.kind === 'label') {
          action(`${chooser} chose ${shows.text}`);
        }
        break;
      }
      case 'AbilityUsedEvent': {
        const owner = name(event.owner.seatId);
        const ability = abilityName(event.abilityId);
        if (event.outcome === 'used') {
          action(event.abilityId === 'upheaval' ? `${owner} used ${ability}: every other seat plays a Sha or loses 1 HP` : `${owner} used ${ability}`);
        } else if (event.outcome === 'no-effect' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)}'s Sha has no effect`);
        } else if (event.outcome === 'counts-as-shan') {
          // Said on its judgment's line, which comes just before.
          const last = entries[entries.length - 1];
          if (last?.kind === 'action' && last.text.startsWith(`${owner}'s ${ability} judgment:`)) last.text += ', Counts as Shan';
          else action(`${owner}'s ${ability} counts as Shan`);
        } else if (event.outcome === 'more-damage') {
          action(`${owner}'s ${ability}: 1 more damage`);
        } else if (event.outcome === 'unblockable' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} can't play a Shan`);
        } else if (event.outcome === 'moved' && event.targetSeatId) {
          action(`${owner}'s ${ability} moved the Sha to ${name(event.targetSeatId)}`);
        } else if (event.outcome === 'stays-alive') {
          action(`${owner}'s ${ability}: no match, ${owner} stays alive`);
        } else if (event.outcome === 'matched') {
          action(`${owner}'s ${ability}: a rank matched`);
        } else if ((event.outcome === 'claim-true' || event.outcome === 'claim-false') && event.cardId) {
          action(`${owner}'s ${cardName(event.cardId)} ${event.outcome === 'claim-true' ? 'was true' : 'was a bluff'}`);
        } else if (event.outcome === 'took-hand-card' && event.targetSeatId) {
          action(`${owner} took a hand card from ${name(event.targetSeatId)} (${ability})`);
        } else if ((event.outcome === 'compete-won' || event.outcome === 'compete-lost') && event.targetSeatId) {
          // "Seat 1 competed with Seat 2: 9 ♠ against 7 ♥, Seat 1 won", in place of the two "showed" lines.
          const mine = lastShown.get(event.owner.seatId);
          const theirs = lastShown.get(event.targetSeatId);
          for (const shown of [mine, theirs]) {
            const at = shown ? entries.lastIndexOf(shown.line) : -1;
            if (at >= 0) entries.splice(at, 1);
          }
          const faces = mine && theirs ? `: ${cardFaceLabel(mine.card)} against ${cardFaceLabel(theirs.card)}` : '';
          const winner = event.outcome === 'compete-won' ? owner : name(event.targetSeatId);
          action(`${owner} competed with ${name(event.targetSeatId)}${faces}, ${winner} won`);
          if (event.abilityId === 'heavens-justice') {
            action(`${owner}'s ${ability}: ${event.outcome === 'compete-won' ? 'one more Sha this turn, at any distance, with one more target' : 'no Sha this turn'}`);
          }
        } else if (event.outcome === 'reborn') {
          action(`${owner} used ${ability}: discards every card, draws 3, recovers to 3 HP and turns face up`);
        } else if (event.outcome === 'paid-weapon') {
          action(`${owner} discarded a Weapon for ${ability}`);
        } else if (event.outcome === 'struck' && event.targetSeatId) {
          action(`${owner} struck ${name(event.targetSeatId)} with ${ability}`);
        } else if (event.outcome === 'drew-up' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} draws up to its max HP`);
        } else if (event.outcome === 'judged-red' || event.outcome === 'judged-black') {
          action(`${owner}'s ${ability}: ${event.outcome === 'judged-red' ? 'black' : 'red'} hand cards can be used as Duel this turn`);
        } else if (event.outcome === 'discarded' && event.targetSeatId) {
          action(`${owner}'s ${ability}: discards one of ${name(event.targetSeatId)}'s cards`);
        } else if (event.outcome === 'recast') {
          action(`${owner} recast a club with ${ability}`);
        } else if (event.outcome === 'took-cards' && event.targetSeatId) {
          action(`${owner} took all of ${name(event.targetSeatId)}'s cards (${ability})`);
        } else if (event.outcome === 'exiled' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} turns over and draws cards`);
        } else if (event.outcome === 'revealed') {
          action(`${owner} used ${ability}`);
        } else if (event.outcome === 'culprit' && event.targetSeatId) {
          action(`${owner}'s ${ability}: the damage to ${name(event.targetSeatId)} counts as theirs`);
        } else if (event.outcome === 'took-card') {
          action(`${owner}'s ${ability}: took the Tool card`);
        } else if (event.outcome === 'drew' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} draws and discards`);
        } else if (event.outcome === 'gave' && event.targetSeatId) {
          action(`${owner} gave half of their hand to ${name(event.targetSeatId)} (${ability})`);
        } else if (event.outcome === 'collapsed') {
          action(`${owner} lost 1 HP to ${ability}`);
        } else if (event.outcome === 'collapsed-max') {
          action(`${owner} reduced their max HP with ${ability}`);
        } else if (event.outcome === 'swap-first' && event.targetSeatId) {
          swapFirst = event.targetSeatId;
        } else if (event.outcome === 'swapped' && event.targetSeatId) {
          action(`${swapFirst ? name(swapFirst) : 'A seat'} and ${name(event.targetSeatId)} swapped hands (${ability})`);
          swapFirst = null;
        }
        break;
      }
      case 'SelectionMadeEvent':
        if (event.of === 'cards') lastPicked = { seatId: event.seatId, count: event.ids.length };
        if (event.of === 'seats' && event.reason.kind === 'ability') {
          const picks = event.ids.map(name);
          const list = picks.length > 1 ? `${picks.slice(0, -1).join(', ')} and ${picks.at(-1)}` : picks[0];
          action(`${name(event.seatId)} picked ${list} with ${abilityName(event.reason.abilityId)}`);
        }
        break;
      case 'MaxHpReducedEvent':
        status(event.seatId, `${name(event.seatId)} now has a max HP of ${event.maxHp}`);
        break;
      case 'HpLostEvent':
        status(event.seatId, `${name(event.seatId)} lost ${event.amount} HP${event.abilityId ? ` (${abilityName(event.abilityId)})` : ''}`);
        break;
      case 'JudgmentChangedEvent':
        action(`${name(event.owner.seatId)}'s ${abilityName(event.abilityId)} changed the judgment to ${cardFaceLabel(event.card)}`, event.card);
        break;
      case 'ArrangementMadeEvent': {
        const top = event.top > 0 ? `${cards(event.top)} on top of the draw pile` : '';
        const bottom = event.bottom > 0 ? (top ? `${event.bottom} at the bottom` : `${cards(event.bottom)} at the bottom of the draw pile`) : '';
        action(`${name(event.seatId)} put ${[top, bottom].filter(Boolean).join(' and ')}`);
        break;
      }
      case 'SeatTurnedEvent':
        action(event.faceDown ? `${name(event.seatId)} turned face down` : event.passedTurn ? `${name(event.seatId)} turned face up and passed the turn` : `${name(event.seatId)} turned face up`);
        break;
      case 'CardShownEvent':
        action(`${name(event.seatId)} showed ${named(event.card)}`, event.card);
        lastShown.set(event.seatId, { card: event.card, line: entries[entries.length - 1] as ActionLine });
        break;
      case 'CardsTurnedUpEvent':
        action(`Turned up ${event.cards.length} ${event.cards.length === 1 ? 'card' : 'cards'}: ${event.cards.map(named).join(', ')}`);
        break;
      case 'JudgmentEvent':
        action(`${name(event.seatId)}'s ${judgmentReaderName(event.reader)} judgment: ${cardFaceLabel(event.card)}`, event.card);
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

// The latest action sequence, oldest first: the line that started it and every
// line since (responses, damage, dying, rescues, picks). Turn markers are skipped,
// so it stays on screen until the next sequence starts.
export function latestSequence(history: ActionHistoryEntry[]): ActionLine[] {
  const lines: ActionLine[] = [];
  for (const entry of history) {
    if (entry.kind !== 'action') continue;
    lines.push(entry);
    if (entry.starts) break;
  }
  return lines.reverse();
}
