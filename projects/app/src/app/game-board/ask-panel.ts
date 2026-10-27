import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Action } from 'engine';
import { TPipe } from '../i18n/t.pipe';
import { AskDescription } from './ability-description';
import { CardArt } from './card-art';
import { PlayingCard } from './playing-card';

// A "may" ask: use an optional ability or not. The content of the Ask dialog, and of the decision area
// of the Judgment popup. It offers only the engine's own actions: Use and Don't.
@Component({
  selector: 'app-ask-panel',
  imports: [MatButtonModule, PlayingCard, CardArt, TPipe],
  template: `
    <div class="body">
      @if (description().card; as card) {
        <app-playing-card [card]="card" />
      } @else if (description().generalId; as generalId) {
        <app-card-art [skin]="true" [id]="generalId" [label]="description().title" size="small" />
      }
      <div class="words">
        <p class="prompt">{{ description().prompt }}</p>
        @if (description().hint; as hint) {
          <p class="hint">{{ hint }}</p>
        }
      </div>
    </div>
    <div class="actions">
      <button mat-button type="button" class="decline" (click)="chosen.emit(description().decline)">{{ 'choice.option.decline' | t }}</button>
      <button mat-flat-button type="button" class="use" (click)="chosen.emit(description().use)">{{ description().useLabel }}</button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .body { display: flex; gap: 16px; align-items: flex-start; }
    .prompt { margin: 0 0 8px; font: var(--mat-sys-title-medium); }
    .hint { margin: 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  `,
})
export class AskPanel {
  readonly description = input.required<AskDescription>();
  // The engine's own action: Use or Don't.
  readonly chosen = output<Action>();
}
