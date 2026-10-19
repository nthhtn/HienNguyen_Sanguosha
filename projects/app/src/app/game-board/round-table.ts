import { Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CardInstance, GameState, Seat, isSeatDying } from 'engine';
import { actionHistory, latestSequence } from './action-history';
import { waitingLine } from './response-description';
import { seatName } from '../labels';
import { SeatTile } from './seat-tile';
import { PlayingCard } from './playing-card';
import { CardArt } from './card-art';
import { CardInfoDialog, CardInfoDialogData } from './card-info-dialog';
import { BattlefieldBackgrounds, battlefieldBackgroundCss } from '../battlefield-background.service';
import { fitTable, seatPlacements } from './table-layout';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

// The table's size before it is first measured (and in tests).
const DEFAULT_SIZE = { width: 1280, height: 640 };

// The step ribbon in the centre (see steps): the narrowest and the tallest a step
// is planned at, the gap between steps, and what a turned-up row and a status line take, in px.
const STEP_MIN_WIDTH = 200;
const STEP_HEIGHT = 46;
const STEP_GAP = 5;
const TURNED_UP_HEIGHT = 66;
const STATUS_HEIGHT = 24;

// The battlefield: the other seats around its rim, seen from the viewer's chair
// (the viewer's own seat is in the board's bottom-left corner), and the latest
// action sequence in its centre.
// Presentational: everything shown is read straight off the (redacted) state.
@Component({
  selector: 'app-round-table',
  imports: [SeatTile, PlayingCard, CardArt, MatProgressSpinnerModule, TPipe],
  template: `
    <div class="table" [class.crowded]="state().seats.length > 6" [style.background]="background()">
      <!-- Only the latest action sequence, one step per line, each with its card. -->
      <div class="centre" [style.width.px]="fit().centreWidth" [style.top.px]="fit().centreY" [style.max-height.px]="fit().centreHeight">
        @if (turnedUp().length > 0) {
          <div class="turned-up" [attr.aria-label]="'table.turnedUp' | t">
            @for (card of turnedUp(); track card.instanceId) {
              <app-playing-card [card]="card" size="small" />
            }
          </div>
        }
        <ul class="sequence" [attr.aria-label]="'table.sequence' | t">
          @if (shown().earlier > 0) {
            <li class="step earlier">{{ 'table.earlier' | t: { n: shown().earlier } }}</li>
          }
          @for (line of shown().steps; track $index) {
            <li class="step">
              @if (line.card; as card) {
                <button type="button" class="thumb" [attr.aria-label]="'ui.info' | t: { name: cardName(card) }" (click)="openCard(card)">
                  <app-card-art size="tiny" [cropped]="true" [id]="card.definitionId" [label]="cardName(card)" />
                </button>
              } @else {
                <span class="no-card" aria-hidden="true"></span>
              }
              <span class="text" [class.force-status]="!!line.force" [attr.data-force]="line.force ?? null">{{ line.text }}</span>
            </li>
          }
        </ul>
        @if (waiting(); as line) {
          <div class="waiting">{{ line }}</div>
        }
        @if (thinkingSeatId(); as thinking) {
          <div class="thinking"><mat-progress-spinner mode="indeterminate" diameter="14" /> {{ 'table.thinking' | t: { seat: name(thinking) } }}</div>
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
            [pile]="judgmentOf(p.seat.pile?.zoneId ?? '')"
            [stash]="judgmentOf(p.seat.stash?.zoneId ?? '')"
            [dying]="dyingOf(p.seat)"
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
      /* The default look; a picture from the Battlefield menu replaces it (see background). */
      background: radial-gradient(ellipse at center, #8b7559 0%, #6d5a43 55%, #4b3e2f 100%);
      box-shadow: inset 0 0 40px rgb(0 0 0 / 45%);
    }
    .centre {
      position: absolute;
      left: 50%;
      /* top: the middle of the centre's room, from the layout (fitTable). */
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
    .turned-up { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
    .waiting { color: #ffcc80; font-weight: bold; }
    .thinking { display: flex; align-items: center; justify-content: center; gap: 6px; font-style: italic; color: #e8dcc6; --mdc-circular-progress-active-indicator-color: #e8dcc6; --mat-progress-spinner-active-indicator-color: #e8dcc6; }
    /* The steps flow in as many columns as fit, oldest first, so a long sequence reads
       left to right, top to bottom, instead of scrolling. */
    .sequence {
      list-style: none; padding: 0; margin: 0; width: 100%; font-size: 0.85em;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 5px; text-align: left;
    }
    .step { display: flex; align-items: center; gap: 7px; min-height: 46px; padding: 3px 8px 3px 3px; border-radius: 8px; background: rgb(0 0 0 / 34%); line-height: 1.2; }
    .step .text { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .step.earlier { justify-content: center; padding-inline: 8px; color: #e8dcc6; font-style: italic; background: none; border: 1px dashed rgb(255 255 255 / 45%); }
    .thumb { flex: none; padding: 0; border: none; background: none; cursor: pointer; display: block; line-height: 0; }
    .thumb:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .no-card { flex: none; width: 26px; }
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

  private readonly i18n = inject(I18n);
  private readonly backgrounds = inject(BattlefieldBackgrounds);

  protected readonly background = computed(() => battlefieldBackgroundCss(this.backgrounds.choice()));
  protected readonly waiting = computed(() => waitingLine(this.state(), this.i18n.translator));
  protected readonly turnedUp = computed(() => this.state().zones.find((z) => z.kind === 'processing')?.cards ?? []);

  // The battlefield's measured size, in px.
  private readonly size = signal(DEFAULT_SIZE);
  protected readonly fit = computed(() => fitTable(this.size().width, this.size().height, this.state().seats.length));
  protected readonly placements = computed(() => seatPlacements(this.state().seats, this.viewerSeatId(), this.fit()).filter((p) => !p.isViewer));

  // The latest action sequence, oldest first, in the action history's wording.
  protected readonly sequence = computed(() =>
    latestSequence(actionHistory(this.state().log, this.state().zones, this.state().players, this.state().seats, this.i18n.translator))
  );
  // How many steps the centre has room for: the columns that fit across, times the rows that fit
  // down, after the turned-up row and the status lines.
  private readonly capacity = computed(() => {
    const { centreWidth, centreHeight } = this.fit();
    const columns = Math.max(1, Math.floor((centreWidth + STEP_GAP) / (STEP_MIN_WIDTH + STEP_GAP)));
    const spent = (this.turnedUp().length > 0 ? TURNED_UP_HEIGHT : 0) + STATUS_HEIGHT * (Number(!!this.waiting()) + Number(!!this.thinkingSeatId()));
    const rows = Math.max(1, Math.floor((centreHeight - spent + STEP_GAP) / (STEP_HEIGHT + STEP_GAP)));
    return columns * rows;
  });
  // The steps that are shown: all of them, or the newest ones when there are more than fit, with the
  // oldest folded into one "N earlier steps" chip that takes a slot itself.
  protected readonly shown = computed(() => {
    const lines = this.sequence();
    const room = Math.max(2, this.capacity());
    if (lines.length <= room) return { earlier: 0, steps: lines };
    return { earlier: lines.length - (room - 1), steps: lines.slice(lines.length - (room - 1)) };
  });

  private readonly dialog = inject(MatDialog);

  protected cardName(card: CardInstance): string {
    return CardInfoDialog.nameFor(card.definitionId, undefined, this.i18n.translator);
  }

  protected openCard(card: CardInstance): void {
    this.dialog.open<CardInfoDialog, CardInfoDialogData>(CardInfoDialog, { data: { card, name: this.cardName(card) }, width: 'min(92vw, 480px)' });
  }

  constructor() {
    // The Battlefield menu in the toolbar is offered while a battlefield is on screen.
    this.backgrounds.available.set(true);
    inject(DestroyRef).onDestroy(() => this.backgrounds.available.set(false));
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
    return seatName(this.state().players, seatId, this.i18n.translator);
  }

  protected equipmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  protected dyingOf(seat: Seat): boolean {
    return isSeatDying(this.state(), seat.id);
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
