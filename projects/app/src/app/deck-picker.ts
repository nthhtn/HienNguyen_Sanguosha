import { Component, input, model } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import type { DeckId } from 'content';
import type { MessageKey } from './i18n/messages';
import { TPipe } from './i18n/t.pipe';

// The decks the host can pick, in the order shown. A new deck is one line here
// plus its catalog keys (and the engine's own list of decks). `disabled`: listed
// but not choosable. Dynasty Wars (`default`) waits for its own engine rules
// (see docs/deferrals.md); drop its `disabled` to bring it back.
const OPTIONS: { id: DeckId; label: MessageKey; disabled?: true }[] = [
  { id: 'alternate', label: 'setup.deck.alternate' },
  { id: 'default', label: 'setup.deck.default', disabled: true },
];

let nextId = 0;

// One radio group choosing which card distribution a game is dealt from. Shared
// by every Game Setup screen; it only holds the choice, the screen decides what
// to do with it.
@Component({
  selector: 'app-deck-picker',
  imports: [MatRadioModule, TPipe],
  template: `
    <div class="deck">
      <span class="label" [id]="labelId">{{ 'setup.deck' | t }}</span>
      <mat-radio-group class="options" [attr.aria-labelledby]="labelId" [value]="value()" [disabled]="disabled()" (change)="value.set($event.value)">
        @for (option of options; track option.id) {
          <mat-radio-button [value]="option.id" [disabled]="!!option.disabled">{{ option.label | t }}</mat-radio-button>
        }
      </mat-radio-group>
      <p class="hint">{{ 'setup.deck.hint' | t }}</p>
    </div>
  `,
  styles: `
    .deck { margin-bottom: 12px; }
    .label { display: block; margin-bottom: 4px; font: var(--mat-sys-title-small); }
    .options { display: flex; flex-wrap: wrap; gap: 0 16px; }
    .hint { margin: 0; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
  `,
})
export class DeckPicker {
  readonly value = model<DeckId>('alternate');
  readonly disabled = input(false);
  protected readonly options = OPTIONS;
  protected readonly labelId = `deck-label-${nextId++}`;
}
