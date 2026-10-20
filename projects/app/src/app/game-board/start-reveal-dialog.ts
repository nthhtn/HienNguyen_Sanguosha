import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DecisionCountdown } from './decision-countdown';
import { MinimizeButton } from './minimize-button';
import { TPipe } from '../i18n/t.pipe';

export interface StartRevealOption {
  slot: 'main' | 'deputy';
  // "Main General" or "Deputy General", in the language on.
  slotLabel: string;
  // The hidden General's name: the viewer's own, so already known to them.
  name: string;
}

export interface StartRevealDialogData {
  options: StartRevealOption[];
}

// The start of the viewer's turn, before anything else happens: tick the hidden Generals to
// reveal (none is fine), then Confirm. Closes only through Confirm, with the ticked slots, Main
// first. The engine offers it as one ConfirmRevealsAction; at zero the clock confirms with none.
@Component({
  selector: 'app-start-reveal-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, DecisionCountdown, MinimizeButton, TPipe],
  template: `
    <div class="title-row">
      <h2 mat-dialog-title>{{ 'startReveal.title' | t }}</h2>
      <app-minimize-button />
    </div>
    <mat-dialog-content>
      <p class="hint">{{ 'startReveal.hint' | t }}</p>
      <ul class="generals">
        @for (option of data.options; track option.slot) {
          <li>
            <button
              type="button"
              class="general"
              [class.checked]="chosen().has(option.slot)"
              [attr.aria-pressed]="chosen().has(option.slot)"
              [attr.data-slot]="option.slot"
              (click)="toggle(option.slot)"
            >
              <mat-icon class="mark" aria-hidden="true">{{ chosen().has(option.slot) ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
              <span class="slot">{{ option.slotLabel }}</span>
              <span class="name">{{ option.name }}</span>
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="confirm" (click)="confirm()">{{ 'ui.confirm' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .hint { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .generals { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
    .general {
      display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; text-align: left;
      border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer; font: var(--mat-sys-body-large);
    }
    .general:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .general.checked { border-color: var(--force); background: color-mix(in srgb, var(--force) 18%, white); }
    .mark { color: var(--force); }
    .slot { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-large); }
    .name { font-weight: 600; }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class StartRevealDialog {
  protected readonly data = inject<StartRevealDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<StartRevealDialog, Array<'main' | 'deputy'>>>(MatDialogRef);

  protected readonly chosen = signal(new Set<'main' | 'deputy'>());

  protected toggle(slot: 'main' | 'deputy'): void {
    const next = new Set(this.chosen());
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    this.chosen.set(next);
  }

  protected confirm(): void {
    this.dialogRef.close(this.data.options.map((o) => o.slot).filter((slot) => this.chosen().has(slot)));
  }
}
