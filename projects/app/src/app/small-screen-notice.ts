import { Component, inject } from '@angular/core';
import { Layout } from './layout.service';
import { TPipe } from './i18n/t.pipe';

// Beside the buttons that start or join a game: on a window too small to play, they are disabled and this says why.
@Component({
  selector: 'app-small-screen-notice',
  imports: [TPipe],
  template: `
    @if (!layout.canPlay()) {
      <p class="notice" role="status">{{ 'play.needsLargerScreen' | t }}</p>
    }
  `,
  styles: `
    .notice { margin: 8px 0 0; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class SmallScreenNotice {
  protected readonly layout = inject(Layout);
}
