import type { SceneForce } from './scene/scene-seat';

export interface DistanceExampleSeat {
  n: number;
  general: string;
  force: SceneForce;
  // Knocked out of the game.
  out?: boolean;
  // A Mount this seat wears.
  mount?: 'shadow-runner';
  // The distance from seat 1, worked out by hand from the rules text; distance-example.spec.ts checks it against the game's own calculation.
  distance?: number;
}

// The table drawn on the Distance page. Seat 1 attacks with no Weapon (range 1). Seat 2 is out, which brings Seat 3 next to Seat 1,
// and Seat 6's Shadow Runner pushes it from 1 step away to a distance of 2.
export const DISTANCE_EXAMPLE = {
  range: 1,
  seats: [
    { n: 1, general: 'cao-cao', force: 'Wei' },
    { n: 2, general: 'liu-bei', force: 'Shu', out: true },
    { n: 3, general: 'sun-quan', force: 'Wu', distance: 1 },
    { n: 4, general: 'zhang-jiao', force: 'Qun', distance: 2 },
    { n: 5, general: 'guan-yu', force: 'Shu', distance: 2 },
    { n: 6, general: 'gan-ning', force: 'Wu', mount: 'shadow-runner', distance: 2 },
  ] satisfies DistanceExampleSeat[],
};
