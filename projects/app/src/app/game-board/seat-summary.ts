import { Component, input } from '@angular/core';
import { CardInstance, Seat } from 'engine';
import { cardIdDisplayName, generalDisplayName, kingdomDisplayName } from '../labels';
import { CardArt } from './card-art';

@Component({
  selector: 'app-seat-summary',
  imports: [CardArt],
  template: `
    <div class="seat-summary">
      <strong>{{ seat().id }}</strong>
      @if (seat().eliminated) {
        <span> (eliminated)</span>
      }
      <div>Kingdom: {{ kingdomDisplayName(seat().kingdom) }}</div>
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
          <span>Choosing generals…</span>
        }
      </div>
      <div>HP: {{ seat().combinedHp }}/{{ seat().maxCombinedHp }}</div>
      <div class="hand">
        @for (card of hand(); track card.instanceId) {
          <app-card-art [id]="card.definitionId" [label]="cardIdDisplayName(card.definitionId)" />
        }
      </div>
    </div>
  `,
  styles: `
    .generals,
    .hand {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin: 4px 0;
    }
  `,
})
export class SeatSummary {
  readonly seat = input.required<Seat>();
  readonly hand = input.required<CardInstance[]>();

  protected readonly generalDisplayName = generalDisplayName;
  protected readonly kingdomDisplayName = kingdomDisplayName;
  protected readonly cardIdDisplayName = cardIdDisplayName;
}
