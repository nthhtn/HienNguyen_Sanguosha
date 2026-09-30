import { Component, input } from '@angular/core';
import { Seat } from 'engine';
import { generalDisplayName, kingdomDisplayName } from '../labels';

@Component({
  selector: 'app-seat-summary',
  template: `
    <div class="seat-summary">
      <strong>{{ seat().id }}</strong>
      @if (seat().eliminated) {
        <span> (eliminated)</span>
      }
      <div>Kingdom: {{ kingdomDisplayName(seat().kingdom) }}</div>
      @if (seat().generals; as generals) {
        <div>Main general: {{ generalDisplayName(generals.main.generalDefinitionId) }}</div>
        <div>Deputy general: {{ generalDisplayName(generals.deputy.generalDefinitionId) }}</div>
      } @else {
        <span>Choosing generals…</span>
      }
      <div>HP: {{ seat().combinedHp }}/{{ seat().maxCombinedHp }}</div>
      <div>Hand: {{ handCount() }} card(s)</div>
    </div>
  `,
})
export class SeatSummary {
  readonly seat = input.required<Seat>();
  readonly handCount = input.required<number>();

  protected readonly generalDisplayName = generalDisplayName;
  protected readonly kingdomDisplayName = kingdomDisplayName;
}
