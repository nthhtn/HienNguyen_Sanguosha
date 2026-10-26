import { CardInstance, CardZone, ChoiceMadeEvent, EngineEvent, Player, Seat, UsedCard } from 'engine';
import { abilityName, baseSkillId, cardDisplayData, generalDisplayData, isRecast } from 'content';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';
import { abilityDisplayName, cardFaceLabel, cardIdDisplayName, Force, seatForce, generalDisplayName, judgmentReaderName, seatName, shownCardId, suitSymbol, targetLabel } from '../labels';
import { translateLabelText } from './choice-description';

export type ActionHistoryEntry =
  | { kind: 'turn'; turnNumber: number; seatName: string }
  // `force` is set on a line about a player's status (HP lost or recovered,
  // dying, saved, eliminated): that player's force colour. `starts` marks the
  // first line of an action sequence (latestSequence).
  | { kind: 'action'; text: string; card: CardInstance | null; force?: Force; starts?: true };

export type ActionLine = Extract<ActionHistoryEntry, { kind: 'action' }>;

function cardName(definitionId: string, tr: Translator): string {
  return cardDisplayData(definitionId, localeOf(tr))?.name ?? cardIdDisplayName(definitionId, tr);
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
  const name = (seatId: string) => seatName(players, seatId, tr);
  const target = (t: Parameters<typeof targetLabel>[0]) => targetLabel(t, players, tr);
  const named = (card: CardInstance) => tr('card.named', { name: cardName(card.definitionId, tr), face: cardFaceLabel(card) });
  // A used card for a history line: "Sha (7 ♠)" for one card used as itself,
  // otherwise its name.
  const usedLabel = (used: UsedCard) => {
    if (used.via) {
      const as = tr('history.via', { card: cardName(used.as, tr), ability: abilityDisplayName(used.via.abilityId, tr) });
      return used.physical.length === 1 ? tr('history.usedAs.card', { card: named(used.physical[0]), as }) : tr('history.usedAs.cards', { count: used.physical.length, as });
    }
    return used.physical.length === 1 && used.physical[0].definitionId === shownCardId(used) ? named(used.physical[0]) : cardName(shownCardId(used), tr);
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
    return id && id !== 'hidden' ? (generalDisplayData(id, localeOf(tr))?.name ?? generalDisplayName(id, tr)) : null;
  };
  // How many cards a seat picked last, for "gave 2 cards".
  let lastPicked: { seatId: string; count: number } | null = null;
  // The last face seen of each card, from moves into face-up zones.
  const knownFaces = new Map<string, CardInstance>();
  // The card each seat showed last, and its line (competing folds two into one).
  const lastShown = new Map<string, { card: CardInstance; line: ActionLine }>();
  // The card each seat last put under its General (Refusing Death), for its outcome line.
  const lastPutUnder = new Map<string, CardInstance>();
  // The last "chose a seat" line, so a skill's own outcome line can replace it (Fantasy).
  let lastChoseSeat: { line: ActionLine; seatId: string } | null = null;
  let swapFirst: string | null = null;
  // The user of the Chains being resolved, whose toggles it says ("Seat 1 chained
  // Hing"); cleared by damage and by the next card used on its own initiative.
  let chainsUser: string | null = null;
  let previous: EngineEvent | null = null;
  // The latest judgment line, remembered as data so "Counts as Shan" can fold into it
  // by seat and reader id instead of by reading its text.
  let lastJudgment: { line: ActionLine; seatId: string; readerId: string; reader: string; face: string } | null = null;
  // "Seat 1 took Hing's Silver Lion (A ♣) with Steal", "Seat 1 took a hand card
  // from Hing with Steal", "Seat 1 discarded Sha (7 ♠) from Hing's hand with Break".
  const pickLine = (made: ChoiceMadeEvent, face: CardInstance | undefined, ownerSeatId: string | undefined): string => {
    const tool =
      made.reason.kind === 'choice'
        ? tr('history.withSuffix', { tool: cardName(made.reason.card.as, tr) })
        : made.reason.kind === 'ability'
          ? tr('history.withSuffix', { tool: abilityDisplayName(made.reason.abilityId, tr) })
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
  const forceOfSeat = (seatId: string) => seatForce(seats.find((s) => s.id === seatId));
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
        if (!answered) {
          initiative = true;
          chainsUser = used.as === 'chains' && event.targets.length > 0 ? event.seatId : null;
        }
        const seat = name(event.seatId);
        if (isRecast(event)) {
          action(tr('history.recastCard', { seat, used: usedLabel(used) }), face);
        } else if (answered?.dyingSeatId) {
          const saved = answered.dyingSeatId === event.seatId ? tr('history.themselves') : name(answered.dyingSeatId);
          action(tr('history.useToSave', { seat, used: usedLabel(used), saved }), face);
        } else if (answered?.counters && answered.seatId) {
          action(tr('history.cancelCounter', { seat, owner: name(answered.seatId), card: cardName(shownCardId(used), tr), used: usedLabel(used) }), face);
        } else if (answered?.targetSeatId && answered.seatId) {
          const tool = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const params = { seat, owner: name(answered.seatId), tool: tool ? cardName(shownCardId(tool), tr) : tr('history.aTool'), used: usedLabel(used) };
          action(answered.targetSeatId === answered.seatId ? tr('history.cancelTool', params) : tr('history.cancelToolOn', { ...params, target: name(answered.targetSeatId) }), face);
        } else if (answered) {
          const answeredCard = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          action(
            answered.seatId
              ? answeredCard
                ? tr('history.usedAgainstCard', { seat, used: usedLabel(used), owner: name(answered.seatId), card: cardName(shownCardId(answeredCard), tr) })
                : tr('history.usedAgainst', { seat, used: usedLabel(used), owner: name(answered.seatId) })
              : tr('history.usedInResponse', { seat, used: usedLabel(used) }),
            face
          );
        } else if (cardDisplayData(used.as, localeOf(tr))?.category === 'equipment') {
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
          lastPutUnder.set(to.ownerSeatId, event.card);
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
        if (from.kind === 'equip' || from.kind === 'judgment') action(tr('history.wasDiscarded', { seat: name(from.ownerSeatId), card: cardName(event.card.definitionId, tr) }), event.card);
        break;
      }
      case 'DamageDealtEvent': {
        chainsUser = null;
        const { source, target: victim, amount, nature } = event.damage;
        const word = nature === 'fire' ? tr('damage.nature.fire') : tr('damage.nature.thunder');
        const params = { target: target(victim), amount, nature: word, ...(source ? { source: target(source) } : {}) };
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
          action(tr('history.revealedToUse', { seat, which, ability: abilityDisplayName(event.forAbilityId, tr) }));
        } else {
          action(tr(event.slot === 'main' ? 'history.revealedMain' : 'history.revealedDeputy', { seat }));
        }
        break;
      }
      case 'GeneralHiddenEvent':
        action(tr(event.slot === 'main' ? 'history.hiddenMain' : 'history.hiddenDeputy', { seat: name(event.seatId) }));
        break;
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
        // A secret pick (Ascertain's look, a Form's skill) is told by what follows, or not at all.
        if (event.secret) break;
        const { reason, shows } = event;
        const chooser = name(event.seatId);
        if (shows.kind === 'card' || shows.kind === 'hidden-hand') {
          picked = event;
        } else if (shows.kind === 'use' && reason.kind === 'ability') {
          // A reveal says it on its own line, next.
          if (!shows.reveals) {
            const ability = abilityDisplayName(reason.abilityId, tr);
            action(
              reason.targetSeatId && reason.targetSeatId !== event.seatId
                ? tr('history.usedAbilityOn', { chooser, ability, target: name(reason.targetSeatId) })
                : tr('history.usedAbility', { chooser, ability })
            );
          }
        } else if (shows.kind === 'decline' && reason.kind === 'choice') {
          action(tr('history.letDraw', { chooser, user: name(reason.userSeatId), card: cardName(reason.card.as, tr) }));
        } else if (shows.kind === 'seat') {
          const given = lastPicked?.seatId === event.seatId ? lastPicked.count : 0;
          action(event.verb === 'give' ? tr('history.gaveCards', { chooser, cards: cards(given), target: name(shows.seatId) }) : tr('history.chose', { chooser, what: name(shows.seatId) }));
          if (event.verb !== 'give') lastChoseSeat = { line: entries[entries.length - 1] as ActionLine, seatId: event.seatId };
        } else if (shows.kind === 'suit') {
          action(tr('history.namedSuit', { chooser, suit: suitSymbol(shows.suit) }));
        } else if (shows.kind === 'label' && reason.kind === 'ability' && reason.cardId) {
          // Believing or doubting a claim (Bewilder).
          action(tr(shows.text === 'Doubt' ? 'history.doubted' : 'history.believed', { chooser, owner: name(reason.owner.seatId), card: cardName(reason.cardId, tr) }));
        } else if (shows.kind === 'label') {
          action(tr('history.chose', { chooser, what: translateLabelText(shows.text, tr) }));
        }
        break;
      }
      case 'AbilityUsedEvent': {
        const owner = name(event.owner.seatId);
        const ability = abilityDisplayName(event.abilityId, tr);
        // The card names the sentences mention, looked up so they follow the locale.
        const sha = cardName('sha', tr);
        const shan = cardName('shan', tr);
        const duel = cardName('duel', tr);
        if (event.outcome === 'used') {
          action(baseSkillId(event.abilityId) === 'upheaval' ? tr('history.upheaval', { owner, ability, sha }) : tr('history.abilityUsed', { owner, ability }));
        } else if (event.outcome === 'no-effect' && event.targetSeatId) {
          // The card it stopped: named on the event (a cancelled card), else a Slash (armour).
          action(tr('history.noEffect', { owner, ability, target: name(event.targetSeatId), sha: event.cardId ? cardName(event.cardId, tr) : sha }));
        } else if (event.outcome === 'counts-as-shan') {
          // Said on its judgment's line when that is still the last line: the
          // same judged seat and reader, matched on ids, never on the text.
          const last = entries[entries.length - 1];
          if (lastJudgment && last === lastJudgment.line && lastJudgment.seatId === event.owner.seatId && lastJudgment.readerId === event.abilityId) {
            lastJudgment.line.text = tr('history.judgmentCountsAsShan', { seat: owner, reader: lastJudgment.reader, face: lastJudgment.face, shan });
          } else {
            action(tr('history.countsAsShan', { owner, ability, shan }));
          }
        } else if (event.outcome === 'more-damage') {
          action(tr('history.moreDamage', { owner, ability }));
        } else if (event.outcome === 'unblockable' && event.targetSeatId) {
          action(tr('history.unblockable', { owner, ability, target: name(event.targetSeatId), shan }));
        } else if (event.outcome === 'moved' && event.targetSeatId) {
          action(tr('history.movedSha', { owner, ability, target: name(event.targetSeatId), sha }));
        } else if (event.outcome === 'moved-damage' && event.targetSeatId) {
          // Said in place of the owner's own "chose Seat 3" line just before it.
          if (lastChoseSeat && entries[entries.length - 1] === lastChoseSeat.line && lastChoseSeat.seatId === event.owner.seatId) entries.pop();
          action(tr('history.movedDamage', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'stays-alive' || event.outcome === 'matched') {
          const turned = lastPutUnder.get(event.owner.seatId);
          action(tr(event.outcome === 'stays-alive' ? 'history.staysAlive' : 'history.rankMatched', { owner, ability, card: turned ? cardFaceLabel(turned) : tr('history.card') }));
        } else if ((event.outcome === 'claim-true' || event.outcome === 'claim-false') && event.cardId) {
          action(tr(event.outcome === 'claim-true' ? 'history.claimTrue' : 'history.claimFalse', { owner, card: cardName(event.cardId, tr) }));
        } else if (event.outcome === 'took-hand-card' && event.targetSeatId) {
          action(tr('history.tookHandCard', { owner, target: name(event.targetSeatId), ability }));
        } else if ((event.outcome === 'compete-won' || event.outcome === 'compete-lost') && event.targetSeatId) {
          // "Seat 1 competed with Seat 2: 9 ♠ against 7 ♥, Seat 1 won", in place of the two "showed" lines.
          const rival = name(event.targetSeatId);
          const mine = lastShown.get(event.owner.seatId);
          const theirs = lastShown.get(event.targetSeatId);
          for (const shown of [mine, theirs]) {
            const at = shown ? entries.lastIndexOf(shown.line) : -1;
            if (at >= 0) entries.splice(at, 1);
          }
          const winner = event.outcome === 'compete-won' ? owner : rival;
          action(
            mine && theirs
              ? tr('history.competedFaces', { owner, target: rival, mine: cardFaceLabel(mine.card), theirs: cardFaceLabel(theirs.card), winner })
              : tr('history.competed', { owner, target: rival, winner })
          );
          if (event.abilityId === 'heavens-justice') {
            action(tr(event.outcome === 'compete-won' ? 'history.heavensWon' : 'history.heavensLost', { owner, ability, sha }));
          }
        } else if (event.outcome === 'reborn') {
          action(tr('history.reborn', { owner, ability }));
        } else if (event.outcome === 'paid-weapon') {
          action(tr('history.paidWeapon', { owner, ability }));
        } else if (event.outcome === 'struck' && event.targetSeatId) {
          action(tr('history.struck', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'drew-up' && event.targetSeatId) {
          action(tr('history.drewUp', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'judged-red' || event.outcome === 'judged-black') {
          action(tr(event.outcome === 'judged-red' ? 'history.blackAsDuel' : 'history.redAsDuel', { owner, ability, duel }));
        } else if (event.outcome === 'discarded' && event.targetSeatId) {
          action(tr('history.discardedOne', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'recast') {
          action(tr('history.recast', { owner, ability }));
        } else if (event.outcome === 'took-cards' && event.targetSeatId) {
          action(tr('history.tookAllCards', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'exiled' && event.targetSeatId) {
          action(tr('history.exiled', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'revealed') {
          action(tr('history.abilityUsed', { owner, ability }));
        } else if (event.outcome === 'culprit' && event.targetSeatId) {
          action(tr('history.culprit', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'took-card') {
          action(tr('history.tookToolCard', { owner, ability }));
        } else if (event.outcome === 'drew' && event.targetSeatId) {
          action(tr('history.drawsAndDiscards', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'gave' && event.targetSeatId) {
          action(tr('history.gaveHalf', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'collapsed') {
          action(tr('history.collapsed', { owner, ability }));
        } else if (event.outcome === 'collapsed-max') {
          action(tr('history.collapsedMax', { owner, ability }));
        } else if (event.outcome.startsWith('skipped-')) {
          const raw = event.outcome.slice('skipped-'.length).replace(/^./, (c) => c.toUpperCase());
          const phase = raw === 'Judgment' || raw === 'Draw' || raw === 'Play' || raw === 'Discard' ? tr(`history.phase.${raw}` as const) : raw;
          action(tr('history.skippedOwnPhase', { owner, phase, ability }));
        } else if (event.outcome === 'moved-card' && event.targetSeatId) {
          action(tr('history.movedCard', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'farmed') {
          action(tr('history.farmed', { owner, ability }));
        } else if (event.outcome === 'awakened') {
          action(tr('history.awakened', { owner, ability }));
        } else if (event.outcome === 'paid' && event.targetSeatId) {
          action(tr('history.paidBasic', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'extra-turn' && event.targetSeatId) {
          action(tr('history.extraTurn', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'drew') {
          action(tr('history.drewCard', { owner, ability }));
        } else if (event.outcome === 'placed' && event.targetSeatId) {
          action(tr('history.placedEquipment', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'gave-back' && event.targetSeatId) {
          action(tr('history.gaveBack', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'lamented' && event.targetSeatId) {
          action(tr('history.lamented', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'silenced' && event.targetSeatId) {
          action(tr('history.silenced', { target: name(event.targetSeatId), ability }));
        } else if ((event.outcome === 'silenced-main' || event.outcome === 'silenced-deputy') && event.targetSeatId) {
          // Alternate Sorrow: one General of the seat, named by its place only.
          action(tr(event.outcome === 'silenced-main' ? 'history.silencedMain' : 'history.silencedDeputy', { target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'new-form') {
          action(tr('history.newForm', { owner, ability }));
        } else if (event.outcome === 'swap-first' && event.targetSeatId) {
          swapFirst = event.targetSeatId;
        } else if (event.outcome === 'swapped' && event.targetSeatId) {
          action(tr('history.swapped', { first: swapFirst ? name(swapFirst) : tr('history.aSeat'), second: name(event.targetSeatId), ability }));
          swapFirst = null;
        }
        break;
      }
      case 'SelectionMadeEvent':
        if (event.of === 'cards') lastPicked = { seatId: event.seatId, count: event.ids.length };
        if (event.of === 'seats' && event.reason.kind === 'ability') {
          const picks = event.ids.map(name);
          const list = picks.length > 1 ? tr('history.and', { head: picks.slice(0, -1).join(', '), last: picks.at(-1) ?? '' }) : picks[0];
          action(tr('history.pickedWith', { seat: name(event.seatId), list, ability: abilityDisplayName(event.reason.abilityId, tr) }));
        }
        break;
      case 'SkillGainedEvent':
        action(tr('history.gained', { seat: name(event.seatId), skill: abilityDisplayName(event.skillId, tr) }));
        break;
      case 'FormChosenEvent':
        action(tr('history.chosenForm', { seat: name(event.seatId), skill: abilityDisplayName(event.skillId, tr), general: generalDisplayData(event.generalId, localeOf(tr))?.name ?? tr('history.aForm') }));
        break;
      case 'MaxHpReducedEvent':
        status(event.seatId, tr('history.maxHp', { seat: name(event.seatId), maxHp: event.maxHp }));
        break;
      case 'HpLostEvent':
        status(
          event.seatId,
          event.abilityId
            ? tr('history.lostHpTo', { seat: name(event.seatId), amount: event.amount, ability: abilityDisplayName(event.abilityId, tr) })
            : tr('history.lostHp', { seat: name(event.seatId), amount: event.amount })
        );
        break;
      case 'JudgmentChangedEvent':
        action(tr('history.judgmentChanged', { owner: name(event.owner.seatId), ability: abilityDisplayName(event.abilityId, tr), face: cardFaceLabel(event.card) }), event.card);
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
      case 'JudgmentEvent': {
        const reader = judgmentReaderName(event.reader, tr);
        const face = cardFaceLabel(event.card);
        action(tr('history.judgment', { seat: name(event.seatId), reader, face }), event.card);
        lastJudgment = {
          line: entries[entries.length - 1] as ActionLine,
          seatId: event.seatId,
          readerId: event.reader.kind === 'card' ? event.reader.card.as : event.reader.owner.skillId,
          reader,
          face,
        };
        break;
      }
      case 'PhaseSkippedEvent':
        action(tr('history.phaseSkipped', { seat: name(event.seatId), phase: tr(`history.phase.${event.phase}` as const) }));
        break;
      case 'DiscardPileReshuffledEvent':
        action(tr('history.reshuffled', { count: event.cardCount }));
        break;
      case 'ChainToggledEvent': {
        const seat = name(event.seatId);
        // Fire or thunder damage just dealt to the seat unchained it.
        const byDamage = previous?.kind === 'DamageDealtEvent' && previous.damage.target.seatId === event.seatId;
        if (chainsUser && !byDamage) {
          const own = chainsUser === event.seatId;
          const key = event.chained ? (own ? 'history.chainedSelf' : 'history.chained') : own ? 'history.unchainedSelf' : 'history.unchained';
          action(tr(key, { user: name(chainsUser), seat }));
        } else {
          action(tr(event.chained ? 'history.wasChained' : 'history.wasUnchained', { seat }));
        }
        break;
      }
    }
    previous = event;
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
