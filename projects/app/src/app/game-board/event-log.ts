import { Component, computed, input } from '@angular/core';
import { EngineEvent } from 'engine';
import { eventLabel } from '../labels';

@Component({
  selector: 'app-event-log',
  template: `
    <ul class="event-log">
      @for (line of lines(); track $index) {
        <li>{{ line }}</li>
      }
    </ul>
  `,
})
export class EventLog {
  readonly events = input.required<EngineEvent[]>();
  readonly lines = computed(() => this.events().map(eventLabel));
}
