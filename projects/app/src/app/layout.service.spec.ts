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
    [1280, 800],
    [1366, 768],
    [1920, 1080],
    [900, 600],
  ])('is wide at %i x %i', (width, height) => {
    expect(layoutFor(width, height)).toBe('wide');
  });
});

describe('Layout', () => {
  beforeEach(() => resizeTo(1366, 768));
  afterAll(() => resizeTo(1024, 768));

  it('follows the window size and tells portrait from landscape', () => {
    const layout = TestBed.inject(Layout);
    expect(layout.kind()).toBe('wide');
    expect(layout.wide()).toBe(true);
    expect(layout.portrait()).toBe(false);
    resizeTo(390, 844);
    expect(layout.kind()).toBe('phone');
    expect(layout.wide()).toBe(false);
    expect(layout.portrait()).toBe(true);
  });

  it('writes the layout to the document so styles can follow it', () => {
    TestBed.inject(Layout);
    TestBed.tick();
    expect(document.documentElement.dataset['layout']).toBe('wide');
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
