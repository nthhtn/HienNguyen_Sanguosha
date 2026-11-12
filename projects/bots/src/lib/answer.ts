import { answersNeededAgainst } from 'content';
import type { ContentRegistry, GameState, Seat } from 'engine';
import { duelOutlook, exposure, expectedSha, playableSha } from './exposure';
import { relationOf } from './table';

// Answer or take the hit (spec rules C3, C3a, C4), from the redacted view.

interface Hit { attacker: Seat; amount: number; duel: boolean; needed: number; started: boolean }

// The damage the pending window would deal to `me`, when it is a Sha, Duel, Hail of Arrows or Barbarians
// aimed at the bot (answered with a Shan or a Sha); null for any other window.
function pendingHit(view: GameState, me: Seat): Hit | null {
  const pending = view.pendingResponse;
  if (!pending) return null;
  const effect = pending.outcome ?? pending.context.effect;
  if (effect.kind !== 'DamageEffect' || effect.damage.target.kind !== 'seat' || effect.damage.target.seatId !== me.id) return null;
  if (effect.damage.source?.kind !== 'seat') return null;
  const sourceId = effect.damage.source.seatId;
  const attacker = view.seats.find((s) => s.id === sourceId);
  const answerCard = pending.allowedCardIds?.length === 1 ? pending.allowedCardIds[0] : undefined;
  if (!attacker || (answerCard !== 'shan' && answerCard !== 'sha')) return null;
  const duel = pending.sourceCard?.definitionId === 'duel';
  const cardEffect = pending.reason?.kind === 'card-effect' && pending.reason.victimSeatId === undefined;
  if (!duel && !cardEffect) return null;
  // A Sha asks for its answers one window at a time: what is still owed is what the next step says, plus this one.
  // A mass card always asks one.
  const next = pending.onAnswer?.find((e) => e.kind === 'CardStepEffect' && e.step === 'sha-shan');
  const data = next?.kind === 'CardStepEffect' ? (next.data ?? {}) : {};
  const sha = !duel && answerCard === 'shan' && !!next;
  const needed = sha ? Number(data['needed'] ?? 1) - Number(data['provided'] ?? 1) + 1 : 1;
  return { attacker, amount: effect.damage.amount, duel, needed, started: sha && Number(data['provided'] ?? 1) > 1 };
}


// Rules C3 and C3a: whether the bot answers the pending hit or takes the damage and keeps the card. `answers` is how
// many answers it can give in this window: its legal answer cards plus respond-time conversions (Dragon Courage...).
// C3a's skill-window case is not wired: no content skill opens a Shan/Sha window against damage on the bot today
// (Upheaval and Instigate are not damage).
export function shouldAnswer(view: GameState, me: Seat, registry: ContentRegistry, danger: (generalId: string) => number, answers: number): boolean {
  const hit = pendingHit(view, me);
  if (!hit) return true;
  const { attacker, amount, duel, needed, started } = hit;
  // Rule C3 (never a partial answer): checked before the lethal rule. A Sha the bot cannot
  // answer in full (two answers still owed against Matchless) lands whatever it plays, so it plays none.
  if (!duel && answers < needed) return false;
  // Rule C3: a Shan already given against Matchless is not wasted by stopping now.
  if (started) return true;
  // Rule C3: always answer a hit that would leave the bot dying.
  if (me.combinedHp - amount <= 0) return true;
  // The hit is taken, so no Shan is spent.
  const { exposed, threatSeats } = exposure(view, me, registry, danger, { shanUsed: 0 });
  // Rule C3: never win a Duel against an ally; take the hit unless exposed.
  if (relationOf(view, me, attacker) === 'truce') return exposed;
  // Rule C3: a Duel against an enemy is fought only when the bot's Sha outlast, or when exposed.
  if (duel) return duelOutlook(view, me, attacker, registry) === 'outlast' || exposed;
  // Rule C3a: a Sha, Hail of Arrows or Barbarians is answered when exposed, or when a spare Shan outnumbers the threats.
  const spare = answers > threatSeats;
  return exposed || spare;
}

// Rule C4: whether starting a Duel on `target` is worth it. The target answers first, so equal rounds win
// for the bot (duelOutlook with the roles swapped, tie to the bot).
export function duelWorthStarting(view: GameState, me: Seat, target: Seat, registry: ContentRegistry): boolean {
  const mine = Math.floor(playableSha(view, me, registry) / answersNeededAgainst(view, target.id, registry));
  const theirs = Math.floor(expectedSha(view, target, registry) / answersNeededAgainst(view, me.id, registry));
  return theirs <= mine;
}
