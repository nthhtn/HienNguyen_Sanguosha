import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';

export interface DiscardDialogData {
  // The viewer's hand.
  cards: CardInstance[];
  // How many must go, from the engine's hand-limit rule.
  count: number;
  // Told the ticked cards (hand order) on every change, so a timeout can use them.
  chosenChanged?: (instanceIds: string[]) => void;
}

// The Discard phase: tick exactly `count` cards of the hand, then Discard.
// Closes only through Discard, with the ticked instance ids, in hand order.
@Component({
  selector: 'app-discard-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, PlayingCard, DecisionCountdown],
  template: `
    <h2 mat-dialog-title>Discard {{ data.count }} {{ data.count === 1 ? 'Card' : 'Cards' }}</h2>
    <mat-dialog-content>
      <p class="hint">Your hand is over its limit. Choose {{ data.count }} to discard · {{ chosen().size }}/{{ data.count }} chosen</p>
      <ul class="hand">
        @for (card of data.cards; track card.instanceId) {
          <li>
            <button
              type="button"
              class="card"
              [class.checked]="chosen().has(card.instanceId)"
              [attr.aria-pressed]="chosen().has(card.instanceId)"
              [attr.data-card-id]="card.instanceId"
              [disabled]="!chosen().has(card.instanceId) && full()"
              (click)="toggle(card.instanceId)"
            >
              <!-- The same card face as in the hand: suit and number top left, name along the bottom. -->
              <app-playing-card [card]="card" />
              @if (chosen().has(card.instanceId)) {
                <mat-icon class="tick">check_circle</mat-icon>
              }
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <!-- At zero: the ticked cards, topped up from the start of the hand. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="discard" [disabled]="!full()" (click)="discard()">
        <mat-icon>delete</mat-icon> Discard
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .hint { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .hand { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 12px; }
    .card {
      position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 100%;
      padding: 6px 4px; border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer;
    }
    .card:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .card.checked { border-color: var(--mat-sys-error); background: var(--mat-sys-error-container); }
    .card:disabled { opacity: 0.5; cursor: default; }
    .tick { position: absolute; top: 2px; right: 2px; z-index: 1; color: var(--mat-sys-error); background: #fff; border-radius: 50%; }
    .timer { display: block; padding: 8px 24px 0; }
    .discard { --mat-button-filled-container-color: var(--mat-sys-error); --mat-button-filled-label-text-color: var(--mat-sys-on-error); }
  `,
})
export class DiscardDialog {
  protected readonly data = inject<DiscardDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<DiscardDialog, string[]>>(MatDialogRef);

  protected readonly chosen = signal(new Set<string>());
  protected readonly full = computed(() => this.chosen().size === this.data.count);

  protected toggle(instanceId: string): void {
    const next = new Set(this.chosen());
    if (next.has(instanceId)) next.delete(instanceId);
    else if (next.size < this.data.count) next.add(instanceId);
    this.chosen.set(next);
    this.data.chosenChanged?.(this.data.cards.map((c) => c.instanceId).filter((id) => next.has(id)));
  }

  protected discard(): void {
    if (!this.full()) return;
    this.dialogRef.close(this.data.cards.map((c) => c.instanceId).filter((id) => this.chosen().has(id)));
  }
}
