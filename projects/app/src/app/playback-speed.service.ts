import { Injectable, computed, signal } from '@angular/core';
import { prefersReducedMotion } from './game-board/beat-player';

export type PlaybackSpeedId = 'slow' | 'normal' | 'fast' | 'instant';
export const PLAYBACK_SPEEDS: readonly PlaybackSpeedId[] = ['slow', 'normal', 'fast', 'instant'];
// A duration is `ms / factor`, so Instant (Infinity) gives 0.
const FACTORS: Record<PlaybackSpeedId, number> = { slow: 0.5, normal: 1, fast: 2, instant: Infinity };
const SPEED_KEY = 'playbackSpeed';

// How fast a battle plays: animations and bots read `factor`. Remembered in this browser; with no
// choice made, Normal, or Instant for a viewer who prefers reduced motion.
@Injectable({ providedIn: 'root' })
export class PlaybackSpeed {
  readonly speed = signal<PlaybackSpeedId>(readSpeed() ?? (prefersReducedMotion() ? 'instant' : 'normal'));
  readonly factor = computed(() => FACTORS[this.speed()]);

  set(id: PlaybackSpeedId): void {
    this.speed.set(id);
    try {
      localStorage.setItem(SPEED_KEY, id);
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  }
}

// A per-viewer convenience: storage can be missing or blocked, so there is just no stored choice.
function readSpeed(): PlaybackSpeedId | undefined {
  try {
    const stored = localStorage.getItem(SPEED_KEY);
    return PLAYBACK_SPEEDS.find((id) => id === stored);
  } catch {
    return undefined;
  }
}
