import { TestBed } from '@angular/core/testing';
import { Layout, layoutFor } from './layout.service';
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

  it('does not change which windows can play', () => {
    stubDisplayMode('fullscreen');
    resizeTo(915, 412);
    expect(TestBed.inject(Layout).canPlay()).toBe(false);
  });
});
