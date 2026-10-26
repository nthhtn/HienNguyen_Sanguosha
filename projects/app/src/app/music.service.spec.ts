import { existsSync } from 'fs';
import { join } from 'path';
import { TestBed } from '@angular/core/testing';
import { CARD_VOICES, EFFECT_URLS, MUSIC_PLAYER_FACTORY, MusicPlayer, MusicService, SoundEffects, TRACK_URLS, voiceUrl } from './music.service';

class FakePlayer implements MusicPlayer {
  loop = false;
  volume = 1;
  paused = true;
  refuse = false;
  plays = 0;
  play(): Promise<void> {
    this.plays++;
    if (this.refuse) return Promise.reject(new Error('NotAllowedError'));
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

function setup(stored?: string) {
  localStorage.clear();
  if (stored !== undefined) localStorage.setItem('music-enabled', stored);
  const player = new FakePlayer();
  const urls: string[] = [];
  TestBed.configureTestingModule({
    providers: [{ provide: MUSIC_PLAYER_FACTORY, useValue: (url: string) => (urls.push(url), player) }],
  });
  return { music: TestBed.inject(MusicService), player, urls };
}

const settle = () => new Promise((r) => setTimeout(r));

describe('MusicService', () => {
  afterEach(() => localStorage.clear());

  it('plays the background track on a loop, at a modest volume', async () => {
    const { music, player, urls } = setup();
    music.start();
    await settle();
    expect(urls).toEqual([TRACK_URLS.background]);
    expect(player.loop).toBe(true);
    expect(player.volume).toBeLessThan(0.5);
    expect(player.paused).toBe(false);
    expect(music.playing()).toBe(true);
  });

  it('waits for the first click when the browser refuses to autoplay', async () => {
    const { music, player } = setup();
    player.refuse = true;
    music.start();
    await settle();
    expect(music.playing()).toBe(false);
    player.refuse = false;
    document.dispatchEvent(new Event('pointerdown'));
    await settle();
    expect(music.playing()).toBe(true);
  });

  it('turns off and on, and remembers the choice', async () => {
    const { music, player } = setup();
    music.start();
    await settle();
    music.toggle();
    expect(player.paused).toBe(true);
    expect(music.enabled()).toBe(false);
    expect(localStorage.getItem('music-enabled')).toBe('false');
    music.toggle();
    await settle();
    expect(player.paused).toBe(false);
    expect(localStorage.getItem('music-enabled')).toBe('true');
  });

  it('stays off when switched off while the browser is still starting it', async () => {
    const { music, player } = setup();
    music.start();
    music.toggle();
    await settle();
    expect(player.paused).toBe(true);
    expect(music.playing()).toBe(false);
  });

  it('stays silent on start when the viewer turned it off last time', async () => {
    const { music, player } = setup('false');
    music.start();
    await settle();
    expect(player.plays).toBe(0);
    expect(music.enabled()).toBe(false);
  });

  it('swaps to the win track, played once, and back to the background track', async () => {
    const urls: string[] = [];
    const players: FakePlayer[] = [];
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: MUSIC_PLAYER_FACTORY, useValue: (url: string) => (urls.push(url), players.push(new FakePlayer()), players.at(-1)) }],
    });
    const music = TestBed.inject(MusicService);
    music.start();
    await settle();
    music.setTrack('win');
    await settle();
    expect(urls).toEqual([TRACK_URLS.background, TRACK_URLS.win]);
    expect(players[0].paused).toBe(true);
    expect(players[1].paused).toBe(false);
    expect(players[1].loop).toBe(false);
    expect(players[0].loop).toBe(true);
    music.setTrack('background');
    await settle();
    expect(players[1].paused).toBe(true);
    expect(players[0].paused).toBe(false);
    expect(urls).toHaveLength(2);
  });

  it('stays silent on the win track when the viewer turned music off', async () => {
    const { music, player, urls } = setup('false');
    music.setTrack('win');
    await settle();
    expect(player.plays).toBe(0);
    expect(urls).toEqual([]);
  });
});

describe('SoundEffects', () => {
  afterEach(() => localStorage.clear());

  it('plays the injure and heal sounds, a fresh player each time', () => {
    const { player, urls } = setup();
    TestBed.inject(SoundEffects).play('injure');
    TestBed.inject(SoundEffects).play('heal');
    expect(urls).toEqual([EFFECT_URLS.injure, EFFECT_URLS.heal]);
    expect(player.plays).toBe(2);
  });

  it('plays a voice from the gender’s folder, and not when effects are off', () => {
    const { urls } = setup();
    const effects = TestBed.inject(SoundEffects);
    effects.playVoice('female', 'sos');
    effects.playVoice('male', 'slash');
    expect(urls).toEqual(['/audio/female/sos.ogg', '/audio/male/slash.ogg']);
    effects.toggle();
    effects.playVoice('male', 'dodge');
    expect(urls).toHaveLength(2);
    effects.previewVoice('female', 'dodge');
    expect(urls).toEqual(['/audio/female/sos.ogg', '/audio/male/slash.ogg', '/audio/female/dodge.ogg']);
  });

  it('plays effects louder than the music', async () => {
    const { music, player } = setup();
    music.start();
    await settle();
    const musicVolume = player.volume;
    TestBed.inject(SoundEffects).play('heal');
    expect(player.volume).toBeGreaterThan(musicVolume * 2);
  });

  it('is silent when the viewer turned sound effects off', () => {
    const { player } = setup();
    localStorage.setItem('effects-enabled', 'false');
    TestBed.inject(SoundEffects).play('injure');
    expect(player.plays).toBe(0);
  });

  it('is independent of the music switch', async () => {
    const { music, player } = setup('false');
    TestBed.inject(SoundEffects).play('injure');
    expect(player.plays).toBe(1);
    music.toggle();
    const effects = TestBed.inject(SoundEffects);
    effects.toggle();
    expect(effects.enabled()).toBe(false);
    expect(localStorage.getItem('effects-enabled')).toBe('false');
    expect(music.enabled()).toBe(true);
    const before = player.plays;
    effects.play('heal');
    expect(player.plays).toBe(before);
  });
});

describe('card voices', () => {
  it('Chains, Amass, Ascertain and Ally Far Attack Near have a voice', () => {
    const files = (id: string) => (['male', 'female'] as const).map((g) => CARD_VOICES[id] && voiceUrl(g, CARD_VOICES[id]!));
    expect(files('chains')).toEqual(['/audio/male/chains.ogg', '/audio/female/chains.ogg']);
    expect(files('amass')).toEqual(['/audio/male/amass.ogg', '/audio/female/amass.ogg']);
    expect(files('ascertain')).toEqual(['/audio/male/ascertain.ogg', '/audio/female/ascertain.ogg']);
    expect(files('ally-far-attack-near')).toEqual(['/audio/male/ally-far-attack-near.ogg', '/audio/female/ally-far-attack-near.ogg']);
  });

  it('every card voice has its file for both genders in the content assets', () => {
    for (const voice of Object.values(CARD_VOICES)) {
      for (const gender of ['male', 'female'] as const) {
        expect(existsSync(join(__dirname, '../../../content/assets', voiceUrl(gender, voice!).replace('/audio/', 'audio/')))).toBe(true);
      }
    }
  });
});
