import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DISPLAY_MODE_OVERRIDE } from './display-mode-override';
import { FEATURE_FLAGS } from './feature-flags';

// The wide layouts need room in both directions: a short window (a phone on its side) gets the phone layout however wide it is.
// Medium (900 to 1279 px wide) has the full navigation bar but folds the board's two history tiles into a panel, so the hand
// keeps the width; large (1280 px and up) keeps the tiles, as the board always had.
export const WIDE_MIN_WIDTH = 900;
export const WIDE_MIN_HEIGHT = 600;
export const LARGE_MIN_WIDTH = 1280;
// The installed app on a phone held sideways gets its own board down to this size.
export const PHONE_BOARD_MIN_WIDTH = 760;
export const PHONE_BOARD_MIN_HEIGHT = 340;

// 'phone' means too small to play. 'compact' is the phone board: the installed app, landscape, under medium.
export type LayoutKind = 'phone' | 'compact' | 'medium' | 'large';

// How the page is shown: in the installed app, full screen or standalone (it keeps the status bar), or in a browser tab.
export type DisplayMode = 'fullscreen' | 'standalone' | 'browser';
const INSTALLED_MODES = ['fullscreen', 'standalone'] as const;

// Full screen first: a window can match both. A window with no `matchMedia` (a test's jsdom) is a browser tab.
function readDisplayMode(): DisplayMode {
  if (typeof window.matchMedia !== 'function') return 'browser';
  return INSTALLED_MODES.find((mode) => window.matchMedia(`(display-mode: ${mode})`).matches) ?? 'browser';
}

// `phoneBoard`: the page is the installed app and the phone board is turned on.
export function layoutFor(width: number, height: number, phoneBoard = false): LayoutKind {
  if (width >= WIDE_MIN_WIDTH && height >= WIDE_MIN_HEIGHT) return width >= LARGE_MIN_WIDTH ? 'large' : 'medium';
  if (phoneBoard && width >= height && width >= PHONE_BOARD_MIN_WIDTH && height >= PHONE_BOARD_MIN_HEIGHT) return 'compact';
  return 'phone';
}

// The one place that decides phone, medium or large. Styles follow the `data-layout`
// attribute it keeps on <html> (`:host-context([data-layout='phone'])`); code
// reads `kind`. Also holds which overlay is open, so the navigation drawer and
// the board's History panel are never open together.
@Injectable({ providedIn: 'root' })
export class Layout {
  private readonly width = signal(window.innerWidth);
  private readonly height = signal(window.innerHeight);
  private readonly _navOpen = signal(false);
  private readonly _panelOpen = signal(false);

  private readonly flags = inject(FEATURE_FLAGS);
  private readonly forcedMode = inject(DISPLAY_MODE_OVERRIDE);
  private readonly _displayMode = signal<DisplayMode>(readDisplayMode());
  // The browser's answer, unless dev forced one (`?display=`).
  readonly displayMode = computed(() => this.forcedMode ?? this._displayMode());
  // Running as the installed app.
  readonly installed = computed(() => this.displayMode() !== 'browser');
  // The phone board may be used: the installed app, with the board turned on.
  readonly phoneBoardAllowed = computed(() => this.flags.phoneBoard && this.installed());

  readonly kind = computed(() => layoutFor(this.width(), this.height(), this.phoneBoardAllowed()));
  // Medium and large: room for the full navigation bar. The phone board keeps the menu drawer.
  readonly wide = computed(() => this.kind() === 'medium' || this.kind() === 'large');
  // A game can be played in a medium or large window, or on the phone board; 'phone' means too small to play (a
  // window size decides, so "desktop site" mode on a phone and a small desktop window are blocked as well).
  readonly canPlay = computed(() => this.kind() !== 'phone');
  // Too small as it is, but playable turned sideways: a tablet held upright, or the installed app on an upright phone.
  readonly fitsIfTurned = computed(() => !this.canPlay() && layoutFor(this.height(), this.width(), this.phoneBoardAllowed()) !== 'phone');
  // A browser tab too small to play that the installed app could play on, held as it is or turned: the install hint.
  readonly installWouldHelp = computed(
    () =>
      this.flags.phoneBoard &&
      !this.installed() &&
      !this.canPlay() &&
      (layoutFor(this.width(), this.height(), true) !== 'phone' || layoutFor(this.height(), this.width(), true) !== 'phone')
  );
  // The History panel slides over the board (phone and medium); on large the board keeps its two tiles.
  readonly panelAsOverlay = computed(() => this.kind() !== 'large');
  // How big seat tiles are drawn, relative to full size: the viewer's own seat and the others share it, so a small
  // screen has small seats all round.
  // The base is for four players; more players, smaller seats, and fewer, larger (by (4 / n) ^ 0.7, between half
  // and 1.3 times the base). The large layout fits the table by itself.
  private readonly seatBase = computed(() => (this.kind() === 'large' ? 1 : 0.66));
  seatScale(seatCount: number): number {
    const base = this.seatBase();
    if (this.kind() === 'large') return base;
    return base * Math.min(1.3, Math.max(0.5, Math.pow(4 / Math.max(1, seatCount), 0.7)));
  }
  // The table centre's action log is scaled along with the seats, half as much (a seat at 0.3 is a picture, text at 0.3
  // is unreadable).
  centreScale(seatCount: number): number {
    return this.kind() === 'large' ? 1 : 0.5 + 0.5 * this.seatScale(seatCount);
  }
  readonly portrait = computed(() => this.height() > this.width());
  readonly size = computed(() => ({ width: this.width(), height: this.height() }));
  readonly navOpen = this._navOpen.asReadonly();
  readonly panelOpen = this._panelOpen.asReadonly();

  constructor() {
    const update = () => {
      this.width.set(window.innerWidth);
      this.height.set(window.innerHeight);
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    // Chrome can move an open page into the installed app's window, so the mode is followed, not read once.
    const modeQueries = typeof window.matchMedia === 'function' ? INSTALLED_MODES.map((mode) => window.matchMedia(`(display-mode: ${mode})`)) : [];
    const updateMode = () => this._displayMode.set(readDisplayMode());
    modeQueries.forEach((query) => query.addEventListener('change', updateMode));
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      modeQueries.forEach((query) => query.removeEventListener('change', updateMode));
    });
    effect(() => {
      document.documentElement.dataset['layout'] = this.kind();
    });
    // Turning the device, or folding it, starts from a clean screen.
    effect(() => {
      this.kind();
      untracked(() => {
        this._navOpen.set(false);
        this._panelOpen.set(false);
      });
    });
  }

  openNav(): void {
    this._panelOpen.set(false);
    this._navOpen.set(true);
  }

  closeNav(): void {
    this._navOpen.set(false);
  }

  openPanel(): void {
    this._navOpen.set(false);
    this._panelOpen.set(true);
  }

  closePanel(): void {
    this._panelOpen.set(false);
  }

  togglePanel(): void {
    if (this._panelOpen()) this.closePanel();
    else this.openPanel();
  }
}
