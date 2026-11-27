import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { ProfileService } from './profile.service';

// The Settings tab: a new display name and a new password. The server checks
// both; this shows what it says.
@Component({
  selector: 'app-profile-settings',
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, TPipe, TMsgPipe],
  styleUrl: './profile.css',
  template: `
    <form class="settings-form" (submit)="$event.preventDefault(); saveName()">
      <mat-form-field appearance="outline">
        <mat-label>{{ 'profile.settings.name' | t }}</mat-label>
        <input matInput class="name" type="text" autocomplete="nickname" [maxLength]="nameMax" [value]="name()" (input)="set($any($event.target).value)" />
      </mat-form-field>
      <p class="hint">{{ 'profile.settings.nameHint' | t }}</p>
      @if (nameSaved()) {
        <p class="name-saved hint" role="status">{{ 'profile.settings.nameSaved' | t }}</p>
      }
      @if (nameError(); as text) {
        <p class="error" role="alert">{{ text | tm }}</p>
      }
      <button mat-flat-button class="save-name" type="submit" [disabled]="busy() || !nameChanged()">{{ 'profile.settings.saveName' | t }}</button>
    </form>

    <form class="settings-form" (submit)="$event.preventDefault(); savePassword()">
      <h2>{{ (hasPassword() ? 'profile.settings.changePassword' : 'profile.settings.setPassword') | t }}</h2>
      @if (hasPassword()) {
        <mat-form-field appearance="outline">
          <mat-label>{{ 'profile.settings.current' | t }}</mat-label>
          <input matInput class="current-password" type="password" autocomplete="current-password" [maxLength]="passwordMax" [value]="current()" (input)="current.set($any($event.target).value)" />
        </mat-form-field>
      }
      <mat-form-field appearance="outline">
        <mat-label>{{ 'profile.settings.new' | t }}</mat-label>
        <input matInput class="new-password" type="password" autocomplete="new-password" [maxLength]="passwordMax" [value]="next()" (input)="next.set($any($event.target).value)" />
      </mat-form-field>
      <p class="hint">{{ 'profile.settings.newHint' | t: { min: passwordMin } }}</p>
      @if (passwordChanged()) {
        <p class="password-saved hint" role="status">{{ 'profile.settings.passwordChanged' | t }}</p>
      }
      @if (passwordError(); as text) {
        <p class="error" role="alert">{{ text | tm }}</p>
      }
      <button mat-flat-button class="save-password" type="submit" [disabled]="busy() || !canChangePassword()">{{ (hasPassword() ? 'profile.settings.changePassword' : 'profile.settings.setPassword') | t }}</button>
    </form>
  `,
})
export class ProfileSettings {
  private readonly service = inject(ProfileService);
  private readonly auth = inject(AuthService);
  // False for an account that signed in with Google and has no password yet.
  protected readonly hasPassword = computed(() => this.auth.me()?.hasPassword !== false);
  // The name now in use; the name box starts from it.
  readonly displayName = input.required<string>();
  protected readonly nameMax = DISPLAY_NAME_MAX;
  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly passwordMin = PASSWORD_MIN;

  private readonly edited = signal<string | null>(null);
  protected readonly name = computed(() => this.edited() ?? this.displayName());
  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly busy = signal(false);
  protected readonly nameSaved = signal(false);
  protected readonly passwordChanged = signal(false);
  // Which form the server's last refusal belongs to.
  private readonly failed = signal<'name' | 'password' | null>(null);
  protected readonly nameError = computed(() => (this.failed() === 'name' ? this.service.actionError() : null));
  protected readonly passwordError = computed(() => (this.failed() === 'password' ? this.service.actionError() : null));
  protected readonly nameChanged = computed(() => this.name().trim() !== '' && this.name().trim() !== this.displayName());
  protected readonly canChangePassword = computed(() => (!this.hasPassword() || this.current() !== '') && this.next() !== '');

  protected set(value: string): void {
    this.edited.set(value);
  }

  protected async saveName(): Promise<void> {
    if (this.busy() || !this.nameChanged()) return;
    this.busy.set(true);
    this.nameSaved.set(false);
    try {
      const saved = await this.service.rename(this.name());
      this.failed.set(saved ? null : 'name');
      this.nameSaved.set(saved);
      if (saved) this.edited.set(null);
    } finally {
      this.busy.set(false);
    }
  }

  protected async savePassword(): Promise<void> {
    if (this.busy() || !this.canChangePassword()) return;
    this.busy.set(true);
    this.passwordChanged.set(false);
    try {
      const saved = await this.service.changePassword(this.hasPassword() ? this.current() : null, this.next());
      this.failed.set(saved ? null : 'password');
      this.passwordChanged.set(saved);
      if (saved) {
        this.current.set('');
        this.next.set('');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
