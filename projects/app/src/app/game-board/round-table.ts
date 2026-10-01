import { Component, computed, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameState } from 'engine';
import { cardIdDisplayName, eventLabel } from '../labels';
import { SeatTile } from './seat-tile';
import { CardArt } from './card-art';
import { seatPlacements } from './table-layout';

const RECENT_LOG_LINES = 3;

// The seats arranged around a rounded rectangular table, seen from the viewer's chair.
// Presentational: everything shown is read straight off the (redacted) state.
@Component({
  selector: 'app-round-table',
  imports: [SeatTile, MatProgressSpinnerModule, CardArt],
  template: `
    <div class="table">
      <div class="felt"></div>
      <div class="centre">
        <div class="turn">Turn {{ state().turn.turnNumber }} · {{ state().phase }}</div>
        <div>{{ state().turn.ownerSeatId }}'s turn</div>
        @if (state().pendingResponse; as pending) {
          <div class="waiting">Waiting on {{ pending.respondingSeatId }}</div>
        }
        @if (thinkingSeatId(); as thinking) {
          <div class="thinking"><mat-progress-spinner mode="indeterminate" diameter="14" /> {{ thinking }} is thinking…</div>
        }
        <div class="piles">Draw pile {{ pileCount('drawPile') }}</div>
        <div class="discard">
          @if (lastDiscard(); as card) {
            <app-card-art size="small" [id]="card.definitionId" [label]="cardIdDisplayName(card.definitionId)" />
            <div class="discard-text">
              <div>Last discarded: {{ cardIdDisplayName(card.definitionId) }}</div>
              <div>Discard {{ pileCount('discardPile') }}</div>
            </div>
          } @else {
            <div class="discard-empty" aria-hidden="true"></div>
            <div class="discard-text"><div>Discard 0</div></div>
          }
        </div>
        <ul class="recent">
          @for (line of recentLog(); track $index) {
            <li>{{ line }}</li>
          }
        </ul>
      </div>
      @for (p of placements(); track p.seat.id) {
        <div class="seat" [attr.data-seat-id]="p.seat.id" [style.left.%]="p.x" [style.top.%]="p.y">
          <app-seat-tile
            [seat]="p.seat"
            [handCount]="handCount(p.seat.hand.zoneId)"
            [isViewer]="p.isViewer"
            [isTurnOwner]="p.seat.id === state().turn.ownerSeatId"
            [isResponding]="p.seat.id === state().pendingResponse?.respondingSeatId"
            [isBot]="botSeatIds().includes(p.seat.id)"
            [equipment]="equipmentOf(p.seat.equipped.zoneId)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    .table {
      position: relative;
      width: 100%;
      max-width: 1280px;
      /* Room for half a seat tile above the top rim and below the bottom rim. */
      margin: 130px auto 120px;
      aspect-ratio: 16 / 10;
    }
    .felt {
      position: absolute;
      /* Rounded rectangle whose edges run through the seat rim (table-layout.ts). */
      inset: 12% 8%;
      border-radius: 36px;
      background: radial-gradient(ellipse at center, #3f7d4e 0%, #2b5c38 70%, #234a2e 100%);
      border: 10px solid #7a5230;
      box-shadow: inset 0 0 30px rgb(0 0 0 / 45%), 0 6px 18px rgb(0 0 0 / 30%);
    }
    .centre {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 42%;
      color: #f4f1e8;
      text-align: center;
      font-size: 1.05em;
    }
    .turn { font-size: 1.25em; font-weight: bold; }
    .waiting { color: #ffcc80; font-weight: bold; }
    .thinking { display: flex; align-items: center; justify-content: center; gap: 6px; color: #b1c5ff; --mdc-circular-progress-active-indicator-color: #b1c5ff; --mat-progress-spinner-active-indicator-color: #b1c5ff; }
    .recent { list-style: none; padding: 0; margin: 6px 0 0; opacity: 0.85; font-size: 0.9em; }
    .discard { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0; }
    .discard-text { text-align: left; }
    .discard-empty { width: 44px; height: 60px; border: 1px dashed rgb(255 255 255 / 50%); border-radius: 4px; }
    .seat { position: absolute; transform: translate(-50%, -50%); }
    @media (max-width: 600px) {
      /* Narrower than the viewport so rim seats (at 8% / 92%) stay on screen. */
      .table { aspect-ratio: 1; width: 80%; margin: 64px auto 56px; }
      .felt { inset: 12% 8%; border-radius: 24px; }
      .centre { width: 44%; font-size: 0.7em; }
      .seat { transform: translate(-50%, -50%) scale(0.48); }
    }
  `,
})
export class RoundTable {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input.required<string>();
  readonly thinkingSeatId = input<string | null>(null);
  readonly botSeatIds = input<string[]>([]);

  protected readonly placements = computed(() => seatPlacements(this.state().seats, this.viewerSeatId()));

  protected readonly recentLog = computed(() => this.state().log.slice(-RECENT_LOG_LINES).map(eventLabel));

  // moveCard appends, so the discard pile's last card is the most recent discard.
  protected readonly lastDiscard = computed(() => {
    const cards = this.state().zones.find((z) => z.kind === 'discardPile')?.cards ?? [];
    return cards.length > 0 ? cards[cards.length - 1] : null;
  });

  protected readonly cardIdDisplayName = cardIdDisplayName;

  protected equipmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  protected handCount(zoneId: string): number {
    return this.state().zones.find((z) => z.id === zoneId)?.cards.length ?? 0;
  }

  protected pileCount(kind: 'drawPile' | 'discardPile'): number {
    return this.state().zones.find((z) => z.kind === kind)?.cards.length ?? 0;
  }
}
