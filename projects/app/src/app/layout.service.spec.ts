import { TestBed } from '@angular/core/testing';
import { DISPLAY_MODE_OVERRIDE } from './display-mode-override';
import { FEATURE_FLAGS } from './feature-flags';
import { Layout, LayoutKind, layoutFor } from './layout.service';
import { clearDisplayMode, resizeTo, stubDisplayMode } from './layout.testing';

describe('layoutFor', () => {
  it.each([
    [667, 375],
    [852, 393],
    [780, 360],
    [915, 412],
    [882, 344],
    [841, 673],
    [744, 1133],
    [1000, 500],
    [899, 900],
  ])('is phone at %i x %i', (width, height) => {
    expect(layoutFor(width, height)).toBe('phone');
  });

  it.each([
    [1133, 744],
    [1194, 834],
    [900, 600],
    [1279, 800],
  ])('is medium at %i x %i', (width, height) => {
    expect(layoutFor(width, height)).toBe('medium');
  });

  it.each([
    [1280, 800],
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
    [1280, 600],
  ])('is large at %i x %i', (width, height) => {
    expect(layoutFor(width, height)).toBe('large');
  });

  it('is phone when a 1280 px wide window is under 600 px tall', () => {
    expect(layoutFor(1280, 599)).toBe('phone');
  });
});

describe('layoutFor with the phone board', () => {
  it.each([
    [915, 412, 'compact'],
    [780, 360, 'compact'],
    [882, 344, 'compact'],
    [760, 340, 'compact'],
    [759, 400, 'phone'],
    [800, 339, 'phone'],
    [412, 915, 'phone'],
    [1133, 744, 'medium'],
    [1440, 900, 'large'],
  ] as [number, number, LayoutKind][])('%i x %i is %s', (width, height, kind) => {
    expect(layoutFor(width, height, true)).toBe(kind);
  });

  it('keeps 915 x 412 as phone without the phone board', () => {
    expect(layoutFor(915, 412)).toBe('phone');
  });
});

describe('Layout', () => {
  beforeEach(() => resizeTo(1366, 768));
  afterAll(() => resizeTo(1024, 768));

  it('follows the window size and tells portrait from landscape', () => {
    const layout = TestBed.inject(Layout);
    expect(layout.kind()).toBe('large');
    expect(layout.wide()).toBe(true);
    expect(layout.panelAsOverlay()).toBe(false);
    expect(layout.portrait()).toBe(false);
    resizeTo(1133, 744);
    expect(layout.kind()).toBe('medium');
    expect(layout.wide()).toBe(true);
    expect(layout.panelAsOverlay()).toBe(true);
    resizeTo(390, 844);
    expect(layout.kind()).toBe('phone');
    expect(layout.wide()).toBe(false);
    expect(layout.panelAsOverlay()).toBe(true);
    expect(layout.portrait()).toBe(true);
  });

  it('writes the layout to the document so styles can follow it', () => {
    TestBed.inject(Layout);
    TestBed.tick();
    expect(document.documentElement.dataset['layout']).toBe('large');
    resizeTo(852, 393);
    expect(document.documentElement.dataset['layout']).toBe('phone');
  });

  it('keeps only one of the nav drawer and the panel open', () => {
    resizeTo(852, 393);
    const layout = TestBed.inject(Layout);
    layout.openNav();
    expect(layout.navOpen()).toBe(true);
    layout.openPanel();
    expect(layout.navOpen()).toBe(false);
    expect(layout.panelOpen()).toBe(true);
    layout.openNav();
    expect(layout.panelOpen()).toBe(false);
    expect(layout.navOpen()).toBe(true);
    layout.closeNav();
    layout.togglePanel();
    expect(layout.panelOpen()).toBe(true);
    layout.togglePanel();
    expect(layout.panelOpen()).toBe(false);
  });

  it('closes both when the layout changes', () => {
    resizeTo(852, 393);
    const layout = TestBed.inject(Layout);
    layout.openPanel();
    resizeTo(1366, 768);
    expect(layout.panelOpen()).toBe(false);
    resizeTo(852, 393);
    layout.openNav();
    resizeTo(1366, 768);
    expect(layout.navOpen()).toBe(false);
  });
});

