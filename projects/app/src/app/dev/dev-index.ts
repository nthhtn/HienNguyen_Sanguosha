import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TPipe } from '../i18n/t.pipe';
import { GROUP_TITLES, ScenarioGroup } from './scenario';
import { SCENARIOS } from './scenarios';

const GROUPS: ScenarioGroup[] = ['Play Board', 'Response Windows', 'Choice Prompts', 'Other Screens'];
const GROUP_ICONS: Record<ScenarioGroup, string> = {
  'Play Board': 'grid_view',
  'Response Windows': 'reply',
  'Choice Prompts': 'rule',
  'Other Screens': 'web',
};

// The /preview index: every scenario, by group. Dev only.
@Component({
  selector: 'app-dev-index',
  imports: [MatIconModule, RouterLink, TPipe],
  template: `
    <main class="preview">
      <header class="intro">
        <mat-icon class="mark" aria-hidden="true">science</mat-icon>
        <div>
          <h1>{{ 'preview.index.title' | t }}</h1>
          <p>{{ 'preview.index.intro' | t }}</p>
        </div>
      </header>

      <a class="tile lab" routerLink="/preview/animations">
        <mat-icon aria-hidden="true">movie_filter</mat-icon>
        <span class="text">
          <span class="title">{{ 'preview.lab.title' | t }}</span>
          <span class="what">{{ 'preview.index.labText' | t }}</span>
        </span>
        <mat-icon class="go" aria-hidden="true">chevron_right</mat-icon>
      </a>

      @for (group of groups; track group.name) {
        <section class="group">
          <h2>
            <mat-icon aria-hidden="true">{{ group.icon }}</mat-icon>
            <span>{{ group.title | t }}</span>
            <span class="count">{{ group.scenarios.length }}</span>
          </h2>
          <div class="grid">
            @for (s of group.scenarios; track s.id) {
              <a class="tile" [routerLink]="['/preview', s.id]">
                <span class="text">
                  <span class="title">{{ s.title | t }}</span>
                  <span class="what">{{ s.description | t }}</span>
                </span>
                <mat-icon class="go" aria-hidden="true">chevron_right</mat-icon>
              </a>
            }
          </div>
        </section>
      }
    </main>
  `,
  styles: `
    :host { display: block; }
    .preview { max-width: 1040px; margin: 0 auto; padding: 24px 0 40px; display: grid; gap: 24px; }
    .intro { display: flex; align-items: center; gap: 16px; }
    .intro h1 { margin: 0; font: var(--mat-sys-headline-medium); }
    .intro p { margin: 4px 0 0; color: var(--mat-sys-on-surface-variant); }
    .mark { flex: none; width: 48px; height: 48px; font-size: 28px; display: grid; place-items: center; border-radius: 14px; background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }

    .group { display: grid; gap: 12px; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; font: var(--mat-sys-title-large); }
    h2 mat-icon { color: var(--mat-sys-primary); }
    .count { margin-left: 4px; padding: 0 10px; border-radius: 999px; background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-large); }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .tile {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
      text-decoration: none;
      transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
    }
    .tile:hover { background: var(--mat-sys-surface-container-high); border-color: var(--mat-sys-primary); box-shadow: var(--mat-sys-level1); }
    .tile:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: 2px; }
    .text { flex: 1; min-width: 0; display: grid; gap: 4px; }
    .title { font: var(--mat-sys-title-medium); }
    .what { font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .go { flex: none; color: var(--mat-sys-on-surface-variant); }
    .tile:hover .go { color: var(--mat-sys-primary); }
    .lab { padding: 18px 20px; background: var(--mat-sys-primary-container); border-color: transparent; color: var(--mat-sys-on-primary-container); }
    .lab:hover { background: var(--mat-sys-primary-container); filter: brightness(0.97); }
    .lab .what, .lab .go { color: inherit; opacity: 0.8; }
    .lab > mat-icon:first-child { flex: none; width: 36px; height: 36px; font-size: 32px; }
  `,
})
export class DevIndex {
  protected readonly groups = GROUPS.map((name) => ({
    name,
    title: GROUP_TITLES[name],
    icon: GROUP_ICONS[name],
    scenarios: SCENARIOS.filter((s) => s.group === name),
  }));
}
