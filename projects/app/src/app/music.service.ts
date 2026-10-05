import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export const MAIN_THEME_URL = '/audio/main_theme.mp3';
const VOLUME = 0.35;
const STORAGE_KEY = 'music-enabled';

// The bits of HTMLAudioElement the service uses; replaceable in tests (jsdom
// can't play media).
export interface MusicPlayer {
  loop: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
}

export const MUSIC_PLAYER_FACTORY = new InjectionToken<(url: string) => MusicPlayer>('MUSIC_PLAYER_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new Audio(url),
});

// The app's background music: the main theme on a loop. On unless the viewer
// switched it off (remembered in this browser). Browsers refuse sound before
// the first interaction, so a refused start waits for the first click or key.
@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly document = inject(DOCUMENT);
  private readonly createPlayer = inject(MUSIC_PLAYER_FACTORY);
  private player: MusicPlayer | null = null;
  private readonly unlockEvents = ['pointerdown', 'keydown'] as const;
  private readonly unlock = () => this.resume();

  readonly enabled = signal(readEnabled());
  readonly playing = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopWaitingForUnlock());
  }

  start(): void {
    if (this.enabled()) this.resume();
  }

  toggle(): void {
    const next = !this.enabled();
    this.enabled.set(next);
    writeEnabled(next);
    if (next) {
      this.resume();
    } else {
      this.stopWaitingForUnlock();
      this.player?.pause();
      this.playing.set(false);
    }
  }

  private resume(): void {
    if (!this.enabled() || this.playing()) return;
    this.player ??= this.makePlayer();
    // play() may return nothing on old engines; treat that as started.
    Promise.resolve(this.player.play()).then(
      () => {
        // Switched off while the browser was still starting it.
        if (!this.enabled()) return this.player?.pause();
        this.playing.set(true);
        this.stopWaitingForUnlock();
      },
      () => this.waitForUnlock()
    );
  }

  private makePlayer(): MusicPlayer {
    const player = this.createPlayer(MAIN_THEME_URL);
    player.loop = true;
    player.volume = VOLUME;
    return player;
  }

  private waitForUnlock(): void {
    for (const type of this.unlockEvents) this.document.addEventListener(type, this.unlock, { once: true });
  }

  private stopWaitingForUnlock(): void {
    for (const type of this.unlockEvents) this.document.removeEventListener(type, this.unlock);
  }
}

// A per-viewer convenience: storage can be missing or blocked, so fall back to on.
function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}