describe('Layout seat scale', () => {
  afterAll(() => resizeTo(1024, 768));

  it.each([
    [1366, 768, 1],
    [1133, 744, 0.66],
  ])('is the base size for 4 seats at %i x %i', (width, height, scale) => {
    resizeTo(width, height);
    expect(TestBed.inject(Layout).seatScale(4)).toBeCloseTo(scale);
  });

  it('shrinks as more players join, and grows for fewer, on a phone and on medium', () => {
    resizeTo(1133, 744);
    const layout = TestBed.inject(Layout);
    expect(layout.seatScale(8)).toBeLessThan(layout.seatScale(4));
    expect(layout.seatScale(12)).toBeLessThan(layout.seatScale(8));
    expect(layout.seatScale(2)).toBeGreaterThan(layout.seatScale(4));
    expect(layout.seatScale(12)).toBeGreaterThanOrEqual(0.5 * 0.66);
    expect(layout.seatScale(2)).toBeLessThanOrEqual(1.3 * 0.66);
  });

  it('leaves the large layout to fit the table by itself', () => {
    resizeTo(1366, 768);
    const layout = TestBed.inject(Layout);
    expect(layout.seatScale(2)).toBe(1);
    expect(layout.seatScale(12)).toBe(1);
  });
});

describe('Layout centre scale', () => {
  afterAll(() => resizeTo(1024, 768));

  it('scales the table centre (the action log) with the seats, but less, so its text stays readable', () => {
    resizeTo(1133, 744);
    const layout = TestBed.inject(Layout);
    expect(layout.centreScale(4)).toBeLessThan(1);
    expect(layout.centreScale(4)).toBeGreaterThan(layout.seatScale(4));
    expect(layout.centreScale(8)).toBeLessThan(layout.centreScale(4));
    resizeTo(1366, 768);
    expect(layout.centreScale(4)).toBe(1);
  });
});

describe('Layout play check', () => {
  afterAll(() => resizeTo(1024, 768));

  it.each([
    [1133, 744],
    [1366, 768],
    [900, 600],
  ])('lets a game be played at %i x %i', (width, height) => {
    resizeTo(width, height);
    const layout = TestBed.inject(Layout);
    expect(layout.canPlay()).toBe(true);
    expect(layout.fitsIfTurned()).toBe(false);
  });

  it.each([
    [915, 412],
    [852, 393],
    [667, 375],
    [980, 450],
    [841, 673],
  ])('blocks a game at %i x %i, with nothing to gain by turning it', (width, height) => {
    resizeTo(width, height);
    const layout = TestBed.inject(Layout);
    expect(layout.canPlay()).toBe(false);
    expect(layout.fitsIfTurned()).toBe(false);
  });

  it.each([
    [744, 1133],
    [834, 1194],
    [800, 1280],
  ])('asks a tablet held upright (%i x %i) to turn', (width, height) => {
    resizeTo(width, height);
    const layout = TestBed.inject(Layout);
    expect(layout.canPlay()).toBe(false);
    expect(layout.fitsIfTurned()).toBe(true);
  });
});

describe('Layout display mode', () => {
  beforeEach(() => resizeTo(1366, 768));
  afterEach(() => clearDisplayMode());

  it('is browser, and not installed, when the window has no matchMedia', () => {
    const layout = TestBed.inject(Layout);
    expect(layout.displayMode()).toBe('browser');
    expect(layout.installed()).toBe(false);
  });

  it('is browser, and not installed, in a browser tab', () => {
    stubDisplayMode('browser');
    const layout = TestBed.inject(Layout);
    expect(layout.displayMode()).toBe('browser');
    expect(layout.installed()).toBe(false);
  });

  it.each(['fullscreen', 'standalone'] as const)('is installed in %s mode', (mode) => {
    stubDisplayMode(mode);
    const layout = TestBed.inject(Layout);
    expect(layout.displayMode()).toBe(mode);
    expect(layout.installed()).toBe(true);
  });

  it('follows the mode when it changes while the page is open', () => {
    const display = stubDisplayMode('browser');
    const layout = TestBed.inject(Layout);
    display.set('standalone');
    expect(layout.displayMode()).toBe('standalone');
    expect(layout.installed()).toBe(true);
  });

  it('stops listening when it is destroyed', () => {
    const display = stubDisplayMode('browser');
    TestBed.inject(Layout);
    expect(display.listeners.size).toBeGreaterThan(0);
    TestBed.resetTestingModule();
    expect(display.listeners.size).toBe(0);
  });

  it('reports the window size', () => {
    const layout = TestBed.inject(Layout);
    resizeTo(915, 412);
    expect(layout.size()).toEqual({ width: 915, height: 412 });
  });

  it('does not let a browser tab play on a phone', () => {
    stubDisplayMode('browser');
    resizeTo(915, 412);
    expect(TestBed.inject(Layout).canPlay()).toBe(false);
  });
});

