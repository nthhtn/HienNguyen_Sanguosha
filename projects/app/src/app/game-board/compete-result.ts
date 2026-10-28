import { CardInstance, EngineEvent, Player, Seat } from 'engine';
import { competeOutcomeText, generalDisplayData } from 'content';
import { abilityDisplayName, Force, rankLabel, seatForce, generalDisplayName, seatName } from '../labels';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';

export interface CompetePlayer {
  seatId: string;
  name: string;
  // The General shown for the seat, null while it has none face up.
  generalId: string | null;
  // The seat's own Force, for its side of the popup to wear.
  force: Force;
  card: CardInstance;
}

// Everything the Compete popup shows, read off the public log.
export interface CompeteResult {
  // Unique per Compete (its log index), so each opens its popup once.
  id: string;
  abilityId: string;
  abilityName: string;
  skillText: string | null;
  generalId: string | null;
  generalName: string;
  // The source General's Force: the popup's colour theme.
  force: Force;
  user: CompetePlayer;
  target: CompetePlayer;
  won: boolean;
  // Equal ranks: the challenger loses a tie.
  tie: boolean;
  // The two ranks that were compared, the winner's first (equal on a tie), for the line under the cards.
  comparison: { winnerRank: string; loserRank: string; tie: boolean };
  winnerName: string;
  outcome: string | null;
}

// The Competes in `log` from index `from` on (earlier events only supply the
// cards shown). Skips one whose cards weren't shown.
export function competeResults(log: readonly EngineEvent[], from: number, seats: readonly Seat[], players: readonly Player[] = [], tr: Translator = englishTranslator): CompeteResult[] {
  const results: CompeteResult[] = [];
  const lastShown = new Map<string, CardInstance>();
  const faceUpGeneral = (seat: Seat | undefined): string | null => {
    const generals = seat?.generals;
    const shown = generals && (generals.main.revealed ? generals.main : generals.deputy.revealed ? generals.deputy : null);
    return shown && shown.generalDefinitionId !== 'hidden' ? shown.generalDefinitionId : null;
  };
  log.forEach((event, index) => {
    if (event.kind === 'CardShownEvent') lastShown.set(event.seatId, event.card);
    if (event.kind !== 'AbilityUsedEvent' || index < from) return;
    if ((event.outcome !== 'compete-won' && event.outcome !== 'compete-lost') || !event.targetSeatId) return;
    const mine = lastShown.get(event.owner.seatId);
    const theirs = lastShown.get(event.targetSeatId);
    if (!mine || !theirs) return;
    const sourceSeat = seats.find((s) => s.id === event.owner.seatId);
    const targetSeat = seats.find((s) => s.id === event.targetSeatId);
    const won = event.outcome === 'compete-won';
    const userName = seatName(players, event.owner.seatId, tr);
    const targetName = seatName(players, event.targetSeatId, tr);
    // The General whose skill it is, when the viewer can see it.
    const slot = event.owner.kind === 'general' ? event.owner.slot : null;
    const sourceGeneral = slot ? sourceSeat?.generals?.[slot].generalDefinitionId : undefined;
    const generalId = sourceGeneral && sourceGeneral !== 'hidden' ? sourceGeneral : null;
    const display = generalId ? generalDisplayData(generalId, localeOf(tr)) : null;
    const name = abilityDisplayName(event.abilityId, tr);
    results.push({
      id: `compete-${index}`,
      abilityId: event.abilityId,
      abilityName: name,
      skillText: display?.skills.find((s) => s.name === name)?.text ?? null,
      generalId,
      generalName: generalId ? (display?.name ?? generalDisplayName(generalId, tr)) : generalDisplayName('hidden', tr),
      force: seatForce(sourceSeat),
      user: { seatId: event.owner.seatId, name: userName, generalId: faceUpGeneral(sourceSeat), force: seatForce(sourceSeat), card: mine },
      target: { seatId: event.targetSeatId, name: targetName, generalId: faceUpGeneral(targetSeat), force: seatForce(targetSeat), card: theirs },
      won,
      tie: mine.rank === theirs.rank,
      comparison: { winnerRank: rankLabel(won ? mine.rank : theirs.rank), loserRank: rankLabel(won ? theirs.rank : mine.rank), tie: mine.rank === theirs.rank },
      winnerName: won ? userName : targetName,
      outcome: competeOutcomeText(event.abilityId, won, { user: userName, target: targetName }, localeOf(tr)),
    });
  });
  return results;
}
