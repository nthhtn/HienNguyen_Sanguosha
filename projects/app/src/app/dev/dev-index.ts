import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../i18n/t.pipe';
import { GROUP_TITLES, ScenarioGroup } from './scenario';
import { SCENARIOS } from './scenarios';

const GROUPS: ScenarioGroup[] = ['Play Board', 'Response Windows', 'Choice Prompts', 'Other Screens'];

// The /preview index: every scenario, by group. Dev only.
@Component({
  selector: 'app-dev-index',
  imports: [RouterLink, TPipe],
  template: `
    <main class="dev">
      <h1>{{ 'preview.index.title' | t }}</h1>
      <p>{{ 'preview.index.intro' | t }}</p>
      <p><a routerLink="/preview/animations">{{ 'preview.lab.title' | t }}</a> {{ 'preview.index.labText' | t }}</p>
      @for (group of groups; track group.name) {
        <h2>{{ group.title | t }}</h2>
        <ul>
          @for (s of group.scenarios; track s.id) {
            <li>
              <a [routerLink]="['/preview', s.id]">{{ s.title | t }}</a>
              <span class="what">{{ s.description | t }}</span>
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
  protected readonly groups = GROUPS.map((name) => ({ name, title: GROUP_TITLES[name], scenarios: SCENARIOS.filter((s) => s.group === name) }));
}
