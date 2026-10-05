import { TestBed } from '@angular/core/testing';
import { MAIN_THEME_URL, MUSIC_PLAYER_FACTORY, MusicPlayer, MusicService } from './music.service';

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

  it('plays the main theme on a loop, at a modest volume', async () => {
    const { music, player, urls } = setup();
    music.start();
    await settle();
    expect(urls).toEqual([MAIN_THEME_URL]);
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
});
