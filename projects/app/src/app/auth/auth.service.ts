import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ERROR_MESSAGES } from 'protocol';
import type { ErrorBody, ForgotPasswordBody, GuestBody, Me, MessageBody, ResetPasswordBody, SignInBody, SignUpBody } from 'protocol';

// A failed API call: the server's code and message, ready to show.
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again";

export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ErrorBody> | null;
    if (body && typeof body.code === 'string' && typeof body.message === 'string') return new ApiError(body.code, body.message, err.status);
    if (err.status === 0) return new ApiError('network', NETWORK_ERROR_MESSAGE, 0);
    return new ApiError('internal', ERROR_MESSAGES.internal, err.status);
  }
  return new ApiError('internal', ERROR_MESSAGES.internal, 0);
}

// Who is signed in. The session lives in an HttpOnly cookie the app never
// sees; this only mirrors the user the server reports.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<Me | null>(null);
  private readonly ready = signal(false);

  readonly me = this.current.asReadonly();
  // False until the first answer from /api/me, so the toolbar doesn't flash "Sign In".
  readonly loaded = this.ready.asReadonly();
  readonly isRegistered = computed(() => this.current()?.kind === 'registered');

  async load(): Promise<Me | null> {
    try {
      this.current.set(await firstValueFrom(this.http.get<Me>('/api/me')));
    } catch {
      this.current.set(null);
    }
    this.ready.set(true);
    return this.current();
  }

  signUp(body: SignUpBody): Promise<Me> {
    return this.signInWith('/api/auth/signup', body);
  }

  signIn(body: SignInBody): Promise<Me> {
    return this.signInWith('/api/auth/signin', body);
  }

  playAsGuest(body: GuestBody): Promise<Me> {
    return this.signInWith('/api/auth/guest', body);
  }

  resetPassword(body: ResetPasswordBody): Promise<Me> {
    return this.signInWith('/api/auth/reset-password', body);
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/signout', {}));
    } catch (err) {
      throw toApiError(err);
    }
    this.current.set(null);
  }

  async forgotPassword(body: ForgotPasswordBody): Promise<string> {
    try {
      return (await firstValueFrom(this.http.post<MessageBody>('/api/auth/forgot-password', body))).message;
    } catch (err) {
      throw toApiError(err);
    }
  }

  private async signInWith(url: string, body: object): Promise<Me> {
    let me: Me;
    try {
      me = await firstValueFrom(this.http.post<Me>(url, body));
    } catch (err) {
      throw toApiError(err);
    }
    this.current.set(me);
    this.ready.set(true);
    return me;
  }
}
