import type { ContentRegistry, GameState, Seat } from 'engine';
import { isAlly } from './helpers';

// Reading the table: forces, the leading force, each seat's relation to the bot and a seat's danger.
// Pure functions of a GameState: a bot's redacted view, or the full state (the simulator's balance run).

export type Relation = 'self' | 'ally' | 'truce' | 'foe';

// A Kingdom's shown seats, or one Ambitionist. `hp` is their summed combinedHp.
export interface Force {
  key: string;
  seatIds: string[];
  hp: number;
}

const shown = (seat: Seat) => !!seat.generals && (seat.generals.main.revealed || seat.generals.deputy.revealed);

// The force a seat belongs to on the table, or null (a hidden or dead seat belongs to none).
function forceKeyOf(seat: Seat): string | null {
  if (seat.eliminated || !shown(seat)) return null;
  if (seat.allegiance === 'ambitionist') return `ambitionist:${seat.id}`;
  if (seat.allegiance === 'kingdom' && seat.kingdom !== 'hidden') return seat.kingdom;
  return null;
}

// Rule 1: a force is a Kingdom's living, shown seats playing for it; each living Ambitionist is a force of one.
export function forcesOf(view: GameState): Force[] {
  const forces = new Map<string, Force>();
  for (const seat of [...view.seats].sort((a, b) => a.index - b.index)) {
    const key = forceKeyOf(seat);
    if (!key) continue;
    const force = forces.get(key) ?? { key, seatIds: [], hp: 0 };
    force.seatIds.push(seat.id);
    force.hp += seat.combinedHp;
    forces.set(key, force);
  }
  return [...forces.values()];
}

// Rule 2: a force of 2+ seats with strictly more seats than every other force leads, while its HP is
// greater than the highest HP among the forces with the next most seats.
export function leadingForceOf(view: GameState): Force | null {
  const forces = forcesOf(view);
  const most = Math.max(0, ...forces.map((f) => f.seatIds.length));
  const top = forces.filter((f) => f.seatIds.length === most);
  if (most < 2 || top.length !== 1) return null;
  const leader = top[0];
  const others = forces.filter((f) => f !== leader);
  const next = Math.max(0, ...others.map((f) => f.seatIds.length));
  const nextHp = Math.max(0, ...others.filter((f) => f.seatIds.length === next).map((f) => f.hp));
  return leader.hp > nextHp ? leader : null;
}

// The bot's own force: its own seat's Kingdom (a seat sees its own Main General's Kingdom even while
// hidden), or itself when it is an Ambitionist.
function ownForceKey(me: Seat): string | null {
  if (me.allegiance === 'ambitionist') return `ambitionist:${me.id}`;
  return me.kingdom === 'hidden' ? null : me.kingdom;
}

// Rule 3: self; ally (as isAlly); truce with a force that is neither the bot's own nor the leading one
// while another force leads; foe for everything else.
export function relationOf(view: GameState, me: Seat, other: Seat): Relation {
  if (other.id === me.id) return 'self';
  if (isAlly(me, other, view)) return 'ally';
  const leader = leadingForceOf(view);
  const mine = ownForceKey(me);
  const theirs = forceKeyOf(other);
  if (!leader || leader.key === mine || !theirs || theirs === leader.key || theirs === mine) return 'foe';
  return 'truce';
}

// Rule 4: a seat's danger is the summed danger of its revealed Generals; a hidden General counts 0.
// `danger` rates one General (Task 4's generalDanger); `registry` is passed for it.
export function seatDanger(
  _view: GameState, seat: Seat, _registry: ContentRegistry, danger: (generalId: string) => number,
): number {
  if (!seat.generals) return 0;
  const { main, deputy } = seat.generals;
  return [main, deputy].reduce((sum, g) => sum + (g.revealed ? danger(g.generalDefinitionId) : 0), 0);
}

// Rule 4: dangerous at 2 or more.
export function isDangerous(score: number): boolean {
  return score >= 2;
}
