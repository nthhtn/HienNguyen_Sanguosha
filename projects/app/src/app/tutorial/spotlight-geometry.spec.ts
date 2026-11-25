import { Box, cardPlacement, holeBlockers, holeBox } from './spotlight-geometry';

const viewport = { width: 1000, height: 800 };
const area = (b: Box) => b.width * b.height;

describe('holeBox', () => {
  it('pads the target on every side', () => {
    expect(holeBox({ left: 100, top: 100, width: 200, height: 50 }, viewport, 10)).toEqual({ left: 90, top: 90, width: 220, height: 70 });
  });

  it('clamps to the viewport, never negative', () => {
    expect(holeBox({ left: 0, top: 0, width: 50, height: 50 }, viewport, 10)).toEqual({ left: 0, top: 0, width: 60, height: 60 });
    expect(holeBox({ left: 900, top: 700, width: 300, height: 300 }, viewport, 10)).toEqual({ left: 890, top: 690, width: 110, height: 110 });
  });
});

describe('holeBlockers', () => {
  it('covers the viewport except the padded target with a top, bottom, left and right box', () => {
    expect(holeBlockers({ left: 100, top: 100, width: 200, height: 50 }, viewport, 10)).toEqual([
      { left: 0, top: 0, width: 1000, height: 90 },
      { left: 0, top: 160, width: 1000, height: 640 },
      { left: 0, top: 90, width: 90, height: 70 },
      { left: 310, top: 90, width: 690, height: 70 },
    ]);
  });

  it('leaves exactly the hole uncovered: the boxes and the hole add up to the viewport', () => {
    const target = { left: 333, top: 217, width: 123, height: 99 };
    const covered = holeBlockers(target, viewport, 8).reduce((sum, b) => sum + area(b), 0);
    expect(covered + area(holeBox(target, viewport, 8))).toBe(viewport.width * viewport.height);
  });

  it('gives zero-size boxes, not negative ones, for a target that touches the viewport edge', () => {
    const boxes = holeBlockers({ left: 0, top: 0, width: 50, height: 50 }, viewport, 10);
    expect(boxes).toEqual([
      { left: 0, top: 0, width: 1000, height: 0 },
      { left: 0, top: 60, width: 1000, height: 740 },
      { left: 0, top: 0, width: 0, height: 60 },
      { left: 60, top: 0, width: 940, height: 60 },
    ]);
  });

  it('clamps a target that runs past the viewport', () => {
    const boxes = holeBlockers({ left: 900, top: 700, width: 300, height: 300 }, viewport, 10);
    expect(boxes.every((b) => b.width >= 0 && b.height >= 0 && b.left + b.width <= 1000 && b.top + b.height <= 800)).toBe(true);
    expect(boxes.reduce((sum, b) => sum + area(b), 0) + 110 * 110).toBe(800_000);
  });

  it('still covers the whole viewport for a target that is not on screen', () => {
    const boxes = holeBlockers({ left: 2000, top: 50, width: 100, height: 100 }, viewport, 10);
    expect(boxes.every((b) => b.width >= 0 && b.height >= 0)).toBe(true);
    expect(boxes.reduce((sum, b) => sum + area(b), 0)).toBe(800_000);
  });
});

describe('cardPlacement', () => {
  const card = { width: 300, height: 150 };

  it('centres the card when there is no target', () => {
    expect(cardPlacement(null, viewport, card)).toEqual({ left: 350, top: 325, side: 'centre' });
  });

  it('puts the card below a target near the top, centred on it', () => {
    expect(cardPlacement({ left: 400, top: 20, width: 200, height: 40 }, viewport, card)).toEqual({ left: 350, top: 72, side: 'below' });
  });

  it('puts the card above a target near the bottom', () => {
    expect(cardPlacement({ left: 400, top: 700, width: 200, height: 60 }, viewport, card)).toEqual({ left: 350, top: 538, side: 'above' });
  });

  it('puts the card beside a target that leaves no room above or below', () => {
    expect(cardPlacement({ left: 100, top: 50, width: 200, height: 700 }, viewport, card)).toEqual({ left: 312, top: 325, side: 'beside' });
  });

  it('puts the card on the left of a tall target at the right edge', () => {
    expect(cardPlacement({ left: 800, top: 50, width: 200, height: 700 }, viewport, card)).toEqual({ left: 488, top: 325, side: 'beside' });
  });

  it('keeps the card inside the viewport when its target sits at the edge', () => {
    const { left } = cardPlacement({ left: 950, top: 20, width: 50, height: 40 }, viewport, card);
    expect(left).toBe(692);
  });

  it('never gives a negative position, even for a card larger than the viewport', () => {
    const placed = cardPlacement({ left: 10, top: 10, width: 20, height: 20 }, { width: 200, height: 100 }, card);
    expect(placed.left).toBeGreaterThanOrEqual(0);
    expect(placed.top).toBeGreaterThanOrEqual(0);
  });
});
