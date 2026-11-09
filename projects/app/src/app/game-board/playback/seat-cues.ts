import { abilityName } from 'content';
import { cardIdDisplayName, shownCardId } from '../../labels';
import { msg, Msg } from '../../i18n/msg';
import { englishTranslator, localeOf, Translator } from '../../i18n/translator';
import type { PlannedBeat } from './beats';

// What one seat shows during a beat: a hit or heal, a floating number, a bubble above it, a flip of its
// portrait; `involved` keeps it out of the dimmed backdrop.
export interface SeatCue {
  impact?: 'hit' | 'heal';
  floatText?: string;
  callout?: { text: Msg; tone: 'play' | 'red' | 'pass' };
  involved: boolean;
  reveal?: boolean;
}

// Whose resolution is on the table: the card's user and its targets.
export interface ResolutionCentre {
  sourceSeatId?: string;
  targetSeatIds: string[];
}

export const NO_CENTRE: ResolutionCentre = { targetSeatIds: [] };

// The resolution after a beat: a non-response play starts one (a response leaves it as it was), and it ends
// when the centre empties.
export function nextCentre(centre: ResolutionCentre, beat: PlannedBeat | null, centreStackSize: number): ResolutionCentre {
  if (centreStackSize === 0) return NO_CENTRE;
  const visual = beat?.visual;
  if (visual?.kind === 'play' && !visual.response) return { sourceSeatId: visual.seatId, targetSeatIds: visual.targetSeatIds };
  return centre;
}

// The cue of each seat the beat or the resolution touches; a seat not listed is not involved.
export function seatCues(beat: PlannedBeat | null, centre: ResolutionCentre, tr: Translator = englishTranslator): Record<string, SeatCue> {
  const cues: Record<string, SeatCue> = {};
  const cue = (seatId: string | undefined): SeatCue | undefined => {
    if (!seatId) return undefined;
    return (cues[seatId] ??= { involved: true });
  };
  cue(centre.sourceSeatId);
  centre.targetSeatIds.forEach(cue);
  const visual = beat?.visual;
  if (!visual) return cues;
  switch (visual.kind) {
    case 'play': {
      cue(visual.seatId)!.callout = { text: msg('cue.play', { card: cardIdDisplayName(shownCardId(visual.card), tr) }), tone: 'play' };
      visual.targetSeatIds.forEach(cue);
      cue(visual.answersSeatId);
      break;
    }
    case 'pass':
      cue(visual.seatId)!.callout = {
        text: visual.cardId ? msg('cue.pass', { card: cardIdDisplayName(visual.cardId, tr) }) : msg('cue.passed'),
        tone: 'pass',
      };
      break;
    case 'damage': {
      const target = cue(visual.seatId)!;
      target.impact = 'hit';
      target.floatText = `−${visual.amount}`;
      cue(visual.sourceSeatId);
      break;
    }
    case 'heal': {
      const target = cue(visual.seatId)!;
      target.impact = 'heal';
      target.floatText = `+${visual.amount}`;
      break;
    }
    case 'dying':
      cue(visual.seatId)!.callout = { text: msg('cue.help'), tone: 'red' };
      break;
    // The tile's own stamp says Eliminated; the beat only keeps the seat in the spotlight.
    case 'eliminated':
      cue(visual.seatId);
      break;
    case 'reveal':
      cue(visual.seatId)!.reveal = true;
      break;
    case 'ability':
      cue(visual.seatId)!.callout = { text: { text: abilityName(visual.abilityId, localeOf(tr)) }, tone: 'play' };
      break;
    case 'saved':
      cue(visual.seatId);
      break;
    default:
      break;
  }
  return cues;
}
