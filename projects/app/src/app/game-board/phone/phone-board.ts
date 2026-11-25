import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Action, CardInstance, ContentRegistry, GameState, Seat, isSeatDying } from 'engine';
import { BattlefieldBackgrounds, battlefieldBackgroundCss } from '../../battlefield-background.service';
import { I18n } from '../../i18n/i18n.service';
import { Layout } from '../../layout.service';
import { seatName } from '../../labels';
import { ActionList } from '../action-list';
import type { AvatarSkill } from '../avatar-skills';
import type { ShownDamage } from '../damage-effects';
import { HandCardActions, handCardViewModels } from '../hand-card-actions';
import { HandView } from '../hand-view';
import { PlaybackLayer } from '../playback/playback-layer';
import type { SeatCue } from '../playback/seat-cues';
import { PhoneCentreBand } from './phone-centre-band';
import { phoneSeats, phoneSizes } from './phone-seat-layout';
import { PhoneSeatTile } from './phone-seat-tile';
import { SeatDetailsDialog, SeatDetailsData } from './seat-details-dialog';

// The board's padding (styles below), which phoneSizes counts in.
const BOARD_PADDING = 8;
const OWN_TILE_WIDTH = 150;

// The board on the phone layout (spec, "The phone board"): opponents along the top and down the sides, the centre band
// between them, and a bottom row with the viewer's seat, the hand and the action column. Drawn at real sizes; it reads
// the same state and legal actions as the web board and decides no rules.
@Component({
  selector: 'app-phone-board',
  imports: [NgTemplateOutlet, MatButtonModule, MatTooltipModule, ActionList, HandCardActions, HandView, PhoneCentreBand, PhoneSeatTile, PlaybackLayer],
  template: `
    <ng-template #tile let-seat let-slim="slim" let-tileWidth="tileWidth" let-tileHeight="tileHeight">
      <app-phone-seat-tile
        [seat]="seat"
        [name]="nameOf(seat.id)"
        [handCount]="handCount(seat)"
        [isViewer]="seat.id === viewerSeatId()"
        [isTurnOwner]="seat.id === state().turn.ownerSeatId"
        [isResponding]="seat.id === (state().pendingChoice?.seatId ?? state().pendingResponse?.respondingSeatId)"
        [isBot]="botSeatIds().includes(seat.id)"
        [equipment]="zoneCards(seat.equipped.zoneId)"
        [judgment]="zoneCards(seat.judgment.zoneId)"
        [dying]="dyingOf(seat)"
        [cue]="cues()[seat.id] ?? null"
        [damageEffect]="damageEffects()[seat.id] ?? null"
        [dimmed]="resolving() && !cues()[seat.id]?.involved"
        [slim]="slim"
        [tileWidth]="tileWidth"
        [tileHeight]="tileHeight"
        (opened)="openDetails(seat.id)"
      />
    </ng-template>
    <div
      #board
      class="phone-board"
      [class.sides]="hasSides()"
      [style.background]="background()"
      [style.--side-width.px]="sizes().sideWidth"
      [style.--tile-height.px]="sizes().tileHeight"
      [style.--top-width.px]="sizes().topTileWidth"
      [style.--bottom-height.px]="sizes().bottomHeight"
    >
      <div class="left">
        @for (seat of seats().left; track seat.id) {
          <div class="seat" [attr.data-seat-id]="seat.id"><ng-container *ngTemplateOutlet="tile; context: { $implicit: seat, slim: sizes().slim, tileWidth: sizes().sideWidth, tileHeight: sizes().tileHeight }" /></div>
        }
      </div>
      <div class="top">
        @for (seat of seats().top; track seat.id) {
          <div class="seat" [attr.data-seat-id]="seat.id"><ng-container *ngTemplateOutlet="tile; context: { $implicit: seat, slim: sizes().slim, tileWidth: sizes().topTileWidth, tileHeight: sizes().tileHeight }" /></div>
        }
      </div>
      <div class="right">
        @for (seat of seats().right; track seat.id) {
          <div class="seat" [attr.data-seat-id]="seat.id"><ng-container *ngTemplateOutlet="tile; context: { $implicit: seat, slim: sizes().slim, tileWidth: sizes().sideWidth, tileHeight: sizes().tileHeight }" /></div>
        }
      </div>
      <app-phone-centre-band class="centre" [state]="state()" [viewerSeatId]="viewerSeatId()" />
      <div class="bottom">
        <div class="own">
          @if (viewerSeat(); as seat) {
            <div class="seat" [attr.data-seat-id]="seat.id"><ng-container *ngTemplateOutlet="tile; context: { $implicit: seat, slim: false, tileWidth: ownTileWidth, tileHeight: sizes().bottomHeight }" /></div>
          }
        </div>
        <app-hand-view
          class="hand"
          fit="overlap"
          [cards]="hand()"
          [actions]="handActions()"
          [state]="state()"
          [registry]="registry()"
          [pickedId]="pickedCard()?.instanceId ?? null"
          (picked)="picked.set($event)"
          (played)="play($event)"
        />
        <div class="actions">
          <!-- The picked hand card's Play and Info, above everything else (spec 3c). -->
          @if (pickedCardVm(); as vm) {
            <app-hand-card-actions [vm]="vm" [state]="state()" (played)="play($event)" />
          }
          @for (skill of usableSkills(); track skill.skillId) {
            <button mat-stroked-button type="button" class="skill" [matTooltip]="skill.label" (click)="choose(skill.action!)">{{ skill.label }}</button>
          }
          <app-action-list [compact]="true" [actions]="boardActions()" [state]="state()" [registry]="registry()" (actionChosen)="choose($event)" />
        </div>
      </div>
      <app-playback-layer
        [state]="state()"
        [viewerSeatId]="viewerSeatId() ?? ''"
        [line]="null"
        [centreY]="centre().y"
        [centreHeight]="centre().height"
      />
    </div>
  `,
  styles: `
    .phone-board {
      position: fixed; z-index: 1;
      inset: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
      box-sizing: border-box; padding: 8px; display: grid; gap: 5px;
      grid-template-columns: 1fr;
      grid-template-rows: var(--tile-height) 1fr var(--bottom-height);
      grid-template-areas: 'top' 'centre' 'bottom';
      /* Default look: the same brown table as the web board (round-table.ts); a Battlefield menu picture replaces it. */
      background: radial-gradient(ellipse at center, #8b7559 0%, #6d5a43 55%, #4b3e2f 100%);
      box-shadow: inset 0 0 40px rgb(0 0 0 / 45%);
      font-size: 14px;
    }
    .phone-board.sides {
      grid-template-columns: var(--side-width) 1fr var(--side-width);
      grid-template-areas: 'left top right' 'left centre right' 'bottom bottom bottom';
    }
    .left, .right { display: none; }
    .sides .left, .sides .right { display: flex; flex-direction: column; gap: 5px; }
    .left { grid-area: left; }
    .right { grid-area: right; }
    .left .seat, .right .seat { height: var(--tile-height); }
    .top { grid-area: top; display: flex; justify-content: center; gap: 5px; min-width: 0; }
    .top .seat { width: var(--top-width); flex: none; }
    .centre { grid-area: centre; min-height: 0; }
    .bottom { grid-area: bottom; display: flex; gap: 5px; min-width: 0; min-height: 0; }
    .own { flex: none; width: 150px; }
    .own .seat { height: 100%; }
    .hand { flex: 1 1 auto; min-width: 0; align-self: end; }
    .actions {
      flex: none; width: 128px; display: flex; flex-direction: column; gap: 6px; overflow-y: auto;
      --mat-button-outlined-label-text-color: #fbf7ec; --mat-button-outlined-outline-color: rgb(251 247 236 / 0.5);
      --mat-button-outlined-disabled-label-text-color: rgb(251 247 236 / 0.45);
    }
    /* Slimmer buttons on one line (spec 3c, the developer's exception to the 44 px rule); a long label ends in "…" and
       shows in full on a long press. The picked card's Play and Info are full width at the top. */
    .actions ::ng-deep button {
      height: 36px; min-height: 36px; width: 100%; padding: 0 8px; font-size: 13px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      --mat-button-outlined-container-height: 36px; --mat-button-filled-container-height: 36px;
    }
    .actions ::ng-deep .mdc-button__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .actions app-action-list ::ng-deep .action-list { gap: 6px; margin: 0; }
  `,
})
export class PhoneBoard {
  protected readonly ownTileWidth = OWN_TILE_WIDTH;
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input<string | null>(null);
  readonly botSeatIds = input<string[]>([]);
  readonly cues = input<Partial<Record<string, SeatCue>>>({});
  readonly damageEffects = input<Partial<Record<string, ShownDamage>>>({});
  readonly resolving = input(false);
  readonly hand = input<CardInstance[]>([]);
  readonly handActions = input<Action[]>([]);
  readonly boardActions = input<Action[]>([]);
  readonly skills = input<AvatarSkill[]>([]);
  readonly registry = input.required<ContentRegistry>();
  readonly played = output<Action>();
  readonly actionChosen = output<Action>();

