import { TestBed } from '@angular/core/testing';
import { ScreenWakeLock } from './screen-wake-lock.service';

class FakeSentinel extends EventTarget {
  released = false;
  async release(): Promise<void> {
    this.released = true;
  }
  // The browser lets go by itself (the page was hidden).
  dropByBrowser(): void {
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

describe('ScreenWakeLock', () => {
  let sentinels: FakeSentinel[];
  let request: jest.Mock;

  function giveWakeLock(impl?: () => Promise<FakeSentinel>): void {
    request = jest.fn(
      impl ??
        (async () => {
          const sentinel = new FakeSentinel();
          sentinels.push(sentinel);
          return sentinel;
        })
    );
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
  }
  const becomes = (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
    document.dispatchEvent(new Event('visibilitychange'));
  };
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    sentinels = [];
    giveWakeLock();
  });
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });

  it('asks for the screen once, however often it is held', async () => {
    const lock = TestBed.inject(ScreenWakeLock);
    lock.hold();
    lock.hold();
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('lets go when released, and asks again when held again', async () => {
    const lock = TestBed.inject(ScreenWakeLock);
    lock.hold();
    await settle();
    lock.release();
    expect(sentinels[0].released).toBe(true);
    lock.hold();
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('asks again when the page comes back after the browser let go', async () => {
    const lock = TestBed.inject(ScreenWakeLock);
    lock.hold();
    await settle();
    becomes('hidden');
    sentinels[0].dropByBrowser();
    becomes('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('asks for nothing when the page comes back while not held', async () => {
    TestBed.inject(ScreenWakeLock);
    becomes('visible');
    await settle();
    expect(request).not.toHaveBeenCalled();
  });

  it('lets go of a lock that arrives after it was released', async () => {
    const lock = TestBed.inject(ScreenWakeLock);
    lock.hold();
    lock.release();
    await settle();
    expect(sentinels[0].released).toBe(true);
  });

  it('does nothing where the browser has no Wake Lock', () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    const lock = TestBed.inject(ScreenWakeLock);
    expect(() => {
      lock.hold();
      lock.release();
    }).not.toThrow();
  });

  it('stays quiet when the browser refuses', async () => {
    giveWakeLock(() => Promise.reject(new DOMException('denied', 'NotAllowedError')));
    const lock = TestBed.inject(ScreenWakeLock);
    lock.hold();
    await settle();
    lock.release();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('lets go when it is destroyed', async () => {
    const lock = TestBed.inject(ScreenWakeLock);
    lock.hold();
    await settle();
    TestBed.resetTestingModule();
    expect(sentinels[0].released).toBe(true);
  });
});
