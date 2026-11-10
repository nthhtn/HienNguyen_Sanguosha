import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TPipe } from '../../i18n/t.pipe';
import { RULES_PAGES } from './rules-pages';

// The frame around every Rules page: an index of the topics on the left, the page beside it.
@Component({
  selector: 'app-rules-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TPipe],
  template: `
    <div class="rules-layout">
      <nav class="rules-index" [attr.aria-label]="'nav.rules' | t">
        @for (page of pages; track page.path) {
          <a [routerLink]="page.path" routerLinkActive="active" ariaCurrentWhenActive="page">{{ page.label | t }}</a>
        }
      </nav>
      <div class="rules-page"><router-outlet /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .rules-layout { display: flex; align-items: flex-start; gap: 24px; max-width: 1040px; margin: 0 auto; }
    .rules-index { position: sticky; top: 8px; flex: 0 0 200px; display: flex; flex-direction: column; padding: 4px 0; border-right: 1px solid var(--mat-sys-outline-variant); }
    .rules-index a { padding: 8px 16px; color: var(--mat-sys-on-surface); text-decoration: none; border-left: 3px solid transparent; font: var(--mat-sys-body-medium); }
    .rules-index a:hover { background: var(--mat-sys-surface-container); }
    .rules-index a.active { border-left-color: var(--mat-sys-primary); color: var(--mat-sys-primary); background: var(--mat-sys-secondary-container); font-weight: 500; }
    .rules-page { flex: 1 1 0; min-width: 0; }
    @media (max-width: 720px) {
      .rules-layout { flex-direction: column; gap: 8px; }
      .rules-index { position: static; flex-direction: row; flex-wrap: wrap; gap: 4px; width: 100%; border-right: 0; border-bottom: 1px solid var(--mat-sys-outline-variant); padding-bottom: 8px; }
      .rules-index a { border-left: 0; border-radius: 16px; padding: 4px 12px; }
    }
  `,
})
export class RulesShell {
  protected readonly pages = RULES_PAGES;
}
