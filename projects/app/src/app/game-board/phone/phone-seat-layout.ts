import type { Seat } from 'engine';

// Where the opponents sit on the phone board, and how big everything is. Presentation only.

// A tile narrower than this is slim (shorter labels); none is ever narrower than SLIM_MIN.
export const SLIM_BELOW = 110;
export const SLIM_MIN = 76;

const PAD = 8;
const GAP = 5;
const MAX_TILE_HEIGHT = 110;
const MAX_TOP_WIDTH = 150;
const SIDE_WIDTH = 124;

// Each list in screen order: the columns top to bottom, the top row left to right.
export interface PhoneSeats {
  left: Seat[];
  top: Seat[];
  right: Seat[];
}

export interface PhoneSizes {
  bottomHeight: number;
  tileHeight: number;
  topTileWidth: number;
  sideWidth: number;
  slim: boolean;
}

// Seats in a side column, by table size (the spec's table): none up to 8, then 1, then 2.
function sideCount(opponents: number): number {
  if (opponents <= 7) return 0;
  return opponents === 8 ? 1 : 2;
}

// Turn order runs from the viewer up the right column, along the top from right to left and down the left column,
// so the seats nearest the viewer in turn order sit at the sides. Seats keep their places when eliminated.
export function phoneSeats(seats: Seat[], viewerSeatId: string | null): PhoneSeats {
  const ordered = [...seats].sort((a, b) => a.index - b.index);
  const at = ordered.findIndex((s) => s.id === viewerSeatId);
  const opponents = at < 0 ? ordered : [...ordered.slice(at + 1), ...ordered.slice(0, at)];
  const side = sideCount(opponents.length);
  const right = opponents.slice(0, side).reverse();
  const top = opponents.slice(side, opponents.length - side).reverse();
  const left = opponents.slice(opponents.length - side);
  return { left, top, right };
}

export function phoneSizes(width: number, height: number, seats: PhoneSeats): PhoneSizes {
  const bottomHeight = Math.max(104, Math.min(124, Math.round(height * 0.3)));
  const upper = height - bottomHeight - PAD * 2 - GAP;
  const tileHeight = Math.min(MAX_TILE_HEIGHT, Math.floor((upper - GAP) / 2));
  const topCount = Math.max(1, seats.top.length);
  const sides = seats.left.length > 0 || seats.right.length > 0;
  // With side columns, as wide as a top tile would be if the columns were part of the row; capped at the full width.
  const evenWidth = (width - PAD * 2 - GAP * (topCount + 1)) / (topCount + 2);
  const columnWidth = sides ? Math.floor(evenWidth < SLIM_BELOW ? evenWidth : SIDE_WIDTH) : 0;
  const rowStart = PAD + (sides ? columnWidth + GAP : 0);
  const room = width - rowStart * 2;
  const topTileWidth = Math.floor(Math.min(MAX_TOP_WIDTH, (room - GAP * (topCount - 1)) / topCount));
  const slim = topTileWidth < SLIM_BELOW;
  return { bottomHeight, tileHeight, topTileWidth, sideWidth: sides && slim ? topTileWidth : columnWidth, slim };
}