  private readonly layout = inject(Layout);
  private readonly i18n = inject(I18n);
  private readonly dialog = inject(MatDialog);
  private readonly battlefieldBackgrounds = inject(BattlefieldBackgrounds);

  protected readonly background = computed(() => battlefieldBackgroundCss(this.battlefieldBackgrounds.choice()));

  // The Seat Details window this board opened, closed with the board (turning the phone, the game ending).
  private details: MatDialogRef<SeatDetailsDialog> | null = null;

  protected openDetails(seatId: string): void {
    this.details = this.dialog.open<SeatDetailsDialog, SeatDetailsData>(SeatDetailsDialog, { data: { state: this.state, seatId }, width: 'min(92vw, 560px)' });
  }

  protected readonly seats = computed(() => phoneSeats(this.state().seats, this.viewerSeatId()));
  protected readonly hasSides = computed(() => this.seats().left.length > 0);
  // The board's own box (inside the safe areas), padding included; the window until it has been measured.
  private readonly measured = signal<{ width: number; height: number } | null>(null);
  private readonly room = computed(() => this.measured() ?? this.layout.size());
  protected readonly sizes = computed(() => phoneSizes(this.room().width, this.room().height, this.seats()));
  protected readonly viewerSeat = computed(() => this.state().seats.find((s) => s.id === this.viewerSeatId()) ?? null);
  // Only the skills the engine offers now; the others would be disabled buttons taking room.
  // The hand card picked with a tap; none once it has left the hand.
  protected readonly picked = signal<string | null>(null);
  protected readonly pickedCard = computed(() => this.hand().find((c) => c.instanceId === this.picked()) ?? null);
  protected readonly pickedCardVm = computed(() => {
    const card = this.pickedCard();
    return card ? handCardViewModels([card], this.handActions(), this.state(), this.registry(), this.i18n.translator)[0] : null;
  });

