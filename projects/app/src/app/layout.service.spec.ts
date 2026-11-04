import { TestBed } from '@angular/core/testing';
import { Layout, layoutFor } from './layout.service';

function resizeTo(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
  TestBed.tick();
}

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
    [1133, 744, 0.46],
    [841, 673, 0.34],
    [852, 393, 0.26],
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
    expect(layout.seatScale(12)).toBeGreaterThanOrEqual(0.5 * 0.46);
    expect(layout.seatScale(2)).toBeLessThanOrEqual(1.3 * 0.46);
  });

  it('leaves the large layout to fit the table by itself', () => {
    resizeTo(1366, 768);
    const layout = TestBed.inject(Layout);
    expect(layout.seatScale(2)).toBe(1);
    expect(layout.seatScale(12)).toBe(1);
  });
});
