// Presentation-only geometry for the table: where each seat's tile sits.
// Coordinates are percentages of the table's bounding box, centre (50, 50).
// Seats sit on the rim of a rectangle with these half-widths, unless fitTable
// gives others.
export const TABLE_RADIUS_X = 42;
export const TABLE_RADIUS_Y = 38;

// A seat tile's size at scale 1, in px (seat-tile.ts), rounded up.
export const TILE_WIDTH = 455;
export const TILE_HEIGHT = 270;
// Space kept between tiles, and between a tile and the table's edge, in px.
const EDGE_GAP = 6;
// Room kept between a tile and the table's border, in px: a turn owner's
// highlight ring reaches past its tile, and must not touch the border.
const BORDER_PAD_X = 28;
const BORDER_PAD_Y = 14;
// The least room the centre needs for the current action sequence: a row of
// cards and a couple of lines, in px.
const CENTRE_MIN_WIDTH = 240;
const CENTRE_MIN_HEIGHT = 130;
// Scales tried, largest first.
const SCALE_STEP = 0.01;
const MIN_SCALE = 0.25;

export interface TableFit {
  // Tile scale, at most 1.
  scale: number;
  // Rim half-widths, in percent of the table.
  radiusX: number;
  radiusY: number;
  // The centre's free room, in px: its size, and where its middle is (from the
  // table's top). Horizontally it is always centred on the table.
  centreWidth: number;
  centreHeight: number;
  centreY: number;
}

interface Box { left: number; right: number; top: number; bottom: number }

// The viewer's own seat is not on the table (it sits in the board's corner), so
// it takes no room here. Sizes the other seat tiles to a table of `width` x `height` px: the largest
// scale at which every tile stays inside the table, no two tiles overlap, and
// the centre keeps room for the current action sequence.
export function fitTable(width: number, height: number, seatCount: number): TableFit {
  const seats = Array.from({ length: seatCount }, (_, index) => ({ id: String(index), index }));
  let fit = layoutAt(MIN_SCALE, width, height, seats);
  for (let scale = 1; scale > MIN_SCALE; scale -= SCALE_STEP) {
    const candidate = layoutAt(scale, width, height, seats);
    if (candidate.fits) {
      fit = candidate;
      break;
    }
  }
  return { scale: fit.scale, radiusX: fit.radiusX, radiusY: fit.radiusY, centreWidth: fit.centreWidth, centreHeight: fit.centreHeight, centreY: fit.centreY };
}

function layoutAt(scale: number, width: number, height: number, seats: { id: string; index: number }[]): TableFit & { fits: boolean } {
  const tileW = TILE_WIDTH * scale;
  const tileH = TILE_HEIGHT * scale;
  const radiusX = 50 - ((tileW / 2 + BORDER_PAD_X) / width) * 100;
  const radiusY = 50 - ((tileH / 2 + BORDER_PAD_Y) / height) * 100;
  const boxes: Box[] = seatPlacements(seats, seats[0]?.id ?? '', { radiusX, radiusY }).filter((p) => !p.isViewer).map((p) => {
    const x = (p.x / 100) * width;
    const y = (p.y / 100) * height;
    return { left: x - tileW / 2, right: x + tileW / 2, top: y - tileH / 2, bottom: y + tileH / 2 };
  });
  const cx = width / 2;
  const cy = height / 2;
  // The tiles in the middle column. One that starts below the middle limits the
  // centre from below, any other from above.
  const column = boxes.filter((b) => b.right > cx - CENTRE_MIN_WIDTH / 2 && b.left < cx + CENTRE_MIN_WIDTH / 2);
  // How wide a centre spanning y from `top` to `bottom` can be: up to the nearest tile beside it.
  const widthBetween = (top: number, bottom: number) => {
    const band = boxes.filter((b) => b.bottom > top && b.top < bottom);
    return Math.max(0, 2 * Math.min(cx - EDGE_GAP, ...band.map((b) => (b.left >= cx ? b.left - cx : cx - b.right) - EDGE_GAP)));
  };
  // Two ways to place it. Centred on the table, as tall as the nearest tiles above and below allow; or
  // anchored to all the free felt between the lowest tile above the middle and the table's edge (the
  // viewer's own seat is not on the table, so its half is empty). Whichever gives the larger room wins:
  // anchoring is taller, but can be narrower once side tiles reach down.
  const halfH = Math.min(cy - EDGE_GAP, ...column.map((b) => (b.top >= cy ? b.top - cy : cy - b.bottom) - EDGE_GAP));
  const freeTop = Math.max(EDGE_GAP, ...column.filter((b) => b.top < cy).map((b) => b.bottom + EDGE_GAP));
  const freeBottom = Math.min(height - EDGE_GAP, ...column.filter((b) => b.top >= cy).map((b) => b.top - EDGE_GAP));
  const candidates = [
    { top: cy - halfH, bottom: cy + halfH },
    { top: freeTop, bottom: freeBottom },
  ].map((c) => ({ ...c, w: widthBetween(c.top, c.bottom), h: Math.max(0, c.bottom - c.top) }));
  const roomy = candidates.filter((c) => c.w >= CENTRE_MIN_WIDTH && c.h >= CENTRE_MIN_HEIGHT);
  const best = (roomy.length > 0 ? roomy : candidates).reduce((a, c) => (c.w * c.h > a.w * a.h ? c : a));
  const meet = (a: Box, b: Box) => a.left < b.right + EDGE_GAP && b.left < a.right + EDGE_GAP && a.top < b.bottom + EDGE_GAP && b.top < a.bottom + EDGE_GAP;
  const overlaps = boxes.some((a, i) => boxes.some((b, j) => j > i && meet(a, b)));
  const fits = radiusX > 0 && radiusY > 0 && !overlaps && roomy.length > 0;
  return { scale, radiusX, radiusY, centreWidth: best.w, centreHeight: best.h, centreY: (best.top + best.bottom) / 2, fits };
}

export interface SeatPlacement<T> {
  seat: T;
  isViewer: boolean;
  x: number;
  y: number;
}

// The viewer's slot is at the bottom (callers leave it empty). The other seats follow in seat order,
// at evenly spaced directions from the centre, each pushed out to where that
// direction meets the rectangular rim. The next seat is on the viewer's
// right, so turns travel counter-clockwise on screen, as at a physical table.
export function seatPlacements<T extends { id: string; index: number }>(
  seats: readonly T[],
  viewerSeatId: string,
  radii: { radiusX: number; radiusY: number } = { radiusX: TABLE_RADIUS_X, radiusY: TABLE_RADIUS_Y }
): SeatPlacement<T>[] {
  const ordered = [...seats].sort((a, b) => a.index - b.index);
  const viewerAt = ordered.findIndex((s) => s.id === viewerSeatId);
  if (viewerAt === -1) throw new Error(`Viewer ${viewerSeatId} is not seated at this table`);
  const rotated = [...ordered.slice(viewerAt), ...ordered.slice(0, viewerAt)];
  return rotated.map((seat, k) => {
    const angle = Math.PI / 2 - (k * 2 * Math.PI) / rotated.length;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Distance along this direction to the first rectangle edge it hits.
    const reach = Math.min(
      Math.abs(dx) < 1e-12 ? Infinity : radii.radiusX / Math.abs(dx),
      Math.abs(dy) < 1e-12 ? Infinity : radii.radiusY / Math.abs(dy)
    );
    return { seat, isViewer: k === 0, x: 50 + dx * reach, y: 50 + dy * reach };
  });
}
