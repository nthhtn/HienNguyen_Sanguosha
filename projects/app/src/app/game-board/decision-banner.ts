import { Component, inject } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';
import { DecisionCountdown } from './decision-countdown';
import { DecisionDock } from './decision-dock';

// Shown while a decision dialog is minimized (DecisionDock): says a decision is still
// waiting, runs the same countdown, and brings the dialog back when clicked. It offers no
// answer of its own; answering stays in the dialog.
@Component({
  selector: 'app-decision-banner',
  imports: [DecisionCountdown, TPipe],
  template: `
    @if (dock.minimized(); as decision) {
      <!-- data-force: the global rules give --force and --force-text, as for the dialog itself. -->
      <button type="button" class="banner" [attr.data-force]="decision.force" (click)="dock.restore()">
        <span class="dot" aria-hidden="true"></span>
        <span class="message">
          <strong>{{ decision.title }}</strong>
          @if (decision.context) {
            <span class="context">{{ decision.context }}</span>
          }
        </span>
        <app-decision-countdown class="timer" />
        <span class="open">{{ 'decision.open' | t }}</span>
      </button>
    }
  `,
  styles: `
    .banner {
      display: flex; align-items: center; gap: 12px; width: 100%; margin: 8px 0; padding: 8px 12px; border: 0; border-radius: 12px;
      background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-body-large); text-align: left; cursor: pointer;
    }
    .message strong { color: var(--force-text, var(--mat-sys-on-secondary-container)); }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--force, var(--mat-sys-primary)); flex: none; animation: banner-pulse 1.4s ease-in-out infinite; }
    .message { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .context { color: var(--mat-sys-on-surface-variant); }
    .timer { display: block; width: 160px; }
    .open { padding: 4px 12px; border-radius: 16px; background: var(--force-text, var(--mat-sys-primary)); color: var(--mat-sys-on-primary); font: var(--mat-sys-label-large); }
    @keyframes banner-pulse { 50% { opacity: 0.3; } }
    @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
  `,
})
export class DecisionBanner {
  protected readonly dock = inject(DecisionDock);
}
