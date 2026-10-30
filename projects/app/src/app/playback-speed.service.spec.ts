import { TestBed } from '@angular/core/testing';
import { PlaybackSpeed } from './playback-speed.service';

function reducedMotion(matches: boolean): void {
  (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({ matches: matches && query === '(prefers-reduced-motion: reduce)' });
}

describe('PlaybackSpeed', () => {
  const create = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(PlaybackSpeed);
  };

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to normal', () => {
    const speed = create();
    expect(speed.speed()).toBe('normal');
    expect(speed.factor()).toBe(1);
  });

  it('has a factor for each speed', () => {
    const speed = create();
    const factors = (['slow', 'normal', 'fast', 'instant'] as const).map((id) => {
      speed.set(id);
      return speed.factor();
    });
    expect(factors).toEqual([0.5, 1, 2, Infinity]);
  });

  it('remembers a choice', () => {
    create().set('fast');
    expect(localStorage.getItem('playbackSpeed')).toBe('fast');
    expect(create().speed()).toBe('fast');
  });

  it('falls back when storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const speed = create();
    expect(speed.speed()).toBe('normal');
    speed.set('slow');
    expect(speed.speed()).toBe('slow');
  });

  it('defaults to instant under reduced motion', () => {
    reducedMotion(true);
    expect(create().speed()).toBe('instant');
  });

  it('a stored choice beats reduced motion', () => {
    reducedMotion(true);
    localStorage.setItem('playbackSpeed', 'slow');
    expect(create().speed()).toBe('slow');
  });

  it('ignores a stored value that is not a speed', () => {
    localStorage.setItem('playbackSpeed', 'warp');
    expect(create().speed()).toBe('normal');
  });
});
