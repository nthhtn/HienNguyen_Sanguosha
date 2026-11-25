// The spotlight's shapes, as plain numbers so they can be checked without a browser.
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export type CardSide = 'above' | 'below' | 'beside' | 'centre';

// Space kept between the instruction card and its target, and between the card and the window's edge.
const GAP = 12;
const MARGIN = 8;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

// The target with `padding` around it, clamped to the viewport: what the spotlight leaves uncovered.
export function holeBox(target: Box, viewport: Size, padding: number): Box {
  const left = clamp(target.left - padding, 0, viewport.width);
  const top = clamp(target.top - padding, 0, viewport.height);
  const right = clamp(target.left + target.width + padding, left, viewport.width);
  const bottom = clamp(target.top + target.height + padding, top, viewport.height);
  return { left, top, width: right - left, height: bottom - top };
}

// Four boxes that cover the viewport except the hole. Real elements (not a pointer-events trick), so a click
// anywhere outside the hole lands on a blocker, and a click inside it reaches the control underneath.
export function holeBlockers(target: Box, viewport: Size, padding: number): Box[] {
  const hole = holeBox(target, viewport, padding);
  const right = hole.left + hole.width;
  const bottom = hole.top + hole.height;
  return [
    { left: 0, top: 0, width: viewport.width, height: hole.top },
    { left: 0, top: bottom, width: viewport.width, height: viewport.height - bottom },
    { left: 0, top: hole.top, width: hole.left, height: hole.height },
    { left: right, top: hole.top, width: viewport.width - right, height: hole.height },
  ];
}

// Where the instruction card goes: below the target if it fits, else above, else beside it; centred when there is
// no target. Always inside the viewport.
export function cardPlacement(target: Box | null, viewport: Size, card: Size): { left: number; top: number; side: CardSide } {
  const maxLeft = viewport.width - card.width - MARGIN;
  const maxTop = viewport.height - card.height - MARGIN;
  if (!target) {
    return { left: clamp((viewport.width - card.width) / 2, 0, maxLeft), top: clamp((viewport.height - card.height) / 2, 0, maxTop), side: 'centre' };
  }
  const centredLeft = clamp(target.left + target.width / 2 - card.width / 2, MARGIN, maxLeft);
  const spaceBelow = viewport.height - (target.top + target.height);
  if (spaceBelow >= card.height + GAP + MARGIN) {
    return { left: centredLeft, top: target.top + target.height + GAP, side: 'below' };
  }
  if (target.top >= card.height + GAP + MARGIN) {
    return { left: centredLeft, top: target.top - GAP - card.height, side: 'above' };
  }
  const top = clamp(target.top + target.height / 2 - card.height / 2, MARGIN, maxTop);
  const spaceRight = viewport.width - (target.left + target.width);
  if (spaceRight >= card.width + GAP + MARGIN) return { left: target.left + target.width + GAP, top, side: 'beside' };
  return { left: clamp(target.left - GAP - card.width, MARGIN, maxLeft), top, side: 'beside' };
}
