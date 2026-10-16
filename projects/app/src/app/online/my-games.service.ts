import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { GameSummary, MyGames } from 'protocol';
import { errorMsg, toApiError } from '../auth/auth.service';
import type { Msg } from '../i18n/msg';

// The signed-in player's finished games, from GET /api/me/games. The server
// decides who may ask (registered players only); this only shows its answer.
// Provided by MyGamesPage, not the root: each visit starts empty, so one
// player's list never shows to the next who signs in on the same tab.
@Injectable()
export class MyGamesService {
  private readonly http = inject(HttpClient);
  private readonly _games = signal<GameSummary[] | null>(null);
  private readonly _error = signal<Msg | null>(null);

  // Newest first; null until the first load succeeds.
  readonly games = this._games.asReadonly();
  readonly error = this._error.asReadonly();

  async load(): Promise<void> {
    try {
      this._games.set((await firstValueFrom(this.http.get<MyGames>('/api/me/games'))).games);
      this._error.set(null);
    } catch (err) {
      this._error.set(errorMsg(toApiError(err)));
    }
  }
}
