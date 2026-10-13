import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ERROR_MESSAGES, PASSWORD_MAX, PASSWORD_MIN } from 'protocol';
import { ApiError, AuthService } from './auth.service';

// Opened from the emailed link: /reset-password?token=…
@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Reset Password</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (token) {
            <form (submit)="$event.preventDefault(); submit()">
              <mat-form-field appearance="outline">
                <mat-label>New Password</mat-label>
                <input matInput class="password" type="password" autocomplete="new-password" [maxLength]="passwordMax" [value]="password()" (input)="password.set($any($event.target).value)" />
              </mat-form-field>
              <p class="password-hint">At least {{ passwordMin }} characters</p>
              @if (error()) {
                <p class="error" role="alert">{{ error() }}</p>
              }
              <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Set Password</button>
            </form>
          } @else {
            <p class="error" role="alert">{{ invalidLink }}</p>
          }
          <div class="links">
            <a routerLink="/forgot-password">Forgot Password</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly invalidLink = ERROR_MESSAGES.invalid_reset_token;
  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly passwordMin = PASSWORD_MIN;

  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.password() !== '');

  async submit(): Promise<void> {
    if (!this.token || this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.resetPassword({ token: this.token, password: this.password() });
      await this.router.navigateByUrl('/setup');
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