  protected play(action: Action): void {
    this.picked.set(null);
    this.played.emit(action);
  }

  protected choose(action: Action): void {
    this.picked.set(null);
    this.actionChosen.emit(action);
  }

  protected readonly usableSkills = computed(() => this.skills().filter((s) => s.action !== null));
  // The centre band's middle and height, from the board's top, for playback's caption and played cards.
  protected readonly centre = computed(() => {
    const { tileHeight, bottomHeight } = this.sizes();
    const top = 8 + tileHeight + 5;
    const height = Math.max(0, this.room().height - top - 5 - bottomHeight - 8);
    return { y: top + height / 2, height };
  });

  private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

  constructor() {
    this.layout.setBoardOpen(true);
    this.battlefieldBackgrounds.available.set(true);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.layout.setBoardOpen(false);
      this.battlefieldBackgrounds.available.set(false);
      this.details?.close();
    });
    // A camera cut-out or rounded corner (env(safe-area-inset-*)) leaves the board less room than the window.
    if (typeof ResizeObserver !== 'function') return;
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) =>
        this.measured.set({ width: entry.contentRect.width + BOARD_PADDING * 2, height: entry.contentRect.height + BOARD_PADDING * 2 })
      );
      observer.observe(this.board().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected nameOf(seatId: string): string {
    return seatName(this.state().players, seatId, this.i18n.translator);
  }

  protected zoneCards(zoneId: string): CardInstance[] {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  protected handCount(seat: Seat): number {
    return this.zoneCards(seat.hand.zoneId).length;
  }

  protected dyingOf(seat: Seat): boolean {
    return isSeatDying(this.state(), seat.id);
  }
}
