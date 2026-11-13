import { TestBed } from '@angular/core/testing';

// Test helpers for `Layout`: a window size, and a display mode (jsdom has no `matchMedia`).

// Sets the window size only: for a spec that configures TestBed afterwards.
export function setWindowSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

export function resizeTo(width: number, height: number): void {
  setWindowSize(width, height);
  window.dispatchEvent(new Event('resize'));
  TestBed.tick();
}

export type StubbedDisplayMode = 'fullscreen' | 'standalone' | 'browser';

// Gives the window a `matchMedia` that answers `(display-mode: …)` queries, before `Layout` is created. `set` changes
// the mode later and tells the listeners; `listeners` shows who still listens. `clearDisplayMode` takes it away again.
export function stubDisplayMode(initial: StubbedDisplayMode) {
  let mode = initial;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return query === `(display-mode: ${mode})`;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }),
  });
  return {
    set(next: StubbedDisplayMode) {
      mode = next;
      listeners.forEach((fn) => fn());
      TestBed.tick();
    },
    listeners,
  };
}

export function clearDisplayMode(): void {
  delete (window as { matchMedia?: unknown }).matchMedia;
}
