import { TestBed } from '@angular/core/testing';
import { EFFECT_URLS, MUSIC_PLAYER_FACTORY, MusicPlayer, MusicService, SoundEffects, TRACK_URLS } from './music.service';

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

  it('plays effects louder than the music', async () => {
    const { music, player } = setup();
    music.start();
    await settle();
    const musicVolume = player.volume;
    TestBed.inject(SoundEffects).play('heal');
    expect(player.volume).toBeGreaterThan(musicVolume * 2);
  });

  it('is silent when the viewer turned sound off', () => {
    const { player } = setup('false');
    TestBed.inject(SoundEffects).play('injure');
    expect(player.plays).toBe(0);
  });
});
