import { Component, inject } from '@angular/core';
import { Layout } from './layout.service';
import { TPipe } from './i18n/t.pipe';
import { InstallHint } from './install-hint';

// Beside the buttons that start or join a game: on a window too small to play, they are disabled and this says why.
@Component({
  selector: 'app-small-screen-notice',
  imports: [TPipe, InstallHint],
  template: `
    @if (!layout.canPlay()) {
      <p class="notice" role="status">{{ 'play.needsLargerScreen' | t }}</p>
      @if (layout.installWouldHelp()) {
        <p class="install"><app-install-hint /></p>
      }
    }
  `,
  styles: `
    .notice { margin: 8px 0 0; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
    .install { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin: 4px 0 0; font: var(--mat-sys-body-medium); }
  `,
})
export class SmallScreenNotice {
  protected readonly layout = inject(Layout);
}
