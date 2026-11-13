import { DestroyRef, Injectable, inject } from '@angular/core';

interface Sentinel extends EventTarget {
  release(): Promise<void>;
}
interface WakeLockApi {
  request(type: 'screen'): Promise<Sentinel>;
}

// Keeps the screen on while held (Screen Wake Lock): a phone otherwise dims and locks while the player waits for
// their turn, which pauses the page and drops the room socket. The browser lets go when the page is hidden, so it is
// asked again when the page is back. Where there is no Wake Lock, or the browser refuses, nothing happens.
@Injectable({ providedIn: 'root' })
export class ScreenWakeLock {
  private held = false;
  private sentinel: Sentinel | null = null;
  private asking = false;

  constructor() {
    const back = () => {
      if (document.visibilityState === 'visible' && this.held) this.ask();
    };
    document.addEventListener('visibilitychange', back);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', back);
      this.release();
    });
  }

  hold(): void {
    if (this.held) return;
    this.held = true;
    this.ask();
  }

  release(): void {
    this.held = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    sentinel?.release().catch(() => undefined);
  }

  private ask(): void {
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api || this.sentinel || this.asking) return;
    this.asking = true;
    api.request('screen').then(
      (sentinel) => {
        this.asking = false;
        // Released while the browser was answering: let go of it at once.
        if (!this.held) {
          sentinel.release().catch(() => undefined);
          return;
        }
        this.sentinel = sentinel;
        sentinel.addEventListener('release', () => {
          if (this.sentinel === sentinel) this.sentinel = null;
        });
      },
      () => {
        this.asking = false;
      }
    );
  }
}
