import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DecisionTimer } from '../decision-timer.service';
import { TPipe } from '../i18n/t.pipe';

// The time left on the current decision: seconds and a draining bar, pulsing
// for the last 10 seconds (not red: that is Shu's colour, and a Shu player's
// timer is red already). Inside a data-force element it takes that player's force
// colour. Shows nothing when no decision is timed, or while the animation it follows is still playing.
@Component({
  selector: 'app-decision-countdown',
  imports: [MatIconModule, TPipe],
  template: `
    @if (seconds() !== null && startsIn() === 0) {
      <div class="countdown" [class.urgent]="urgent()" role="timer" [attr.aria-label]="'countdown.aria' | t: { n: seconds()! }">
        <mat-icon>timer</mat-icon>
        <span class="seconds">{{ seconds() }}s</span>
        <span class="bar"><span class="fill" [style.width.%]="percent()"></span></span>
      </div>
    }
  `,
  styles: `
    /* In a title row only on the phone board (or with the title-timer class). Other wide layouts keep the clock at the foot. */
    :host(.header-timer) { display: none; }
    :host-context([data-layout='compact']).header-timer { display: flex; flex: 1 1 auto; min-width: 0; align-items: center; padding: 0 8px; }
    :host-context([data-layout='compact']).header-timer .countdown { flex: 1 1 auto; min-width: 0; width: 100%; }
    /* title-timer: in the title row on every layout (the Judgment popup, whose body scrolls and whose clock must stay in view). */
    :host(.title-timer) { display: flex; flex: 1 1 auto; min-width: 0; align-items: center; padding: 0 8px; }
    :host(.title-timer) .countdown { flex: 1 1 auto; min-width: 0; width: 100%; }
    .countdown { display: flex; align-items: center; gap: 6px; font: var(--mat-sys-label-large); color: var(--force-text, var(--mat-sys-on-surface-variant)); }
    .countdown mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .seconds { min-width: 3ch; font-variant-numeric: tabular-nums; }
    .bar { flex: 1; min-width: 60px; height: 6px; border-radius: 3px; background: var(--mat-sys-surface-container-highest); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--force, var(--mat-sys-primary)); transition: width 250ms linear; }
    .urgent .seconds { font-weight: 800; }
    .urgent { animation: urgent-pulse 1s ease-in-out infinite; }
    @keyframes urgent-pulse { 50% { opacity: 0.45; } }
    @media (prefers-reduced-motion: reduce) { .urgent { animation: none; } }
  `,
})
export class DecisionCountdown {
  private readonly timer = inject(DecisionTimer);
  protected readonly seconds = this.timer.secondsLeft;
  // Nothing shows while the animation the decision follows is still playing.
  protected readonly startsIn = this.timer.startsInMs;
  protected readonly urgent = computed(() => (this.seconds() ?? Infinity) <= 10);
  protected readonly percent = computed(() => ((this.seconds() ?? 0) / (this.timer.totalSeconds() ?? 1)) * 100);
}
