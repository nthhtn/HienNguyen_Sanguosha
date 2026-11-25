import { Box, scaleBox } from './spotlight-geometry';

// Where an anchor really is on screen. A box the board shrinks with CSS `zoom` (the viewer's own seat does) is reported by
// current browsers in its own zoomed units, so its rect lies below and to the right of what the beginner sees. This
// puts it back on screen coordinates; with no zoom anywhere above it the rect is returned as it is.

let localRects: boolean | null = null;

// Whether this browser reports a zoomed element's rect in the element's own units (Chrome 128 and later do). Asked once,
// of a hidden probe that is twice as big as it claims to be.
export function zoomedRectsAreLocal(doc: Document = document): boolean {
  if (localRects !== null) return localRects;
  const probe = doc.createElement('div');
  probe.setAttribute('data-zoom-probe', '');
  probe.style.cssText = 'position: fixed; left: 0; top: 0; width: 10px; height: 10px; visibility: hidden; pointer-events: none; zoom: 2';
  doc.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  localRects = width > 0 && width < 15;
  return localRects;
}

// For specs, which switch the answer by faking the probe's rect.
export function resetZoomProbe(): void {
  localRects = null;
}

// The zoom of an element and everything above it, multiplied.
export function effectiveZoom(el: Element): number {
  const view = el.ownerDocument.defaultView;
  let zoom = 1;
  for (let node: Element | null = el; node; node = node.parentElement) {
    const value = view?.getComputedStyle(node).zoom ?? '';
    const n = value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value);
    if (Number.isFinite(n) && n > 0) zoom *= n;
  }
  return zoom;
}

export function anchorBox(el: Element): Box {
  const r = el.getBoundingClientRect();
  const box: Box = { left: r.left, top: r.top, width: r.width, height: r.height };
  if (r.width === 0 && r.height === 0) return box;
  const zoom = zoomedRectsAreLocal(el.ownerDocument) ? effectiveZoom(el) : 1;
  return zoom === 1 ? box : scaleBox(box, zoom);
}
