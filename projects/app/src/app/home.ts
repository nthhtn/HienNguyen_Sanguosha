import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FEATURE_FLAGS } from './feature-flags';
import { TPipe } from './i18n/t.pipe';
import { InstallPrompt } from './install-prompt.service';
import { Layout } from './layout.service';

// The front door at `/` for friends opening the link in a browser: the game's name, the ways in, and where a phone
// can install the app. The installed app and signed-in players never see it (homeRedirect).
@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, TPipe],
  styleUrl: './auth/auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header>
          <mat-card-title>{{ 'app.title' | t }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="actions">
            <a mat-flat-button class="play-online" routerLink="/rooms"><mat-icon>public</mat-icon>{{ 'nav.online' | t }}</a>
            <a mat-stroked-button class="play-guest" routerLink="/guest" [queryParams]="back">{{ 'auth.playAsGuest' | t }}</a>
            @if (flags.playOffline) {
              <a mat-stroked-button class="play-offline" routerLink="/setup">{{ 'nav.play' | t }}</a>
            }
          </div>
          @if (layout.installWouldHelp()) {
            <section class="install">
              <h3 class="install-title">{{ 'home.install.title' | t }}</h3>
              <p>{{ 'home.install.body' | t }}</p>
              @if (installPrompt.available()) {
                <button mat-stroked-button type="button" class="install-app" (click)="installPrompt.install()">{{ 'play.installApp' | t }}</button>
              } @else {
                <p class="install-manual">{{ 'home.install.manual' | t }}</p>
              }
            </section>
          }
          <div class="links">
            <a class="sign-in" routerLink="/sign-in" [queryParams]="back">{{ 'nav.signIn' | t }}</a>
            <a class="rules" routerLink="/wiki/rules">{{ 'nav.rules' | t }}</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .actions { display: flex; flex-direction: column; gap: 12px; padding-top: 16px; }
    .actions a { min-height: 44px; }
    .install { margin-top: 20px; padding: 12px; border-radius: 12px; background: var(--mat-sys-surface-container); }
    .install-title { margin: 0 0 4px; font: var(--mat-sys-title-small); }
    .install p { margin: 0 0 8px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .install-app { min-height: 44px; }
    .links { display: flex; justify-content: space-between; margin-top: 20px; }
  `,
})
export class Home {
  protected readonly flags = inject(FEATURE_FLAGS);
  protected readonly layout = inject(Layout);
  protected readonly installPrompt = inject(InstallPrompt);
  // Sign In and the guest page come back to Rooms afterwards.
  protected readonly back = { returnUrl: '/rooms' };
}
