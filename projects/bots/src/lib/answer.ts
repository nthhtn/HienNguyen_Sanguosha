import { answersNeededAgainst } from 'content';
import type { ContentRegistry, GameState, Seat } from 'engine';
import { duelOutlook, exposure, expectedSha, playableSha } from './exposure';
import { handCards } from './helpers';
import { relationOf } from './table';

// Answer or take the hit (spec rules C3, C3a, C4), from the redacted view.

interface Hit { attacker: Seat; amount: number; duel: boolean; answerCard: string }

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
  return { attacker, amount: effect.damage.amount, duel, answerCard };
}


// Rules C3 and C3a: whether the bot answers the pending hit or takes the damage and keeps the card.
export function shouldAnswer(view: GameState, me: Seat, registry: ContentRegistry, danger: (generalId: string) => number): boolean {
  const hit = pendingHit(view, me);
  if (!hit) return true;
  const { attacker, amount, duel, answerCard } = hit;
  // Rule C3 (never a partial answer): checked before the lethal rule. A Sha, Hail of Arrows or Barbarians the
  // bot cannot answer in full (two answers against Matchless) lands whatever it plays, so it plays none.
  if (!duel) {
    const have = answerCard === 'shan' ? handCards(view, me).filter((c) => c.definitionId === 'shan').length : playableSha(view, me, registry);
    if (have < answersNeededAgainst(view, attacker.id, registry, me.id)) return false;
  }
  // Rule C3: always answer a hit that would leave the bot dying.
  if (me.combinedHp - amount <= 0) return true;
  // The hit is taken, so no Shan is spent.
  const { exposed, threatSeats } = exposure(view, me, registry, danger, { shanUsed: 0 });
  // Rule C3: never win a Duel against an ally; take the hit unless exposed.
  if (relationOf(view, me, attacker) === 'truce') return exposed;
  // Rule C3: a Duel against an enemy is fought only when the bot's Sha outlast, or when exposed.
  if (duel) return duelOutlook(view, me, attacker, registry) === 'outlast' || exposed;
  // Rule C3a: a Sha, Hail of Arrows or Barbarians is answered when exposed, or when a spare Shan outnumbers the threats.
  const spare = handCards(view, me).filter((c) => c.definitionId === 'shan').length > threatSeats;
  return exposed || spare;
}

// Rule C4: whether starting a Duel on `target` is worth it. The target answers first, so equal rounds win
// for the bot (duelOutlook with the roles swapped, tie to the bot).
export function duelWorthStarting(view: GameState, me: Seat, target: Seat, registry: ContentRegistry): boolean {
  const mine = Math.floor(playableSha(view, me, registry) / answersNeededAgainst(view, target.id, registry));
  const theirs = Math.floor(expectedSha(view, target, registry) / answersNeededAgainst(view, me.id, registry));
  return theirs <= mine;
}
