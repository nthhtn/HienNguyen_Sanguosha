import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type MusicTrack = 'background' | 'win';
export const TRACK_URLS: Record<MusicTrack, string> = { background: '/audio/background.ogg', win: '/audio/win.ogg' };
export type SoundEffect = 'injure' | 'heal' | 'weapon' | 'armor' | 'mount';
export const EFFECT_URLS: Record<SoundEffect, string> = {
  injure: '/audio/injure.ogg',
  heal: '/audio/peach.ogg',
  weapon: '/audio/weapon.ogg',
  armor: '/audio/armor.ogg',
  mount: '/audio/horse.ogg',
};
// Music sits well under the event sounds so an injury or a heal always stands out.
const MUSIC_VOLUME = 0.2;
const EFFECT_VOLUME = 0.8;
const STORAGE_KEY = 'music-enabled';

// The bits of HTMLAudioElement the service uses; replaceable in tests (jsdom
// can't play media).
export interface MusicPlayer {
  loop: boolean;
  volume: number;
  currentTime?: number;
  play(): Promise<void>;
  pause(): void;
}

export const MUSIC_PLAYER_FACTORY = new InjectionToken<(url: string) => MusicPlayer>('MUSIC_PLAYER_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new Audio(url),
});

// The app's music: the background track on a loop, swapped for the win track
// (played once) when a game is won (setTrack). On unless the viewer
// switched it off (remembered in this browser). Browsers refuse sound before
// the first interaction, so a refused start waits for the first click or key.
@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly document = inject(DOCUMENT);
  private readonly createPlayer = inject(MUSIC_PLAYER_FACTORY);
  private readonly players = new Map<MusicTrack, MusicPlayer>();
  private track: MusicTrack = 'background';
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
      this.players.get(this.track)?.pause();
      this.playing.set(false);
    }
  }

  // Switches to `track`, restarting it from the top; the old one stops.
  setTrack(track: MusicTrack): void {
    if (track === this.track) return;
    this.players.get(this.track)?.pause();
    this.track = track;
    this.playing.set(false);
    const next = this.players.get(track);
    if (next && next.currentTime !== undefined) next.currentTime = 0;
    this.resume();
  }

  private resume(): void {
    if (!this.enabled() || this.playing()) return;
    const track = this.track;
    const player = this.players.get(track) ?? this.makePlayer(track);
    this.players.set(track, player);
    // play() may return nothing on old engines; treat that as started.
    Promise.resolve(player.play()).then(
      () => {
        // Switched off, or switched to another track, while the browser was still starting it.
        if (!this.enabled() || this.track !== track) return player.pause();
        this.playing.set(true);
        this.stopWaitingForUnlock();
      },
      () => this.waitForUnlock()
    );
  }

  private makePlayer(track: MusicTrack): MusicPlayer {
    const player = this.createPlayer(TRACK_URLS[track]);
    // The background track loops; the win track plays through once, then the screen stays quiet.
    player.loop = track === 'background';
    player.volume = MUSIC_VOLUME;
    return player;
  }

  private waitForUnlock(): void {
    for (const type of this.unlockEvents) this.document.addEventListener(type, this.unlock, { once: true });
  }

  private stopWaitingForUnlock(): void {
    for (const type of this.unlockEvents) this.document.removeEventListener(type, this.unlock);
  }
}

// Short sound effects (an injury, a heal, equipping), on the same on/off switch as the music.
// Each play gets its own player so quick repeats overlap instead of cutting off.
@Injectable({ providedIn: 'root' })
export class SoundEffects {
  private readonly music = inject(MusicService);
  private readonly createPlayer = inject(MUSIC_PLAYER_FACTORY);

  play(effect: SoundEffect): void {
    if (!this.music.enabled()) return;
    const player = this.createPlayer(EFFECT_URLS[effect]);
    player.volume = EFFECT_VOLUME;
    // A browser that refuses (no interaction yet) just misses this one effect.
    Promise.resolve(player.play()).catch(() => undefined);
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
