import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX, EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN } from 'protocol';
import { errorMsg, AuthService } from './auth.service';
import { TMsgPipe, type Msg } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { returnUrlParams, safeReturnUrl } from './return-url';

@Component({
  selector: 'app-sign-up',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, TPipe, TMsgPipe],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>{{ 'nav.createAccount' | t }}</mat-card-title></mat-card-header>
        <mat-card-content>
          <form (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.email' | t }}</mat-label>
              <input matInput class="email" type="email" autocomplete="email" [maxLength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.password' | t }}</mat-label>
              <input matInput class="password" type="password" autocomplete="new-password" [maxLength]="passwordMax" [value]="password()" (input)="password.set($any($event.target).value)" />
            </mat-form-field>
            <p class="password-hint">{{ 'auth.passwordHint' | t: { min: passwordMin } }}</p>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.yourName' | t }}</mat-label>
              <input matInput class="name" autocomplete="nickname" [maxLength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </mat-form-field>
            @if (error()) {
              <p class="error" role="alert">{{ error() | tm }}</p>
            }
            <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">{{ 'nav.createAccount' | t }}</button>
          </form>
          <div class="links">
            <a routerLink="/sign-in" [queryParams]="returnParams">{{ 'nav.signIn' | t }}</a>
            <a routerLink="/guest" [queryParams]="returnParams">{{ 'auth.playAsGuest' | t }}</a>
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
  readonly error = signal<Msg | null>(null);
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
      this.error.set(errorMsg(err));
    } finally {
      this.busy.set(false);
    }
  }
}
