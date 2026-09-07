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
      <div>Main general: {{ generalDisplayName(seat().generals.main.generalDefinitionId) }}</div>
      <div>Deputy general: {{ generalDisplayName(seat().generals.deputy.generalDefinitionId) }}</div>
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
