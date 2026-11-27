import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TPipe } from '../i18n/t.pipe';
import { AuthService } from './auth.service';
import { returnUrlParams } from './return-url';

// "Continue with Google": a plain link, because the sign-in is a trip to Google
// and back (a full page load, not a route). Shown only when the server has Google set up.
@Component({
  selector: 'app-google-button',
  imports: [MatButtonModule, TPipe],
  styleUrl: './auth-card.css',
  template: `
    @if (on()) {
      <a mat-stroked-button class="google-button" [href]="href()">{{ 'auth.continueWithGoogle' | t }}</a>
    }
  `,
})
export class GoogleButton {
  // The page to come back to; only a path inside the app is passed on.
  readonly returnUrl = input<string | null>(null);
  protected readonly on = signal(false);
  protected readonly href = computed(() => {
    const back = returnUrlParams(this.returnUrl())['returnUrl'];
    return back ? `/api/auth/google/start?returnUrl=${encodeURIComponent(back)}` : '/api/auth/google/start';
  });

  constructor() {
    void inject(AuthService)
      .providers()
      .then((providers) => this.on.set(providers.google));
  }
}
