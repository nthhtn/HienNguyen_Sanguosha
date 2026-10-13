import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EMAIL_MAX, ERROR_MESSAGES } from 'protocol';
import { ApiError, AuthService } from './auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Forgot Password</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (sentMessage(); as message) {
            <p class="sent hint" role="status">{{ message }}</p>
          } @else {
            <form (submit)="$event.preventDefault(); submit()">
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput class="email" type="email" autocomplete="email" [maxLength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
              </mat-form-field>
              @if (error()) {
                <p class="error" role="alert">{{ error() }}</p>
              }
              <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Send Reset Link</button>
            </form>
          }
          <div class="links">
            <a routerLink="/sign-in">Back to Sign In</a>
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
  readonly sentMessage = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.email().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.sentMessage.set(await this.auth.forgotPassword({ email: this.email().trim() }));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
