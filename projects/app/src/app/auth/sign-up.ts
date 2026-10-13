import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX, EMAIL_MAX, ERROR_MESSAGES, PASSWORD_MAX, PASSWORD_MIN } from 'protocol';
import { ApiError, AuthService } from './auth.service';
import { returnUrlParams, safeReturnUrl } from './return-url';

@Component({
  selector: 'app-sign-up',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Create Account</mat-card-title></mat-card-header>
        <mat-card-content>
          <form (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput class="email" type="email" autocomplete="email" [maxLength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput class="password" type="password" autocomplete="new-password" [maxLength]="passwordMax" [value]="password()" (input)="password.set($any($event.target).value)" />
            </mat-form-field>
            <p class="password-hint">At least {{ passwordMin }} characters</p>
            <mat-form-field appearance="outline">
              <mat-label>Your Name</mat-label>
              <input matInput class="name" autocomplete="nickname" [maxLength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </mat-form-field>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Create Account</button>
          </form>
          <div class="links">
            <a routerLink="/sign-in" [queryParams]="returnParams">Sign In</a>
            <a routerLink="/guest" [queryParams]="returnParams">Play as Guest</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class SignUp {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly returnParams = returnUrlParams(this.returnUrl);
  protected readonly emailMax = EMAIL_MAX;
  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly nameMax = DISPLAY_NAME_MAX;

  readonly email = signal('');
  readonly password = signal('');
  readonly displayName = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.email().trim() !== '' && this.password() !== '' && this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signUp({ email: this.email().trim(), password: this.password(), displayName: this.displayName() });
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
