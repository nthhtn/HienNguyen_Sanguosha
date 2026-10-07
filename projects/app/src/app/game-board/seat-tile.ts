import { Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance, EQUIP_SLOTS, EquipSlot, Seat } from 'engine';
import { equipSlotOf, hpIconUrls } from 'content';
import { cardIdDisplayName, forceOf, kingdomDisplayName } from '../labels';
import { SeatAvatar } from './seat-avatar';
import { PlayingCard } from './playing-card';
import { CardInfoDialog, CardInfoDialogData } from './card-info-dialog';

const SLOT_LABELS: Record<EquipSlot, { label: string; icon: string }> = {
  weapon: { label: 'Weapon', icon: 'gavel' },
  armor: { label: 'Armor', icon: 'shield' },
  defensiveMount: { label: 'Defensive Mount', icon: 'add' },
  offensiveMount: { label: 'Offensive Mount', icon: 'remove' },
};

// One seat at the round table, compact enough to sit on the table's rim.
@Component({
  selector: 'app-seat-tile',
  imports: [SeatAvatar, PlayingCard, MatIconModule],
  template: `
    <div
      class="tile"
      [class.turn-owner]="isTurnOwner()"
      [class.responding]="isResponding()"
      [class.eliminated]="seat().eliminated"
      [class.viewer]="isViewer()"
      [attr.data-force]="force()"
    >
      <div class="header">
        <strong>{{ name() }}</strong>
        @if (isBot()) {
          <mat-icon class="bot-icon" aria-label="Computer player">smart_toy</mat-icon>
        }
        @if (isViewer()) {
          <span class="you">(you)</span>
        }
      </div>
      <div class="generals">
        @if (seat().generals; as generals) {
          <app-seat-avatar [generals]="generals" />
        } @else {
          <span class="choosing">Choosing Generals…</span>
        }
      </div>
      <div class="stats">
        <span class="kingdom kingdom-{{ seat().kingdom }}">{{ kingdomDisplayName(seat().kingdom) }}</span>
        @if (hpIcons().length) {
          <span class="hp-icons">
            @for (src of hpIcons(); track src) {
              <img class="hp-icon" [src]="src" alt="" />
            }
          </span>
        }
        <span>HP {{ seat().combinedHp }}/{{ seat().maxCombinedHp }}</span>
        <span class="hand-count" title="Cards in Hand">🂠 {{ handCount() }}</span>
      </div>
      <div class="equip">
        @for (s of slots(); track s.slot) {
          <div
            class="slot"
            [class.empty]="!s.card"
            [attr.data-slot]="s.slot"
            [attr.title]="s.card ? s.label + ': ' + cardIdDisplayName(s.card.definitionId) : s.label + ' (empty)'"
          >
            @if (s.card; as card) {
              <!-- Its rules text is in the Info popup. -->
              <button type="button" class="slot-card" [attr.aria-label]="'Info: ' + cardIdDisplayName(card.definitionId)" (click)="openInfo(card)">
                <app-playing-card size="small" [card]="card" />
              </button>
            } @else {
              <mat-icon>{{ s.icon }}</mat-icon>
            }
          </div>
        }
      </div>
      <div class="judgment" aria-label="Judgment Area">
        @for (card of judgment(); track card.instanceId) {
          <div class="slot" [attr.title]="'Judgment Area: ' + cardIdDisplayName(card.definitionId)">
            <button type="button" class="slot-card" [attr.aria-label]="'Info: ' + cardIdDisplayName(card.definitionId)" (click)="openInfo(card)">
              <app-playing-card size="small" [card]="card" />
            </button>
          </div>
        } @empty {
          <div class="slot empty" title="Judgment Area (empty)"><mat-icon>balance</mat-icon></div>
        }
      </div>
      <!-- Status lines in the seat's force colour. -->
      @if (seat().eliminated) {
        <div class="status force-status" [attr.data-force]="force()">Eliminated</div>
      } @else if (seat().combinedHp <= 0) {
        <div class="status force-status dying" [attr.data-force]="force()">Dying…</div>
      } @else if (isResponding()) {
        <div class="status force-status" [attr.data-force]="force()">Responding…</div>
      }
    </div>
  `,
  styles: `
    .tile {
      background: #fffdf7;
      border: 2px solid var(--force);
      border-radius: 14px;
      padding: 8px 10px;
      box-shadow: 0 2px 6px rgb(0 0 0 / 25%);
      font-size: 1.1em;
      min-width: 200px;
      text-align: center;
    }
    /* The border and name are the seat's force colour (data-force, styles.scss);
       a hidden or force-less seat is yellow. */
    .header strong { color: var(--force-text); }
    /* Highlights add to the force colour rather than replacing it. */
    .tile.turn-owner { border-width: 4px; padding: 6px 8px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--force) 40%, transparent), 0 2px 6px rgb(0 0 0 / 25%); }
    .tile.responding { box-shadow: 0 0 0 3px #fff, 0 0 0 6px rgb(230 81 0 / 70%); }
    /* Faded, but the status line keeps its force colour. */
    .tile.eliminated > :not(.status) { opacity: 0.45; filter: grayscale(1); }
    .bot-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; margin-left: 3px; color: #666; }
    .you { margin-left: 4px; color: var(--mat-sys-primary); }
    .generals { display: flex; gap: 6px; justify-content: center; margin: 4px 0; min-height: 96px; align-items: center; }
    .choosing { font-style: italic; color: #666; }
    .stats { display: flex; gap: 6px; justify-content: center; align-items: center; white-space: nowrap; }
    .hp-icons { display: inline-flex; gap: 1px; vertical-align: middle; }
    .hp-icon { height: 20px; width: auto; }
    .kingdom { padding: 0 5px; border-radius: 6px; background: #e6e1e5; }
    .kingdom-Wei { background: #d6e4ff; }
    .kingdom-Shu { background: #ffd9d6; }
    .kingdom-Wu { background: #d6f5dc; }
    .status { font-weight: bold; margin-top: 2px; }
    .equip { display: grid; grid-template-columns: repeat(4, 44px); gap: 5px; justify-content: center; margin-top: 4px; }
    .slot { width: 44px; height: 60px; border-radius: 3px; overflow: hidden; display: grid; place-items: center; background: #f1ece2; border: 1px solid #d5c8ad; }
    .slot-card { padding: 0; border: none; background: none; cursor: pointer; display: block; }
    .slot-card:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: -2px; }
    .judgment { display: flex; gap: 5px; justify-content: center; margin-top: 4px; }
    .slot.empty mat-icon { font-size: 22px; width: 22px; height: 22px; color: #b9a37a; }
  `,
})
export class SeatTile {
  readonly seat = input.required<Seat>();
  readonly name = input.required<string>();
  readonly handCount = input.required<number>();
  readonly isTurnOwner = input(false);
  readonly isResponding = input(false);
  readonly isViewer = input(false);
  readonly isBot = input(false);
  readonly equipment = input<CardInstance[]>([]);
  readonly judgment = input<CardInstance[]>([]);

  // Wei, Shu, Wu or Qun once known to the viewer; 'none' while hidden (or for a
  // seat that belongs to no force).
  protected readonly force = computed(() => forceOf(this.seat().kingdom));
  protected readonly hpIcons = computed(() => hpIconUrls(this.seat().combinedHp));


  private readonly dialog = inject(MatDialog);

  protected openInfo(card: CardInstance): void {
    this.dialog.open<CardInfoDialog, CardInfoDialogData>(CardInfoDialog, {
      data: { card, name: CardInfoDialog.nameFor(card.definitionId, undefined) },
      width: 'min(92vw, 480px)',
    });
  }


  protected readonly slots = computed(() =>
    EQUIP_SLOTS.map((slot) => ({
      slot,
      ...SLOT_LABELS[slot],
      card: this.equipment().find((c) => equipSlotOf(c.definitionId) === slot) ?? null,
    }))
  );
  protected readonly cardIdDisplayName = cardIdDisplayName;

  protected readonly kingdomDisplayName = kingdomDisplayName;
}