describe('Layout with the phone board', () => {
  function flags(phoneBoard: boolean) {
    TestBed.configureTestingModule({ providers: [{ provide: FEATURE_FLAGS, useValue: { playOffline: true, playbackSettings: true, phoneBoard } }] });
  }
  function at(mode: 'fullscreen' | 'browser', width: number, height: number, phoneBoard = true): Layout {
    flags(phoneBoard);
    stubDisplayMode(mode);
    resizeTo(width, height);
    return TestBed.inject(Layout);
  }
  afterEach(() => {
    clearDisplayMode();
    resizeTo(1024, 768);
  });

  it('gives an installed landscape phone the phone board, which can play', () => {
    const layout = at('fullscreen', 915, 412);
    expect(layout.kind()).toBe('compact');
    expect(layout.canPlay()).toBe(true);
    expect(layout.wide()).toBe(false);
    expect(layout.panelAsOverlay()).toBe(true);
    expect(layout.fitsIfTurned()).toBe(false);
    expect(layout.installWouldHelp()).toBe(false);
    TestBed.tick();
    expect(document.documentElement.dataset['layout']).toBe('compact');
  });

  it('blocks a phone browser tab and says installing would help', () => {
    const layout = at('browser', 915, 412);
    expect(layout.kind()).toBe('phone');
    expect(layout.canPlay()).toBe(false);
    expect(layout.installWouldHelp()).toBe(true);
  });

  it('blocks an upright phone browser tab, with no rotate prompt, and says installing would help', () => {
    const layout = at('browser', 412, 915);
    expect(layout.canPlay()).toBe(false);
    expect(layout.fitsIfTurned()).toBe(false);
    expect(layout.installWouldHelp()).toBe(true);
  });

  it('asks an upright installed phone to turn', () => {
    const layout = at('fullscreen', 412, 915);
    expect(layout.canPlay()).toBe(false);
    expect(layout.fitsIfTurned()).toBe(true);
  });

  it.each(['fullscreen', 'browser'] as const)('asks an upright tablet to turn, %s', (mode) => {
    expect(at(mode, 744, 1133).fitsIfTurned()).toBe(true);
  });

  it('blocks a window under the phone board minimum, installed or not, with no hint', () => {
    const installed = at('fullscreen', 700, 330);
    expect(installed.kind()).toBe('phone');
    expect(installed.fitsIfTurned()).toBe(false);
    clearDisplayMode();
    TestBed.resetTestingModule();
    expect(at('browser', 700, 330).installWouldHelp()).toBe(false);
  });

  it.each(['fullscreen', 'browser'] as const)('leaves a large window as it is, %s', (mode) => {
    const layout = at(mode, 1366, 768);
    expect(layout.kind()).toBe('large');
    expect(layout.installWouldHelp()).toBe(false);
  });

  it('ignores the display mode while the phone board flag is off', () => {
    const layout = at('fullscreen', 915, 412, false);
    expect(layout.kind()).toBe('phone');
    expect(layout.canPlay()).toBe(false);
    expect(layout.installWouldHelp()).toBe(false);
  });
});

describe('Layout with a forced display mode', () => {
  afterEach(() => clearDisplayMode());

  it('uses the forced mode over what the browser says', () => {
    TestBed.configureTestingModule({ providers: [{ provide: DISPLAY_MODE_OVERRIDE, useValue: 'standalone' }] });
    stubDisplayMode('browser');
    const layout = TestBed.inject(Layout);
    expect(layout.displayMode()).toBe('standalone');
    expect(layout.installed()).toBe(true);
  });
});

describe('Layout toolbar on the phone board', () => {
  afterEach(() => resizeTo(1024, 768));

  function compact(): Layout {
    TestBed.configureTestingModule({
      providers: [
        { provide: FEATURE_FLAGS, useValue: { playOffline: true, playbackSettings: true, phoneBoard: true } },
        { provide: DISPLAY_MODE_OVERRIDE, useValue: 'fullscreen' },
      ],
    });
    resizeTo(915, 412);
    return TestBed.inject(Layout);
  }

  it('hides the toolbar only while a phone board is open on the compact layout', () => {
    const layout = compact();
    expect(layout.toolbarHidden()).toBe(false);
    layout.setBoardOpen(true);
    TestBed.tick();
    expect(layout.toolbarHidden()).toBe(true);
    expect(document.documentElement.dataset['board']).toBe('open');
    layout.setBoardOpen(false);
    TestBed.tick();
    expect(layout.toolbarHidden()).toBe(false);
    expect(document.documentElement.dataset['board']).toBeUndefined();
  });

  it('shows the toolbar again when the layout is no longer compact', () => {
    const layout = compact();
    layout.setBoardOpen(true);
    resizeTo(1366, 768);
    expect(layout.toolbarHidden()).toBe(false);
    expect(document.documentElement.dataset['board']).toBeUndefined();
  });
});
