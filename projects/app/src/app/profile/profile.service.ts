import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ChangePasswordBody, ProfileMode, ProfileStats } from 'protocol';
import { AuthService, errorMsg, toApiError } from '../auth/auth.service';
import { msg, type Msg } from '../i18n/msg';

// The signed-in player's profile, from GET /api/me/profile, and the two things
// they may change. The server decides who may ask and computes every number;
// this only shows its answer. Provided by ProfilePage, not the root: each visit
// starts empty, so one player's stats never show to the next on the same tab.
@Injectable()
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly _stats = signal<ProfileStats | null>(null);
  private readonly _error = signal<Msg | null>(null);
  private readonly _actionError = signal<Msg | null>(null);
  private readonly _mode = signal<ProfileMode>('all');

  // Null until the first load succeeds; kept when a reload fails.
  readonly stats = this._stats.asReadonly();
  // Why the stats could not be loaded.
  readonly error = this._error.asReadonly();
  // Why the last rename or password change was refused.
  readonly actionError = this._actionError.asReadonly();
  readonly mode = this._mode.asReadonly();

  async load(): Promise<void> {
    const mode = this._mode();
    try {
      const stats = await firstValueFrom(this.http.get<ProfileStats>('/api/me/profile', { params: { mode } }));
      // A slow answer for a filter that is no longer chosen must not replace the current one.
      if (mode !== this._mode()) return;
      this._stats.set(stats);
      this._error.set(null);
    } catch (err) {
      if (mode === this._mode()) this._error.set(errorMsg(toApiError(err)));
    }
  }

  setMode(mode: ProfileMode): Promise<void> {
    this._mode.set(mode);
    return this.load();
  }

  // True when the name was saved.
  async rename(displayName: string): Promise<boolean> {
    this._actionError.set(null);
    try {
      await this.auth.rename({ displayName });
    } catch (err) {
      this._actionError.set(errorMsg(err));
      return false;
    }
    await this.load();
    return true;
  }

  // True when the password was changed; the other devices are signed out by the server.
  // `currentPassword` is null for an account with no password yet (it signed in with Google).
  async changePassword(currentPassword: string | null, newPassword: string): Promise<boolean> {
    this._actionError.set(null);
    const body: ChangePasswordBody = currentPassword === null ? { newPassword } : { currentPassword, newPassword };
    try {
      await firstValueFrom(this.http.post<void>('/api/me/password', body));
      // The account may have just got its first password: the page shows what the server now says.
      await this.auth.load();
      return true;
    } catch (err) {
      const failure = toApiError(err);
      // The sign-in text names an email, which this form has none of.
      this._actionError.set(failure.code === 'invalid_credentials' ? msg('profile.settings.wrongPassword') : errorMsg(failure));
      return false;
    }
  }
}
