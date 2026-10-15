import { CardInstance, CardZone, ChoiceMadeEvent, EngineEvent, Player, Seat, UsedCard } from 'engine';
import { abilityName, cardDisplayData, generalDisplayData } from 'content';
import { englishTranslator, Translator } from '../i18n/translator';
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

// The card shown beside a line: the physical card, when there is exactly one.
const faceOf = (used: UsedCard): CardInstance | null => (used.physical.length === 1 ? used.physical[0] : null);

// What happened at the table, read off the public log, most recent first, with
// a marker at the start of each turn. Phase changes are left out, and so is a
// used card's own trip to the discard pile: the "used" line already says it.
// Sentences are built through `tr`, English unless a translator is passed.
export function actionHistory(
  log: EngineEvent[],
  zones: CardZone[],
  players: readonly Player[] = [],
  seats: readonly Seat[] = [],
  tr: Translator = englishTranslator
): ActionHistoryEntry[] {
  const name = (seatId: string) => seatName(players, seatId);
  const target = (t: Parameters<typeof targetLabel>[0]) => targetLabel(t, players);
  const named = (card: CardInstance) => tr('card.named', { name: cardName(card.definitionId), face: cardFaceLabel(card) });
  // A used card for a history line: "Sha (7 ♠)" for one card used as itself,
  // otherwise its name.
  const usedLabel = (used: UsedCard) => {
    if (used.via) {
      const as = tr('history.via', { card: cardName(used.as), ability: abilityName(used.via.abilityId) });
      return used.physical.length === 1 ? tr('history.usedAs.card', { card: named(used.physical[0]), as }) : tr('history.usedAs.cards', { count: used.physical.length, as });
    }
    return used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
  };
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const playedCards = new Map<string, UsedCard>();
  // Cards used but not yet moved on: their next move is the play's own.
  const awaitingMove = new Set<string>();
  // A pick waiting for its card's move, which says what was picked.
  let picked: ChoiceMadeEvent | null = null;
  const cards = (n: number) => tr(n === 1 ? 'history.cards.one' : 'history.cards.other', { n });
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
    const tool =
      made.reason.kind === 'choice'
        ? tr('history.withSuffix', { tool: cardName(made.reason.card.as) })
        : made.reason.kind === 'ability'
          ? tr('history.withSuffix', { tool: abilityName(made.reason.abilityId) })
          : '';
    const chooser = name(made.seatId);
    if (made.shows.kind === 'hidden-hand') {
      return made.verb === 'take'
        ? tr('history.pickHandTook', { chooser, owner: name(made.shows.seatId), tool })
        : tr('history.pickHandDiscarded', { chooser, card: face ? named(face) : tr('history.aCard'), owner: name(made.shows.seatId), tool });
    }
    const what = face ? named(face) : tr('history.aCard');
    const whose = ownerSeatId && ownerSeatId !== made.seatId ? tr('history.possessive', { owner: name(ownerSeatId), thing: what }) : what;
    return tr(made.verb === 'take' ? 'history.pickTook' : 'history.pickDiscarded', { chooser, what: whose, tool });
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
        const seat = name(event.seatId);
        if (answered?.dyingSeatId) {
          const saved = answered.dyingSeatId === event.seatId ? tr('history.themselves') : name(answered.dyingSeatId);
          action(tr('history.useToSave', { seat, used: usedLabel(used), saved }), face);
        } else if (answered?.counters && answered.seatId) {
          action(tr('history.cancelCounter', { seat, owner: name(answered.seatId), card: cardName(used.as), used: usedLabel(used) }), face);
        } else if (answered?.targetSeatId && answered.seatId) {
          const tool = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const params = { seat, owner: name(answered.seatId), tool: tool ? cardName(tool.as) : tr('history.aTool'), used: usedLabel(used) };
          action(answered.targetSeatId === answered.seatId ? tr('history.cancelTool', params) : tr('history.cancelToolOn', { ...params, target: name(answered.targetSeatId) }), face);
        } else if (answered) {
          const answeredCard = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          action(
            answered.seatId
              ? answeredCard
                ? tr('history.usedAgainstCard', { seat, used: usedLabel(used), owner: name(answered.seatId), card: cardName(answeredCard.as) })
                : tr('history.usedAgainst', { seat, used: usedLabel(used), owner: name(answered.seatId) })
              : tr('history.usedInResponse', { seat, used: usedLabel(used) }),
            face
          );
        } else if (cardDisplayData(used.as)?.category === 'equipment') {
          action(tr('history.equipped', { seat, used: usedLabel(used) }), face);
        } else if (event.targets.length > 0) {
          action(tr('history.usedOn', { seat, used: usedLabel(used), targets: event.targets.map(target).join(', ') }), face);
        } else {
          action(tr('history.used', { seat, used: usedLabel(used) }), face);
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
          action(tr('history.tookFrom', { taker: name(to.ownerSeatId), owner: name(from.ownerSeatId), card: face ? named(face) : tr('history.card') }), face ?? null);
          break;
        }
        // A card put under a General (Refusing Death).
        if (event.card && to?.kind === 'pile' && to.ownerSeatId) {
          action(tr('history.putUnder', { seat: name(to.ownerSeatId), card: named(event.card) }), event.card);
          break;
        }
        // Lightning moving on to the next seat's judgment area.
        if (event.card && from?.kind === 'judgment' && to?.kind === 'judgment' && from.ownerSeatId && to.ownerSeatId) {
          action(tr('history.movedOn', { card: named(event.card), from: name(from.ownerSeatId), to: name(to.ownerSeatId) }), event.card);
          break;
        }
        if (!event.card || to?.kind !== 'discardPile' || !from?.ownerSeatId) break;
        if (from.kind === 'hand') action(tr('history.discardedCard', { seat: name(from.ownerSeatId), card: named(event.card) }), event.card);
        if (from.kind === 'equip' || from.kind === 'judgment') action(tr('history.wasDiscarded', { seat: name(from.ownerSeatId), card: cardName(event.card.definitionId) }), event.card);
        break;
      }
      case 'DamageDealtEvent': {
        const { source, target: victim, amount, nature } = event.damage;
        const params = { target: target(victim), amount, nature, ...(source ? { source: target(source) } : {}) };
        const key = nature === 'normal' ? (source ? 'history.tookDamageFrom' : 'history.tookDamage') : source ? 'history.tookNatureDamageFrom' : 'history.tookNatureDamage';
        status(victim.seatId, tr(key, params));
        break;
      }
      case 'HealEvent':
        status(event.target.seatId, tr('history.recovered', { target: target(event.target), amount: event.amount }));
        break;
      case 'CardsDrawnEvent': {
        const n = event.cardInstanceIds.length;
        action(tr(n === 1 ? 'history.drew.one' : 'history.drew.other', { seat: name(event.seatId), n }));
        break;
      }
      case 'GeneralRevealedEvent': {
        const seat = name(event.seatId);
        if (event.forAbilityId) {
          const which = generalIn(event.seatId, event.slot) ?? tr(event.slot === 'main' ? 'history.theirMain' : 'history.theirDeputy');
          action(tr('history.revealedToUse', { seat, which, ability: abilityName(event.forAbilityId) }));
        } else {
          action(tr(event.slot === 'main' ? 'history.revealedMain' : 'history.revealedDeputy', { seat }));
        }
        break;
      }
      case 'SeatDyingEvent':
        status(event.seatId, tr('history.dying', { seat: name(event.seatId) }));
        break;
      case 'SeatSavedEvent':
        status(event.seatId, tr('history.saved', { seat: name(event.seatId) }));
        break;
      case 'SeatEliminatedEvent':
        status(event.seatId, tr('history.eliminated', { seat: name(event.seatId) }));
        break;
      case 'GeneralsChosenEvent':
        action(tr('history.generalsChosen', { seat: name(event.seatId) }));
        break;
      case 'ChoiceMadeEvent': {
        const { reason, shows } = event;
        const chooser = name(event.seatId);
        if (shows.kind === 'card' || shows.kind === 'hidden-hand') {
          picked = event;
        } else if (shows.kind === 'use' && reason.kind === 'ability') {
          // A reveal says it on its own line, next.
          if (!shows.reveals) {
            const ability = abilityName(reason.abilityId);
            action(
              reason.targetSeatId && reason.targetSeatId !== event.seatId
                ? tr('history.usedAbilityOn', { chooser, ability, target: name(reason.targetSeatId) })
                : tr('history.usedAbility', { chooser, ability })
            );
          }
        } else if (shows.kind === 'decline' && reason.kind === 'choice') {
          action(tr('history.letDraw', { chooser, user: name(reason.userSeatId), card: cardName(reason.card.as) }));
        } else if (shows.kind === 'seat') {
          const given = lastPicked?.seatId === event.seatId ? lastPicked.count : 0;
          action(event.verb === 'give' ? tr('history.gaveCards', { chooser, cards: cards(given), target: name(shows.seatId) }) : tr('history.chose', { chooser, what: name(shows.seatId) }));
        } else if (shows.kind === 'suit') {
          action(tr('history.namedSuit', { chooser, suit: suitSymbol(shows.suit) }));
        } else if (shows.kind === 'label' && reason.kind === 'ability' && reason.cardId) {
          // Believing or doubting a claim (Bewilder).
          action(tr(shows.text === 'Doubt' ? 'history.doubted' : 'history.believed', { chooser, owner: name(reason.owner.seatId), card: cardName(reason.cardId) }));
        } else if (shows.kind === 'label') {
          action(tr('history.chose', { chooser, what: shows.text }));
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
        } else if (event.outcome.startsWith('skipped-')) {
          action(`${owner} skipped their ${event.outcome.slice('skipped-'.length).replace(/^./, (c) => c.toUpperCase())} Phase with ${ability}`);
        } else if (event.outcome === 'moved-card' && event.targetSeatId) {
          action(`${owner} moved a card to ${name(event.targetSeatId)} (${ability})`);
        } else if (event.outcome === 'farmed') {
          action(`${owner}'s ${ability}: the judged card becomes a Farm`);
        } else if (event.outcome === 'awakened') {
          action(`${owner} awakened: ${ability}`);
        } else if (event.outcome === 'paid' && event.targetSeatId) {
          action(`${name(event.targetSeatId)} discarded a Basic card for ${owner}'s ${ability}`);
        } else if (event.outcome === 'extra-turn' && event.targetSeatId) {
          action(`${owner} gave ${name(event.targetSeatId)} an extra turn (${ability})`);
        } else if (event.outcome === 'drew') {
          action(`${owner} drew a card (${ability})`);
        } else if (event.outcome === 'placed' && event.targetSeatId) {
          action(`${owner} placed an Equipment card in ${name(event.targetSeatId)}'s equipment (${ability})`);
        } else if (event.outcome === 'gave-back' && event.targetSeatId) {
          action(`${owner} gave a discarded card back to ${name(event.targetSeatId)} and took the rest (${ability})`);
        } else if (event.outcome === 'lamented' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} judges`);
        } else if (event.outcome === 'silenced' && event.targetSeatId) {
          action(`${name(event.targetSeatId)} loses all skills (${ability})`);
        } else if (event.outcome === 'new-form') {
          action(`${owner} gained a Form (${ability})`);
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
          const list = picks.length > 1 ? tr('history.and', { head: picks.slice(0, -1).join(', '), last: picks.at(-1) ?? '' }) : picks[0];
          action(tr('history.pickedWith', { seat: name(event.seatId), list, ability: abilityName(event.reason.abilityId) }));
        }
        break;
      case 'SkillGainedEvent':
        action(tr('history.gained', { seat: name(event.seatId), skill: abilityName(event.skillId) }));
        break;
      case 'FormChosenEvent':
        action(tr('history.chosenForm', { seat: name(event.seatId), skill: abilityName(event.skillId), general: generalDisplayData(event.generalId)?.name ?? tr('history.aForm') }));
        break;
      case 'MaxHpReducedEvent':
        status(event.seatId, tr('history.maxHp', { seat: name(event.seatId), maxHp: event.maxHp }));
        break;
      case 'HpLostEvent':
        status(
          event.seatId,
          event.abilityId
            ? tr('history.lostHpTo', { seat: name(event.seatId), amount: event.amount, ability: abilityName(event.abilityId) })
            : tr('history.lostHp', { seat: name(event.seatId), amount: event.amount })
        );
        break;
      case 'JudgmentChangedEvent':
        action(tr('history.judgmentChanged', { owner: name(event.owner.seatId), ability: abilityName(event.abilityId), face: cardFaceLabel(event.card) }), event.card);
        break;
      case 'ArrangementMadeEvent': {
        const top = event.top > 0 ? tr('history.arrangeTop', { cards: cards(event.top) }) : '';
        const bottom = event.bottom > 0 ? (top ? tr('history.arrangeBottom', { n: event.bottom }) : tr('history.arrangeBottomOnly', { cards: cards(event.bottom) })) : '';
        const parts = [top, bottom].filter(Boolean);
        action(tr('history.arranged', { seat: name(event.seatId), parts: parts.length > 1 ? tr('history.and', { head: parts[0], last: parts[1] }) : (parts[0] ?? '') }));
        break;
      }
      case 'SeatTurnedEvent':
        action(tr(event.faceDown ? 'history.seatDown' : event.passedTurn ? 'history.seatUpPassed' : 'history.seatUp', { seat: name(event.seatId) }));
        break;
      case 'CardShownEvent':
        action(tr('history.showed', { seat: name(event.seatId), card: named(event.card) }), event.card);
        lastShown.set(event.seatId, { card: event.card, line: entries[entries.length - 1] as ActionLine });
        break;
      case 'CardsTurnedUpEvent':
        action(tr('history.turnedUp', { cards: cards(event.cards.length), list: event.cards.map(named).join(', ') }));
        break;
      case 'JudgmentEvent':
        action(tr('history.judgment', { seat: name(event.seatId), reader: judgmentReaderName(event.reader), face: cardFaceLabel(event.card) }), event.card);
        break;
      case 'PhaseSkippedEvent':
        action(tr('history.phaseSkipped', { seat: name(event.seatId), phase: tr(`history.phase.${event.phase}` as const) }));
        break;
      case 'DiscardPileReshuffledEvent':
        action(tr('history.reshuffled', { count: event.cardCount }));
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
