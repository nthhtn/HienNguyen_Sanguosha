import type { ContentRegistry, GameState, Seat } from 'engine';
import { dangerOf } from './danger';
import { HOLD_FIRE, RankerFactory, TargetRanker } from './helpers';
import { isDangerous, leadingForceOf, relationOf, seatDanger } from './table';
import { hostileActs } from './targeting';

// Rule 6: whom to attack, reading the table. Higher is better; HOLD_FIRE = never attack.
export const TABLE_WEIGHTS = {
  leader: 1000, // a seat of the leading force
  kill: 500, // the hit would take the target to 0 HP
  perDanger: 20, // per point of the seat's danger (rule 4)
  threat: 30, // per hostile act aimed at the bot or an ally...
  threatCap: 3, // ...counting up to this many
  perHp: -10,
  seatOrder: -0.01, // the tiebreak
} as const;

// Damage is taken as 1: a Sha or Duel.
const DAMAGE = 1;
// A truce partner below this HP is never attacked.
const TRUCE_FIRE_HP = 3;

// Rule 6. A truce partner is HOLD_FIRE unless it has 3 HP or more and is dangerous; it then ranks below every
// leading-force seat: its score is capped just under the lowest leading-force score on the table, whatever the
// weights or the General value table make the scores. Allies and the bot itself are filtered out by the callers.
export function tableRankFor(registry: ContentRegistry): TargetRanker {
  const danger = dangerOf(registry);
  const w = TABLE_WEIGHTS;
  // A seat's score from its own numbers; `leading` is whether it belongs to the leading force.
  const scoreOf = (view: GameState, me: Seat, target: Seat, targetDanger: number, leading: boolean): number => {
    let score = target.combinedHp * w.perHp + target.index * w.seatOrder;
    if (leading) score += w.leader;
    if (target.combinedHp <= DAMAGE) score += w.kill;
    score += targetDanger * w.perDanger;
    score += Math.min(hostileActs(view, me, target), w.threatCap) * w.threat;
    return score;
  };
  const dangerAt = (view: GameState, seat: Seat) => seatDanger(view, seat, registry, danger);
  return (view, me, target) => {
    const targetDanger = dangerAt(view, target);
    const leader = leadingForceOf(view);
    if (relationOf(view, me, target) !== 'truce') return scoreOf(view, me, target, targetDanger, !!leader?.seatIds.includes(target.id));
    if (!(target.combinedHp >= TRUCE_FIRE_HP && isDangerous(targetDanger))) return HOLD_FIRE;
    // A truce exists only while a leader does.
    const leaderSeats = view.seats.filter((s) => leader?.seatIds.includes(s.id));
    const lowestLeader = Math.min(...leaderSeats.map((s) => scoreOf(view, me, s, dangerAt(view, s), true)));
    return Math.min(scoreOf(view, me, target, targetDanger, false), lowestLeader - 1);
  };
}

// The Part 2 challenger's ranker, built per decision from the registry the policy is given.
export const tableRank: RankerFactory = { forRegistry: tableRankFor };
