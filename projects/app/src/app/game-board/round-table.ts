import { Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GameState } from 'engine';
import { actionHistory, latestSequence } from './action-history';
import { waitingLine } from './response-description';
import { seatName } from '../labels';
import { SeatTile } from './seat-tile';
import { PlayingCard } from './playing-card';
import { fitTable, seatPlacements } from './table-layout';

// The table's size before it is first measured (and in tests).
const DEFAULT_SIZE = { width: 1280, height: 640 };

// The battlefield: the other seats around its rim, seen from the viewer's chair
// (the viewer's own seat is in the board's bottom-left corner), and the latest
// action sequence in its centre.
// Presentational: everything shown is read straight off the (redacted) state.
@Component({
  selector: 'app-round-table',
  imports: [SeatTile, PlayingCard, MatProgressSpinnerModule],
  template: `
    <div class="table" [class.crowded]="state().seats.length > 6">
      <!-- Only the latest action sequence: its cards and its lines. -->
      <div class="centre" [style.width.px]="fit().centreWidth" [style.max-height.px]="fit().centreHeight">
        @if (sequenceCards().length > 0) {
          <div class="sequence-cards" aria-label="Cards in Play">
            @for (card of sequenceCards(); track card.instanceId) {
              <app-playing-card [card]="card" />
            }
          </div>
        }
        @if (turnedUp().length > 0) {
          <div class="turned-up" aria-label="Turned Up Cards">
            @for (card of turnedUp(); track card.instanceId) {
              <app-playing-card [card]="card" size="small" />
            }
          </div>
        }
        <ul class="sequence">
          @for (line of sequence(); track $index) {
            <li><span [class.force-status]="!!line.force" [attr.data-force]="line.force ?? null">{{ line.text }}</span></li>
          }
        </ul>
        @if (waiting(); as line) {
          <div class="waiting">{{ line }}</div>
        }
        @if (thinkingSeatId(); as thinking) {
          <div class="thinking"><mat-progress-spinner mode="indeterminate" diameter="14" /> {{ name(thinking) }} is thinking…</div>
        }
      </div>
      @for (p of placements(); track p.seat.id) {
        <div class="seat" [attr.data-seat-id]="p.seat.id" [style.left.%]="p.x" [style.top.%]="p.y" [style.--scale]="fit().scale">
          <app-seat-tile
            [seat]="p.seat"
            [name]="name(p.seat.id)"
            [handCount]="handCount(p.seat.hand.zoneId)"
            [isTurnOwner]="p.seat.id === state().turn.ownerSeatId"
            [isResponding]="p.seat.id === (state().pendingChoice?.seatId ?? state().pendingResponse?.respondingSeatId)"
            [isBot]="botSeatIds().includes(p.seat.id)"
            [equipment]="equipmentOf(p.seat.equipped.zoneId)"
            [judgment]="judgmentOf(p.seat.judgment.zoneId)"
            [judgmentCountsAs]="countsAsOf(p.seat.judgment.zoneId)"
          />
        </div>
      }
    </div>
  `,
  styles: `
    /* The battlefield fills the room the board gives it; tiles are scaled and
       placed to fit it (fitTable in table-layout.ts). */
    :host { display: block; height: 100%; min-height: 0; }
    .table {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 0;
      overflow: hidden;
      background: radial-gradient(ellipse at center, #8b7559 0%, #6d5a43 55%, #4b3e2f 100%);
      box-shadow: inset 0 0 40px rgb(0 0 0 / 45%);
    }
    .centre {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      overflow: auto;
      color: #f4ecdc;
      text-align: center;
      font-size: 1.05em;
      text-shadow: 0 1px 2px rgb(0 0 0 / 50%);
    }
    .sequence-cards, .turned-up { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
    .waiting { color: #ffcc80; font-weight: bold; }
    .thinking { display: flex; align-items: center; justify-content: center; gap: 6px; font-style: italic; color: #e8dcc6; --mdc-circular-progress-active-indicator-color: #e8dcc6; --mat-progress-spinner-active-indicator-color: #e8dcc6; }
    .sequence { list-style: none; padding: 0; margin: 0; font-size: 0.9em; }
    /* Status lines in the player's force colour, on a light chip to read on the battlefield. */
    .sequence .force-status { padding: 0 6px; border-radius: 6px; background: rgb(255 255 255 / 92%); text-shadow: none; }
    .seat { position: absolute; transform: translate(-50%, -50%) scale(var(--scale, 1)); }
  `,
})
export class RoundTable {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input.required<string>();
  readonly thinkingSeatId = input<string | null>(null);
  readonly botSeatIds = input<string[]>([]);

  protected readonly waiting = computed(() => waitingLine(this.state()));
  protected readonly turnedUp = computed(() => this.state().zones.find((z) => z.kind === 'processing')?.cards ?? []);

  // The battlefield's measured size, in px.
  private readonly size = signal(DEFAULT_SIZE);
  protected readonly fit = computed(() => fitTable(this.size().width, this.size().height, this.state().seats.length));
  protected readonly placements = computed(() => seatPlacements(this.state().seats, this.viewerSeatId(), this.fit()).filter((p) => !p.isViewer));

  // The latest action sequence, oldest first, in the action history's wording.
  protected readonly sequence = computed(() =>
    latestSequence(actionHistory(this.state().log, this.state().zones, this.state().players, this.state().seats))
  );
  // Its cards, each once; turned-up cards show in their own row.
  protected readonly sequenceCards = computed(() => {
    const shown = new Set(this.turnedUp().map((c) => c.instanceId));
    return this.sequence().flatMap((line) => {
      if (!line.card || shown.has(line.card.instanceId)) return [];
      shown.add(line.card.instanceId);
      return [line.card];
    });
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) this.size.set({ width, height });
    });
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected name(seatId: string): string {
    return seatName(this.state().players, seatId);
  }

  protected equipmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  protected judgmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  // What each card in a zone counts as, when placed as another card (Country Scene's Capture).
  protected countsAsOf(zoneId: string): Record<string, string> {
    return this.state().zones.find((z) => z.id === zoneId)?.countsAs ?? {};
  }

  protected handCount(zoneId: string): number {
    return this.state().zones.find((z) => z.id === zoneId)?.cards.length ?? 0;
  }
}
