import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CreateRoomBody, JoinRoomBody, RoomCreated, RoomList } from 'protocol';
import { toApiError } from '../auth/auth.service';

export const ROOM_LIST_POLL_MS = 5_000;

// The room list (polled while the Rooms screen is open), and creating and
// joining rooms over HTTP. The server decides everything; this only asks.
@Injectable({ providedIn: 'root' })
export class RoomsService {
  private readonly http = inject(HttpClient);
  private readonly _list = signal<RoomList | null>(null);
  private readonly _error = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  pollMs = ROOM_LIST_POLL_MS;
  readonly list = this._list.asReadonly();
  readonly error = this._error.asReadonly();

  async refresh(): Promise<void> {
    try {
      this._list.set(await firstValueFrom(this.http.get<RoomList>('/api/rooms')));
      this._error.set(null);
    } catch (err) {
      this._error.set(toApiError(err).message);
    }
  }

  startPolling(): void {
    this.stopPolling();
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.pollMs);
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async create(body: CreateRoomBody): Promise<string> {
    try {
      return (await firstValueFrom(this.http.post<RoomCreated>('/api/rooms', body))).id;
    } catch (err) {
      throw toApiError(err);
    }
  }

  async join(roomId: string, displayName: string): Promise<void> {
    const body: JoinRoomBody = { displayName };
    try {
      await firstValueFrom(this.http.post<RoomCreated>(`/api/rooms/${encodeURIComponent(roomId)}/join`, body));
    } catch (err) {
      throw toApiError(err);
    }
  }
}
