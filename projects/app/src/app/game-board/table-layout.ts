// Presentation-only geometry for the table: where each seat's tile sits.
// Coordinates are percentages of the table's bounding box, centre (50, 50).
// Seats sit on the rim of a rectangle with these half-widths.
export const TABLE_RADIUS_X = 42;
export const TABLE_RADIUS_Y = 38;

export interface SeatPlacement<T> {
  seat: T;
  isViewer: boolean;
  x: number;
  y: number;
}

// The viewer always sits at the bottom. The other seats follow in seat order,
// at evenly spaced directions from the centre, each pushed out to where that
// direction meets the rectangular rim. The next seat is on the viewer's
// right, so turns travel counter-clockwise on screen, as at a physical table.
export function seatPlacements<T extends { id: string; index: number }>(
  seats: readonly T[],
  viewerSeatId: string
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
      Math.abs(dx) < 1e-12 ? Infinity : TABLE_RADIUS_X / Math.abs(dx),
      Math.abs(dy) < 1e-12 ? Infinity : TABLE_RADIUS_Y / Math.abs(dy)
    );
    return { seat, isViewer: k === 0, x: 50 + dx * reach, y: 50 + dy * reach };
  });
}
