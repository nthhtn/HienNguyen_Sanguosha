import { Component, computed, input } from '@angular/core';
import { GameState, cardsOverHandLimit } from 'engine';

// Whose turn it is and which phase, e.g. "seat-0 (you) – Play Phase".
// Presentational: every value comes from the (redacted) state or the engine.
@Component({
  selector: 'app-phase-indicator',
  template: `
    <div class="phase-indicator" role="status" aria-live="polite">
      <span class="seat">{{ state().turn.ownerSeatId }}</span>
      @if (isViewersTurn()) {
        {{ ' ' }}<span class="you">(you)</span>
      }
      {{ ' ' }}<span class="sep">–</span>{{ ' ' }}<span class="phase">{{ state().phase }} Phase</span>
      @if (discardsLeft() > 0) {
        {{ ' ' }}<span class="discard">– discard {{ discardsLeft() }} more</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; position: sticky; top: var(--mat-toolbar-standard-height, 64px); z-index: 2; }
    @media (max-width: 599px) { :host { top: var(--mat-toolbar-mobile-height, 56px); } }
    .phase-indicator {
      display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 6px;
      margin: 8px 0; padding: 8px 16px; border-radius: 12px;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
      font-size: 1.25em; font-weight: 600;
    }
    .you { color: var(--mat-sys-primary); }
    .discard { color: var(--mat-sys-error); }
  `,
})
export class PhaseIndicator {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input<string | null>(null);

  protected readonly isViewersTurn = computed(() => this.state().turn.ownerSeatId === this.viewerSeatId());
  protected readonly discardsLeft = computed(() => {
    const state = this.state();
    return state.phase === 'Discard' ? cardsOverHandLimit(state, state.turn.ownerSeatId) : 0;
  });
}
