import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EMAIL_MAX } from 'protocol';
import { errorMsg, AuthService } from './auth.service';
import { TMsgPipe, type Msg } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, TPipe, TMsgPipe],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>{{ 'auth.forgotPassword' | t }}</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (sent()) {
            <p class="sent hint" role="status">{{ 'auth.resetSent' | t }}</p>
          } @else {
            <form (submit)="$event.preventDefault(); submit()">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'auth.email' | t }}</mat-label>
                <input matInput class="email" type="email" autocomplete="email" [maxLength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
              </mat-form-field>
              @if (error()) {
                <p class="error" role="alert">{{ error() | tm }}</p>
              }
              <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">{{ 'auth.sendReset' | t }}</button>
            </form>
          }
          <div class="links">
            <a routerLink="/sign-in">{{ 'auth.backToSignIn' | t }}</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  protected readonly emailMax = EMAIL_MAX;

  readonly email = signal('');
  // The server's own confirmation is English; the screen shows its own text.
  readonly sent = signal(false);
  readonly error = signal<Msg | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.email().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.forgotPassword({ email: this.email().trim() });
      this.sent.set(true);
    } catch (err) {
      this.error.set(errorMsg(err));
    } finally {
      this.busy.set(false);
    }
  }
}
