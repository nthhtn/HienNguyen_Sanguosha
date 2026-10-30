import { Injectable, WritableSignal, signal } from '@angular/core';

// Whether the board's battle playback has caught up. The board's director writes it; local bots and
// clocks wait on it. Idle with no board on screen (tests, the simulator), so nothing waits for nothing.
@Injectable({ providedIn: 'root' })
export class PlaybackGate {
  readonly idle: WritableSignal<boolean> = signal(true);
}
