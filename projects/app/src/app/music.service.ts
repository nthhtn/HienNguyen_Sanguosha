import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type MusicTrack = 'background' | 'win';
export const TRACK_URLS: Record<MusicTrack, string> = { background: '/audio/background.ogg', win: '/audio/win.ogg' };
export type SoundEffect = 'injure' | 'heal' | 'weapon' | 'armor' | 'mount' | 'death-wei' | 'death-shu' | 'death-wu' | 'death-qun';
export const EFFECT_URLS: Record<SoundEffect, string> = {
  injure: '/audio/injure.ogg',
  heal: '/audio/peach.ogg',
  weapon: '/audio/weapon.ogg',
  armor: '/audio/armor.ogg',
  mount: '/audio/horse.ogg',
  'death-wei': '/audio/death_wei.ogg',
  'death-shu': '/audio/death_shu.ogg',
  'death-wu': '/audio/death_wu.ogg',
  'death-qun': '/audio/death_qun.ogg',
};
// A spoken line, voiced by the seat's gender: /audio/<gender>/<file>.
export type Voice = 'slash' | 'dodge' | 'sos' | 'break' | 'chains' | 'blaze' | 'hail-of-arrows' | 'barbarians' | 'steal' | 'wuxie' | 'starvation' | 'duel' | 'fire-slash' | 'thunder-slash' | 'coerce' | 'wine' | 'harvest' | 'draw-two' | 'peach-garden' | 'capture' | 'lightning' | 'amass' | 'ascertain' | 'ally-far-attack-near';
export type VoiceGender = 'male' | 'female';
export const VOICE_FILES: Record<Voice, string> = {
  slash: 'slash.ogg',
  dodge: 'dodge.ogg',
  sos: 'sos.ogg',
  break: 'break.ogg',
  chains: 'chains.ogg',
  blaze: 'blaze.ogg',
  'hail-of-arrows': 'hail-of-arrows.ogg',
  barbarians: 'barbarians.ogg',
  steal: 'steal.ogg',
  wuxie: 'wuxie.ogg',
  starvation: 'starvation.ogg',
  duel: 'duel.ogg',
  'fire-slash': 'fire_slash.ogg',
  'thunder-slash': 'thunder_slash.ogg',
  coerce: 'coerce.ogg',
  wine: 'wine.ogg',
  harvest: 'harvest.ogg',
  'draw-two': 'draw-two.ogg',
  'peach-garden': 'peach-garden.ogg',
  capture: 'capture.ogg',
  lightning: 'lightning.ogg',
  amass: 'amass.ogg',
  ascertain: 'ascertain.ogg',
  'ally-far-attack-near': 'ally-far-attack-near.ogg',
};
// The card each line belongs to, for the Wiki's play buttons; both genders have a file for each.
export const CARD_VOICES: Partial<Record<string, Voice>> = {
  sha: 'slash',
  shan: 'dodge',
  duel: 'duel',
  'fire-attack': 'fire-slash',
  'lightning-attack': 'thunder-slash',
  break: 'break',
  chains: 'chains',
  blaze: 'blaze',
  'hail-of-arrows': 'hail-of-arrows',
  barbarians: 'barbarians',
  steal: 'steal',
  wuxie: 'wuxie',
  'wuxie-guo': 'wuxie', // Wuxie Kingdom shares Wuxie's voices
  starvation: 'starvation',
  coerce: 'coerce',
  wine: 'wine',
  harvest: 'harvest',
  'draw-two': 'draw-two',
  'peach-garden': 'peach-garden',
  capture: 'capture',
  lightning: 'lightning',
  amass: 'amass',
  ascertain: 'ascertain',
  'ally-far-attack-near': 'ally-far-attack-near',
};
export const voiceUrl = (gender: VoiceGender, voice: Voice): string => `/audio/${gender}/${VOICE_FILES[voice]}`;
// Music sits well under the event sounds so an injury or a heal always stands out.
const MUSIC_VOLUME = 0.2;
const EFFECT_VOLUME = 0.8;
const MUSIC_KEY = 'music-enabled';
const EFFECTS_KEY = 'effects-enabled';

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

  readonly enabled = signal(readEnabled(MUSIC_KEY));
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
    writeEnabled(MUSIC_KEY, next);
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

// Short sound effects (an injury, a heal, equipping), on their own on/off switch,
// separate from the music. Each play gets its own player so quick repeats overlap instead of cutting off.
@Injectable({ providedIn: 'root' })
export class SoundEffects {
  private readonly createPlayer = inject(MUSIC_PLAYER_FACTORY);

  readonly enabled = signal(readEnabled(EFFECTS_KEY));

  toggle(): void {
    const next = !this.enabled();
    this.enabled.set(next);
    writeEnabled(EFFECTS_KEY, next);
  }

  play(effect: SoundEffect): void {
    this.playUrl(EFFECT_URLS[effect]);
  }

  playVoice(gender: VoiceGender, voice: Voice): void {
    this.playUrl(voiceUrl(gender, voice));
  }

  // A voice played on request (the Wiki's buttons): sounds whether or not the
  // sound effects are switched on, since the switch is for the game's own sounds.
  previewVoice(gender: VoiceGender, voice: Voice): void {
    this.playUrl(voiceUrl(gender, voice), true);
  }

  // A General's death voice, as the seat is eliminated.
  playDeathVoice(url: string): void {
    this.playUrl(url);
  }

  // Any recording played on request (the Wiki's General voice), like previewVoice.
  previewUrl(url: string): void {
    this.playUrl(url, true);
  }

  private playUrl(url: string, always = false): void {
    if (!always && !this.enabled()) return;
    const player = this.createPlayer(url);
    player.volume = EFFECT_VOLUME;
    // A browser that refuses (no interaction yet) just misses this one effect.
    Promise.resolve(player.play()).catch(() => undefined);
  }
}

// A per-viewer convenience: storage can be missing or blocked, so fall back to on.
function readEnabled(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'false';
  } catch {
    return true;
  }
}

function writeEnabled(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, String(enabled));
  } catch {
    // Not remembered; the toggle still works for this visit.
  }
}
