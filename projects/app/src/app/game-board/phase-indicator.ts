import { Component, computed, input } from '@angular/core';
import { GameState, discardOwed } from 'engine';
import { forceOf, seatName } from '../labels';
import { DecisionCountdown } from './decision-countdown';

// Whose turn it is and which phase, e.g. "Seat 0 (you) – Play Phase", between
// the turn number and the draw pile count.
// The turn owner's name and timer are in their force colour.
// Presentational: every value comes from the (redacted) state or the engine.
@Component({
  selector: 'app-phase-indicator',
  imports: [DecisionCountdown],
  template: `
    <div class="phase-indicator" role="status" aria-live="polite" [attr.data-force]="ownerForce()">
      <span class="count turn">Turn {{ state().turn.turnNumber }}</span>{{ ' ' }}
      <span class="seat">{{ ownerName() }}</span>
      @if (isViewersTurn()) {
        {{ ' ' }}<span class="you">(you)</span>
      }
      {{ ' ' }}<span class="sep">–</span>{{ ' ' }}<span class="phase">{{ state().phase }} Phase</span>
      @if (discardsLeft() > 0) {
        {{ ' ' }}<span class="discard">– discard {{ discardsLeft() }} more</span>
      }
      @if (isViewersTurn() && state().phase === 'Play' && !state().pendingResponse) {
        <!-- At zero: End Phase. -->
        <app-decision-countdown class="timer" />
      }
      {{ ' ' }}<span class="count draw-pile">Draw Pile {{ drawPileCount() }}</span>
    </div>
  `,
  styles: `
    .timer { width: 160px; margin-left: 12px; }
    :host { display: block; position: sticky; top: var(--mat-toolbar-standard-height, 64px); z-index: 2; }
    @media (max-width: 599px) { :host { top: var(--mat-toolbar-mobile-height, 56px); } }
    .phase-indicator {
      display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 6px;
      margin: 8px 0; padding: 8px 16px; border-radius: 12px;
      background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container);
      font-size: 1.25em; font-weight: 600;
    }
    .seat, .you { color: var(--force-text); }
    .discard { color: var(--mat-sys-primary); font-weight: 700; }
    .count { font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
    .turn { margin-right: 12px; }
    .draw-pile { margin-left: 12px; }
  `,
})
export class PhaseIndicator {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input<string | null>(null);

  protected readonly ownerName = computed(() => seatName(this.state().players, this.state().turn.ownerSeatId));

  protected readonly ownerForce = computed(() =>
    forceOf(this.state().seats.find((s) => s.id === this.state().turn.ownerSeatId)?.kingdom)
  );

  protected readonly drawPileCount = computed(() => this.state().zones.find((z) => z.kind === 'drawPile')?.cards.length ?? 0);

  protected readonly isViewersTurn = computed(() => this.state().turn.ownerSeatId === this.viewerSeatId());
  protected readonly discardsLeft = computed(() => {
    const state = this.state();
    return state.phase === 'Discard' ? discardOwed(state, state.turn.ownerSeatId) : 0;
  });
}
