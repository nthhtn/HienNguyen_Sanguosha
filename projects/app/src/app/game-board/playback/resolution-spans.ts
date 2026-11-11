import type { EngineEvent } from 'engine';
import type { ResolutionSpan } from 'content';

export interface FoundSpan {
  span: ResolutionSpan;
  // The log index of the span's last event: the notice shows once the beat there has played.
  endIndex: number;
}

export interface SpanScan {
  spans: FoundSpan[];
  // Where the next scan starts: the start of a span still open, or the end of the log.
  resumeFrom: number;
}

interface OpenSpan {
  sourceId: string;
  userSeatId: string;
  targetSeatIds: string[];
  startIndex: number;
}

// Finds the resolutions with a notice in `log` from index `from`. A span opens at a card's play (or at a
// skill's announcement) whose id has a notice, and ends before the next play of a card that is not an
// answer, before a phase or turn change, or at the end of the log once the game is `settled` (nothing is
// waiting on a decision). An open span that is not yet finished is left for the next scan.
export function resolutionSpans(log: readonly EngineEvent[], from: number, settled: boolean, isRegistered: (id: string) => boolean): SpanScan {
  const spans: FoundSpan[] = [];
  let open: OpenSpan | null = null;
  const close = (endIndex: number) => {
    if (!open) return;
    spans.push({ endIndex, span: { ...open, endIndex, events: log.slice(open.startIndex, endIndex + 1) as EngineEvent[] } });
    open = null;
  };
  for (let i = from; i < log.length; i++) {
    const event = log[i];
    if (event.kind === 'CardPlayedEvent' && !event.inResponseTo) {
      close(i - 1);
      if (isRegistered(event.card.as)) open = { sourceId: event.card.as, userSeatId: event.seatId, targetSeatIds: event.targets.map((t) => t.seatId), startIndex: i };
    } else if (event.kind === 'PhaseChangedEvent' || event.kind === 'TurnAdvancedEvent') {
      close(i - 1);
    } else if (event.kind === 'AbilityUsedEvent' && !open && isRegistered(event.abilityId)) {
      open = { sourceId: event.abilityId, userSeatId: event.owner.seatId, targetSeatIds: event.targetSeatId ? [event.targetSeatId] : [], startIndex: i };
    }
  }
  if (open && settled) close(log.length - 1);
  const openFrom = (open as OpenSpan | null)?.startIndex;
  return { spans, resumeFrom: openFrom ?? log.length };
}
