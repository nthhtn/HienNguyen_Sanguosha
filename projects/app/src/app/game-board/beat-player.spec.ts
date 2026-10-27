import { playBeats } from './beat-player';

describe('playBeats', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('runs each beat at its time, in order', () => {
    const ran: string[] = [];
    playBeats([
      { at: 500, run: () => ran.push('b') },
      { at: 0, run: () => ran.push('a') },
      { at: 1000, run: () => ran.push('c') },
    ]);
    jest.advanceTimersByTime(0);
    expect(ran).toEqual(['a']);
    jest.advanceTimersByTime(499);
    expect(ran).toEqual(['a']);
    jest.advanceTimersByTime(1);
    expect(ran).toEqual(['a', 'b']);
    jest.advanceTimersByTime(500);
    expect(ran).toEqual(['a', 'b', 'c']);
  });

  it('runs everything at once, in order, under reduced motion', () => {
    const ran: string[] = [];
    playBeats([{ at: 1000, run: () => ran.push('late') }, { at: 0, run: () => ran.push('early') }], { reducedMotion: true });
    expect(ran).toEqual(['early', 'late']);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels the beats that have not run when stopped', () => {
    const ran: string[] = [];
    const playback = playBeats([{ at: 0, run: () => ran.push('a') }, { at: 500, run: () => ran.push('b') }]);
    jest.advanceTimersByTime(0);
    playback.stop();
    jest.advanceTimersByTime(10_000);
    expect(ran).toEqual(['a']);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the order of beats that share a time', () => {
    const ran: string[] = [];
    playBeats([{ at: 300, run: () => ran.push('first') }, { at: 300, run: () => ran.push('second') }, { at: 300, run: () => ran.push('third') }]);
    jest.advanceTimersByTime(300);
    expect(ran).toEqual(['first', 'second', 'third']);
  });
});
