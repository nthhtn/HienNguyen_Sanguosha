import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScenarioGroup } from './scenario';
import { SCENARIOS } from './scenarios';

const GROUPS: ScenarioGroup[] = ['Play Board', 'Response Windows', 'Choice Prompts', 'Other Screens'];

// The /preview index: every scenario, by group. Dev only.
@Component({
  selector: 'app-dev-index',
  imports: [RouterLink],
  template: `
    <main class="dev">
      <h1>Dev Scenarios</h1>
      <p>Each scenario opens the real board or screen in a prepared situation.</p>
      @for (group of groups; track group.name) {
        <h2>{{ group.name }}</h2>
        <ul>
          @for (s of group.scenarios; track s.id) {
            <li>
              <a [routerLink]="['/preview', s.id]">{{ s.title }}</a>
              <span class="what">{{ s.description }}</span>
            </li>
          }
        </ul>
      }
    </main>
  `,
  styles: `
    .dev { max-width: 760px; margin: 0 auto; padding: 16px; }
    ul { list-style: none; padding: 0; display: grid; gap: 8px; }
    li { display: grid; gap: 2px; }
    .what { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class DevIndex {
  protected readonly groups = GROUPS.map((name) => ({ name, scenarios: SCENARIOS.filter((s) => s.group === name) }));
}
