import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance, EQUIP_SLOTS, EquipSlot, Seat } from 'engine';
import { equipSlotOf } from 'content';
import { cardIdDisplayName, generalDisplayName, kingdomDisplayName } from '../labels';
import { CardArt } from './card-art';

const SLOT_LABELS: Record<EquipSlot, { label: string; icon: string }> = {
  weapon: { label: 'Weapon', icon: 'gavel' },
  armor: { label: 'Armor', icon: 'shield' },
  plusMount: { label: '+1 Horse', icon: 'add' },
  minusMount: { label: '−1 Horse', icon: 'remove' },
};

// One seat at the round table, compact enough to sit on the table's rim.
@Component({
  selector: 'app-seat-tile',
  imports: [CardArt, MatIconModule],
  template: `
    <div
      class="tile"
      [class.turn-owner]="isTurnOwner()"
      [class.responding]="isResponding()"
      [class.eliminated]="seat().eliminated"
      [class.viewer]="isViewer()"
    >
      <div class="header">
        <strong>{{ seat().id }}</strong>
        @if (isBot()) {
          <mat-icon class="bot-icon" aria-label="Computer player">smart_toy</mat-icon>
        }
        @if (isViewer()) {
          <span class="you">(you)</span>
        }
      </div>
      <div class="generals">
        @if (seat().generals; as generals) {
          <app-card-art
            [id]="generals.main.generalDefinitionId"
            [label]="generalDisplayName(generals.main.generalDefinitionId)"
          />
          <app-card-art
            [id]="generals.deputy.generalDefinitionId"
            [label]="generalDisplayName(generals.deputy.generalDefinitionId)"
          />
        } @else {
          <span class="choosing">Choosing generals…</span>
        }
      </div>
      <div class="stats">
        <span class="kingdom kingdom-{{ seat().kingdom }}">{{ kingdomDisplayName(seat().kingdom) }}</span>
        <span>HP {{ seat().combinedHp }}/{{ seat().maxCombinedHp }}</span>
        <span class="hand-count" title="Cards in hand">🂠 {{ handCount() }}</span>
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
              <app-card-art size="small" [id]="card.definitionId" [label]="cardIdDisplayName(card.definitionId)" />
            } @else {
              <mat-icon>{{ s.icon }}</mat-icon>
            }
          </div>
        }
      </div>
      @if (seat().eliminated) {
        <div class="status">Eliminated</div>
      } @else if (isResponding()) {
        <div class="status">Responding…</div>
      }
    </div>
  `,
  styles: `
    .tile {
      background: #fffdf7;
      border: 2px solid #b9a37a;
      border-radius: 14px;
      padding: 8px 10px;
      box-shadow: 0 2px 6px rgb(0 0 0 / 25%);
      font-size: 1.1em;
      min-width: 200px;
      text-align: center;
    }
    .tile.turn-owner { border-color: #1565c0; box-shadow: 0 0 0 3px rgb(21 101 192 / 35%); }
    .tile.responding { border-color: #e65100; box-shadow: 0 0 0 3px rgb(230 81 0 / 35%); }
    .tile.eliminated { opacity: 0.45; filter: grayscale(1); }
    .bot-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; margin-left: 3px; color: #666; }
    .you { margin-left: 4px; color: #1565c0; }
    .generals { display: flex; gap: 6px; justify-content: center; margin: 4px 0; min-height: 96px; align-items: center; }
    .choosing { font-style: italic; color: #666; }
    .stats { display: flex; gap: 6px; justify-content: center; white-space: nowrap; }
    .kingdom { padding: 0 5px; border-radius: 6px; background: #e6e1e5; }
    .kingdom-Wei { background: #d6e4ff; }
    .kingdom-Shu { background: #ffd9d6; }
    .kingdom-Wu { background: #d6f5dc; }
    .status { font-weight: bold; margin-top: 2px; }
    .equip { display: grid; grid-template-columns: repeat(4, 44px); gap: 5px; justify-content: center; margin-top: 4px; }
    .slot { width: 44px; height: 60px; border-radius: 3px; overflow: hidden; display: grid; place-items: center; background: #f1ece2; border: 1px solid #d5c8ad; }
    .slot.empty mat-icon { font-size: 22px; width: 22px; height: 22px; color: #b9a37a; }
  `,
})
export class SeatTile {
  readonly seat = input.required<Seat>();
  readonly handCount = input.required<number>();
  readonly isTurnOwner = input(false);
  readonly isResponding = input(false);
  readonly isViewer = input(false);
  readonly isBot = input(false);
  readonly equipment = input<CardInstance[]>([]);

  protected readonly slots = computed(() =>
    EQUIP_SLOTS.map((slot) => ({
      slot,
      ...SLOT_LABELS[slot],
      card: this.equipment().find((c) => equipSlotOf(c.definitionId) === slot) ?? null,
    }))
  );
  protected readonly cardIdDisplayName = cardIdDisplayName;

  protected readonly generalDisplayName = generalDisplayName;
  protected readonly kingdomDisplayName = kingdomDisplayName;
}
