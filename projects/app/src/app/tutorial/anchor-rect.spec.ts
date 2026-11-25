import { anchorBox, effectiveZoom, resetZoomProbe } from './anchor-rect';

function box(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

// jsdom does no layout and no zoom: the specs set the rects and the computed zoom by hand.
describe('anchorBox', () => {
  let zooms: Map<Element, string>;
  let probeWidth: number;
  let rects: Map<Element, DOMRect>;

  beforeEach(() => {
    resetZoomProbe();
    zooms = new Map();
    rects = new Map();
    probeWidth = 10;
    jest.spyOn(window, 'getComputedStyle').mockImplementation((node: Element) => ({ zoom: zooms.get(node) ?? '1' }) as CSSStyleDeclaration);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-zoom-probe')) return box(0, 0, probeWidth, probeWidth);
      return rects.get(this) ?? box(0, 0, 0, 0);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
    resetZoomProbe();
  });

  function zoomed(zoom: string, rect: DOMRect): { outer: HTMLElement; inner: HTMLElement } {
    const outer = document.createElement('div');
    const inner = document.createElement('div');
    outer.appendChild(inner);
    document.body.appendChild(outer);
    zooms.set(outer, zoom);
    rects.set(inner, rect);
    return { outer, inner };
  }

  it('returns the rect as it is when nothing above the element is zoomed', () => {
    const { inner } = zoomed('1', box(20, 30, 100, 50));
    expect(anchorBox(inner)).toEqual({ left: 20, top: 30, width: 100, height: 50 });
  });

  it('turns a rect in zoomed units back into screen units (a browser that reports them zoomed)', () => {
    const { inner } = zoomed('0.5', box(20, 30, 100, 50));
    expect(anchorBox(inner)).toEqual({ left: 10, top: 15, width: 50, height: 25 });
  });

  it('leaves the rect alone in a browser that already reports screen units', () => {
    probeWidth = 20;
    const { inner } = zoomed('0.5', box(20, 30, 100, 50));
    expect(anchorBox(inner)).toEqual({ left: 20, top: 30, width: 100, height: 50 });
  });

  it('leaves an element with no box alone', () => {
    const { inner } = zoomed('0.5', box(0, 0, 0, 0));
    expect(anchorBox(inner)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });

  it('multiplies the zoom of every element above, the element itself included', () => {
    const { outer, inner } = zoomed('0.5', box(0, 0, 10, 10));
    zooms.set(inner, '50%');
    expect(effectiveZoom(inner)).toBeCloseTo(0.25);
    expect(effectiveZoom(outer)).toBeCloseTo(0.5);
  });

  it('treats a zoom it cannot read as 1', () => {
    const { outer, inner } = zoomed('normal', box(0, 0, 10, 10));
    expect(effectiveZoom(inner)).toBe(1);
    zooms.set(outer, '');
    expect(effectiveZoom(inner)).toBe(1);
  });
});
