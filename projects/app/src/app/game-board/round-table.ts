import { Component, computed, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameState } from 'engine';
import { actionHistory } from './action-history';
import { waitingLine } from './response-description';
import { seatName } from '../labels';
import { SeatTile } from './seat-tile';
import { PlayingCard } from './playing-card';
import { seatPlacements } from './table-layout';

const RECENT_LOG_LINES = 3;

// The seats arranged around a rounded rectangular table, seen from the viewer's chair.
// The discard pile sits beside the table (discard-pile.ts), not on it.
// Presentational: everything shown is read straight off the (redacted) state.
@Component({
  selector: 'app-round-table',
  imports: [SeatTile, PlayingCard, MatProgressSpinnerModule],
  template: `
    <div class="table" [class.crowded]="state().seats.length > 6">
      <div class="felt"></div>
      <div class="centre">
        <div class="turn">Turn {{ state().turn.turnNumber }}</div>
        <div>{{ name(state().turn.ownerSeatId) }}'s turn</div>
        @if (waiting(); as line) {
          <div class="waiting">{{ line }}</div>
        }
        @if (thinkingSeatId(); as thinking) {
          <div class="thinking"><mat-progress-spinner mode="indeterminate" diameter="14" /> {{ name(thinking) }} is thinking…</div>
        }
        <div class="piles">Draw Pile {{ drawPileCount() }}</div>
        @if (turnedUp().length > 0) {
          <div class="turned-up" aria-label="Turned Up Cards">
            @for (card of turnedUp(); track card.instanceId) {
              <app-playing-card [card]="card" size="small" />
            }
          </div>
        }
        <ul class="recent">
          @for (line of recentLog(); track $index) {
            <li><span [class.force-status]="!!line.force" [attr.data-force]="line.force ?? null">{{ line.text }}</span></li>
          }
        </ul>
      </div>
      @for (p of placements(); track p.seat.id) {
        <div class="seat" [attr.data-seat-id]="p.seat.id" [style.left.%]="p.x" [style.top.%]="p.y">
          <app-seat-tile
            [seat]="p.seat"
            [name]="name(p.seat.id)"
            [handCount]="handCount(p.seat.hand.zoneId)"
            [isViewer]="p.isViewer"
            [isTurnOwner]="p.seat.id === state().turn.ownerSeatId"
            [isResponding]="p.seat.id === (state().pendingChoice?.seatId ?? state().pendingResponse?.respondingSeatId)"
            [isBot]="botSeatIds().includes(p.seat.id)"
            [equipment]="equipmentOf(p.seat.equipped.zoneId)"
            [judgment]="judgmentOf(p.seat.judgment.zoneId)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    /* The table sizes itself from the room it actually has (beside the side
       panel or not), not from the viewport. */
    :host { display: block; container-type: inline-size; }
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
    .turned-up { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-top: 4px; }
    .waiting { color: #ffcc80; font-weight: bold; }
    .thinking { display: flex; align-items: center; justify-content: center; gap: 6px; color: #b1c5ff; --mdc-circular-progress-active-indicator-color: #b1c5ff; --mat-progress-spinner-active-indicator-color: #b1c5ff; }
    .recent { list-style: none; padding: 0; margin: 6px 0 0; opacity: 0.85; font-size: 0.9em; }
    /* Status lines in the player's force colour, on a light chip to read on the felt. */
    .recent .force-status { padding: 0 6px; border-radius: 6px; background: rgb(255 255 255 / 92%); }
    .seat { position: absolute; transform: translate(-50%, -50%) scale(var(--crowd, 1)); }
    /* Seat tiles are sized for a full-width table; scale them down in steps as
       the table's container narrows, so rim seats stay on screen and clear of
       the centre. Each step is the old viewport step minus the page's 32px of
       side padding, so the layout without the side panel is unchanged. */
    @container (max-width: 1247px) { .seat { transform: translate(-50%, -50%) scale(calc(0.8 * var(--crowd, 1))); } }
    @container (max-width: 991px) { .seat { transform: translate(-50%, -50%) scale(calc(0.66 * var(--crowd, 1))); } .table { margin: 100px auto 90px; } }
    @container (max-width: 867px) { .seat { transform: translate(-50%, -50%) scale(calc(0.58 * var(--crowd, 1))); } .centre { width: 38%; } }
    @container (max-width: 767px) { .seat { transform: translate(-50%, -50%) scale(calc(0.5 * var(--crowd, 1))); } .table { margin: 80px auto 70px; } }
    @container (max-width: 667px) { .seat { transform: translate(-50%, -50%) scale(calc(0.44 * var(--crowd, 1))); } .centre { width: 32%; } }
    /* More than six seats crowd the rim: shrink every tile further. The factor
       multiplies into each step's own scale, after the centring translate, so
       tiles stay centred on their rim points. */
    .table.crowded { --crowd: 0.75; }
    @container (max-width: 568px) {
      /* Narrower than its container so rim seats (at 8% / 92%) stay on screen. */
      .table { aspect-ratio: 1; width: 80%; margin: 64px auto 56px; }
      .felt { inset: 12% 8%; border-radius: 24px; }
      .centre { width: 34%; font-size: 0.62em; }
      .seat { transform: translate(-50%, -50%) scale(calc(0.4 * var(--crowd, 1))); }
      .table.crowded { --crowd: 0.7; }
    }
  `,
})
export class RoundTable {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input.required<string>();
  readonly thinkingSeatId = input<string | null>(null);
  readonly botSeatIds = input<string[]>([]);

  protected readonly waiting = computed(() => waitingLine(this.state()));
  protected readonly turnedUp = computed(() => this.state().zones.find((z) => z.kind === 'processing')?.cards ?? []);
  protected readonly placements = computed(() => seatPlacements(this.state().seats, this.viewerSeatId()));

  // The latest few actions, oldest first, in the action history's wording.
  protected readonly recentLog = computed(() =>
    actionHistory(this.state().log, this.state().zones, this.state().players, this.state().seats)
      .flatMap((e) => (e.kind === 'action' ? [e] : []))
      .slice(0, RECENT_LOG_LINES)
      .reverse()
  );

  protected name(seatId: string): string {
    return seatName(this.state().players, seatId);
  }

  protected equipmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  protected judgmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  protected handCount(zoneId: string): number {
    return this.state().zones.find((z) => z.id === zoneId)?.cards.length ?? 0;
  }

  protected drawPileCount(): number {
    return this.state().zones.find((z) => z.kind === 'drawPile')?.cards.length ?? 0;
  }
}
