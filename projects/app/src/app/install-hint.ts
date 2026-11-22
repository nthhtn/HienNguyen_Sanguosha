import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TPipe } from './i18n/t.pipe';
import { InstallPrompt } from './install-prompt.service';
import { Layout } from './layout.service';

// After a "too small to play" message, in a phone browser tab the installed app could play on: one sentence, and an
// Install App button where Chrome offers to install. Renders nothing anywhere else.
@Component({
  selector: 'app-install-hint',
  imports: [MatButtonModule, TPipe],
  template: `
    @if (layout.installWouldHelp()) {
      <span class="hint">{{ 'play.installHint' | t }}</span>
      @if (installPrompt.available()) {
        <button mat-stroked-button type="button" class="install-app" (click)="installPrompt.install()">{{ 'play.installApp' | t }}</button>
      }
    }
  `,
  styles: `
    :host { display: contents; }
    .install-app { min-height: 44px; }
  `,
})
export class InstallHint {
  protected readonly layout = inject(Layout);
  protected readonly installPrompt = inject(InstallPrompt);
}
