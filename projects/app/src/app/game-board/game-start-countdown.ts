import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';

// "Game starts in 3" over the board, in the 3 seconds after the last seat has chosen its Generals. The server
// holds every clock and move for that long; this only shows it. Renders nothing once the time is up.
@Component({
  selector: 'app-game-start-countdown',
  imports: [TPipe],
  template: `
    @if (secondsLeft() > 0) {
      <div class="scrim" role="status" aria-live="polite">
        <p class="message">{{ 'board.gameStartsIn' | t: { n: secondsLeft() } }}</p>
      </div>
    }
  `,
  styles: `
    .scrim { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: color-mix(in srgb, var(--mat-sys-scrim) 55%, transparent); }
    .message { margin: 0; padding: 16px 32px; border-radius: 16px; background: var(--mat-sys-surface-container-high); font: var(--mat-sys-headline-medium); font-variant-numeric: tabular-nums; }
  `,
})
export class GameStartCountdown {
  // When the game starts, in this device's time (ms).
  readonly startsAt = input.required<number>();
  private readonly now = signal(Date.now());
  protected readonly secondsLeft = () => Math.max(0, Math.ceil((this.startsAt() - this.now()) / 1000));

  constructor() {
    const interval = setInterval(() => this.now.set(Date.now()), 100);
    inject(DestroyRef).onDestroy(() => clearInterval(interval));
  }
}
