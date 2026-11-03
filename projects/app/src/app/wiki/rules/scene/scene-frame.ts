import { Component, input } from '@angular/core';
import { TPipe } from '../../../i18n/t.pipe';
import type { MessageKey } from '../../../i18n/messages';

// A framed part of the table a rule is shown on: an optional caption, then whatever the page puts inside.
@Component({
  selector: 'app-scene',
  imports: [TPipe],
  template: `
    @if (caption(); as caption) {
      <p class="cap">{{ caption | t }}</p>
    }
    <ng-content />
  `,
  styles: `
    :host { display: block; background: var(--mat-sys-surface-container); border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; padding: 16px; margin: 16px 0 24px; }
    .cap { margin: 0 0 12px; font: var(--mat-sys-label-medium); font-weight: 700; letter-spacing: 0.06em; color: var(--mat-sys-on-surface-variant); }
  `,
})
export class SceneFrame {
  readonly caption = input<MessageKey>();
}
