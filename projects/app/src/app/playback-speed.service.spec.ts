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

  it('has a factor for each speed', () => {
    const speed = create();
    const factors = (['slow', 'normal', 'fast', 'instant'] as const).map((id) => {
      speed.set(id);
      return speed.factor();
    });
    expect(factors).toEqual([0.5, 1, 2, Infinity]);
  });

  it('starts at Slow whatever was stored or the viewer prefers (the setting is hidden for now)', () => {
    localStorage.setItem('playbackSpeed', 'instant');
    reducedMotion(true);
    const speed = create();
    expect(speed.speed()).toBe('slow');
    expect(speed.factor()).toBe(0.5);
  });
});
