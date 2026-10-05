import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DecisionTimer } from '../decision-timer.service';

// The time left on the current decision: seconds and a draining bar, red for
// the last 10 seconds. Shows nothing when no decision is timed.
@Component({
  selector: 'app-decision-countdown',
  imports: [MatIconModule],
  template: `
    @if (seconds() !== null) {
      <div class="countdown" [class.urgent]="urgent()" role="timer" [attr.aria-label]="seconds() + ' seconds left'">
        <mat-icon>timer</mat-icon>
        <span class="seconds">{{ seconds() }}s</span>
        <span class="bar"><span class="fill" [style.width.%]="percent()"></span></span>
      </div>
    }
  `,
  styles: `
    .countdown { display: flex; align-items: center; gap: 6px; font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
    .countdown mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .seconds { min-width: 3ch; font-variant-numeric: tabular-nums; }
    .bar { flex: 1; min-width: 60px; height: 6px; border-radius: 3px; background: var(--mat-sys-surface-container-highest); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--mat-sys-primary); transition: width 250ms linear; }
    .urgent { color: var(--mat-sys-error); }
    .urgent .fill { background: var(--mat-sys-error); }
  `,
})
export class DecisionCountdown {
  private readonly timer = inject(DecisionTimer);
  protected readonly seconds = this.timer.secondsLeft;
  protected readonly urgent = computed(() => (this.seconds() ?? Infinity) <= 10);
  protected readonly percent = computed(() => ((this.seconds() ?? 0) / (this.timer.totalSeconds() ?? 1)) * 100);
}
