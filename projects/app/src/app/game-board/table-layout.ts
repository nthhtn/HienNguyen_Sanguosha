// Presentation-only geometry for the round table: where each seat's tile sits.
// Coordinates are percentages of the table's bounding box, centre (50, 50).
export const TABLE_RADIUS_X = 42;
export const TABLE_RADIUS_Y = 38;

export interface SeatPlacement<T> {
  seat: T;
  isViewer: boolean;
  x: number;
  y: number;
}

// The viewer always sits at the bottom. The other seats follow in seat order,
// evenly spaced, with the next seat on the viewer's right — turns then travel
// counter-clockwise on screen, as at a physical Sanguosha table.
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
    return {
      seat,
      isViewer: k === 0,
      x: 50 + TABLE_RADIUS_X * Math.cos(angle),
      y: 50 + TABLE_RADIUS_Y * Math.sin(angle),
    };
  });
}
