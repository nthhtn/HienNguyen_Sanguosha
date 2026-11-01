import { Injectable, computed, signal } from '@angular/core';

export type PlaybackSpeedId = 'slow' | 'normal' | 'fast' | 'instant';
export const PLAYBACK_SPEEDS: readonly PlaybackSpeedId[] = ['slow', 'normal', 'fast', 'instant'];
// A duration is `ms / factor`, so Instant (Infinity) gives 0.
const FACTORS: Record<PlaybackSpeedId, number> = { slow: 0.5, normal: 1, fast: 2, instant: Infinity };

// How fast a battle plays: animations and bots read `factor`. The setting is hidden for now, so every
// game plays at Slow: no stored choice, and reduced motion does not change it.
@Injectable({ providedIn: 'root' })
export class PlaybackSpeed {
  readonly speed = signal<PlaybackSpeedId>('slow');
  readonly factor = computed(() => FACTORS[this.speed()]);

  set(id: PlaybackSpeedId): void {
    this.speed.set(id);
  }
}
