import type { WritableSignal } from '@angular/core';
import { usedCardOf } from 'engine';
import type { GameState } from 'engine';
import { GameService } from './game.service';

// Puts a running game into a settled judgment (the judgmentNotice rule): the card is turned up, no skill can
// change it, and the game waits for an acknowledgement. The service's own state and bot timer are set directly,
// since reaching one by play takes luck. Seats are revealed and of different kingdoms so the game goes on afterwards.
// `eliminated` seats are taken out first.
export function settleJudgment(service: GameService, eliminated: string[] = []): void {
  const inner = service as unknown as { _state: WritableSignal<GameState | null>; scheduleBotIfDue(): void };
  const base = inner._state()!;
  const judged = { instanceId: 'judged-1', definitionId: 'sha', suit: 'heart' as const, rank: 5 };
  const lightning = { instanceId: 'lightning-1', definitionId: 'lightning', suit: 'spade' as const, rank: 1 };
  const generalIds = [...service.registry.generals.keys()];
  inner._state.set({
    ...base,
    phase: 'Play',
    generalSelection: null,
    rules: { judgmentNotice: true },
    seats: base.seats.map((seat, i) => ({
      ...seat,
      eliminated: eliminated.includes(seat.id),
      kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[i % 4],
      generals: { main: { generalDefinitionId: generalIds[2 * i], revealed: true }, deputy: { generalDefinitionId: generalIds[2 * i + 1], revealed: true } },
    })),
    zones: base.zones.map((z) => (z.kind === 'processing' ? { ...z, cards: [judged] } : z)),
    judgmentView: { seatId: 'seat-0', reader: { kind: 'card', card: usedCardOf(lightning) }, card: judged, changes: [], settled: true },
  });
  inner.scheduleBotIfDue();
}
