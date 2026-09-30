import { Component, input } from '@angular/core';
import { Seat } from 'engine';
import { generalDisplayName, kingdomDisplayName } from '../labels';
import { CardArt } from './card-art';

// One seat at the round table, compact enough to sit on the table's rim.
@Component({
  selector: 'app-seat-tile',
  imports: [CardArt],
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
        @if (isViewer()) {
          <span class="you">(you)</span>
        }
      </div>
      <div class="generals">
        @if (seat().generals; as generals) {
          <app-card-art
            size="small"
            [id]="generals.main.generalDefinitionId"
            [label]="generalDisplayName(generals.main.generalDefinitionId)"
          />
          <app-card-art
            size="small"
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
      border-radius: 10px;
      padding: 4px 6px;
      box-shadow: 0 2px 6px rgb(0 0 0 / 25%);
      font-size: 0.8em;
      min-width: 108px;
      text-align: center;
    }
    .tile.turn-owner { border-color: #1565c0; box-shadow: 0 0 0 3px rgb(21 101 192 / 35%); }
    .tile.responding { border-color: #e65100; box-shadow: 0 0 0 3px rgb(230 81 0 / 35%); }
    .tile.eliminated { opacity: 0.45; filter: grayscale(1); }
    .you { margin-left: 4px; color: #1565c0; }
    .generals { display: flex; gap: 3px; justify-content: center; margin: 3px 0; min-height: 60px; align-items: center; }
    .choosing { font-style: italic; color: #666; }
    .stats { display: flex; gap: 6px; justify-content: center; white-space: nowrap; }
    .kingdom { padding: 0 5px; border-radius: 6px; background: #e6e1e5; }
    .kingdom-Wei { background: #d6e4ff; }
    .kingdom-Shu { background: #ffd9d6; }
    .kingdom-Wu { background: #d6f5dc; }
    .status { font-weight: bold; margin-top: 2px; }
  `,
})
export class SeatTile {
  readonly seat = input.required<Seat>();
  readonly handCount = input.required<number>();
  readonly isTurnOwner = input(false);
  readonly isResponding = input(false);
  readonly isViewer = input(false);

  protected readonly generalDisplayName = generalDisplayName;
  protected readonly kingdomDisplayName = kingdomDisplayName;
}
