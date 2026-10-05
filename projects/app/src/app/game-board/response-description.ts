import { CardInstance, Effect, EngineEvent, GameState } from 'engine';
import { cardDisplayData } from 'content';
import { Force, cardIdDisplayName, forceOf, seatName, targetLabel } from '../labels';

export interface ResponseDescription {
  // What started it, e.g. "Seat 1 played Duel against Hing".
  source: string;
  // What has happened since, e.g. "Seat 1 answered with Sha" (Duel's back-and-forth).
  latest: string | null;
  // What is asked of the viewer, e.g. "Your turn to respond to Duel".
  prompt: string;
  // What happens on No Response, e.g. "You lose 1 HP (1 damage from Seat 1)".
  outcome: string;
  // The force colour of the player that outcome befalls.
  outcomeForce: Force;
}

type CardPlayed = Extract<EngineEvent, { kind: 'CardPlayedEvent' }>;

function cardName(card: Pick<CardInstance, 'definitionId'>): string {
  return cardDisplayData(card.definitionId)?.name ?? cardIdDisplayName(card.definitionId);
}

// The card whose effect the window holds back: the window's own source card,
// else the cause of the damage it would deal.
function causeInstanceId(state: GameState): string | undefined {
  const pending = state.pendingResponse;
  if (!pending) return undefined;
  if (pending.sourceCard) return pending.sourceCard.instanceId;
  const effect = pending.context.effect;
  return effect.kind === 'DamageEffect' ? effect.damage.cause?.cardInstanceId : undefined;
}

function lastPlayOf(log: EngineEvent[], instanceId: string): CardPlayed | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i];
    if (event.kind === 'CardPlayedEvent' && event.card.instanceId === instanceId) return event;
  }
  return undefined;
}

// The seat a held-back effect would befall.
function affectedSeatOf(effect: Effect): string | undefined {
  if (effect.kind === 'DamageEffect') return effect.damage.target.seatId;
  if (effect.kind === 'HealEffect') return effect.target.seatId;
  if (effect.kind === 'DrawCardsEffect') return effect.seatId;
  return undefined;
}

function outcomeOf(effect: Effect, viewerSeatId: string, state: GameState): string {
  const name = (seatId: string) => seatName(state.players, seatId);
  switch (effect.kind) {
    case 'DamageEffect': {
      const { target, amount, source, nature } = effect.damage;
      const kind = nature === 'normal' ? 'damage' : `${nature} damage`;
      const from = source ? ` from ${targetLabel(source, state.players)}` : '';
      const who = target.kind === 'seat' && target.seatId === viewerSeatId ? 'You lose' : `${targetLabel(target, state.players)} loses`;
      return `${who} ${amount} HP (${amount} ${kind}${from})`;
    }
    case 'HealEffect':
      return `${targetLabel(effect.target, state.players)} recovers ${effect.amount} HP`;
    case 'DrawCardsEffect':
      return `${name(effect.seatId)} draws ${effect.count} ${effect.count === 1 ? 'card' : 'cards'}`;
    default:
      return 'The effect goes ahead';
  }
}

// Everything the Response window says, read off the (redacted) state and its
// public log. Null when no response is pending.
export function describeResponse(state: GameState, viewerSeatId: string): ResponseDescription | null {
  const pending = state.pendingResponse;
  if (!pending) return null;
  const name = (seatId: string) => seatName(state.players, seatId);

  // The dying round: save the seat, or it is out.
  if (pending.reason?.kind === 'dying') {
    const dyingId = pending.reason.seatId;
    const dying = state.seats.find((s) => s.id === dyingId);
    const hp = dying?.combinedHp ?? 0;
    const self = dyingId === viewerSeatId;
    const needed = 1 - hp;
    return {
      source: `${self ? 'You are' : `${name(dyingId)} is`} dying (HP ${hp})`,
      latest: null,
      prompt: `Play a Peach to save ${self ? 'yourself' : name(dyingId)}?${needed > 1 ? ` (needs ${needed} Peaches)` : ''}`,
      outcome: self ? 'You are eliminated' : `${name(dyingId)} is eliminated`,
      outcomeForce: forceOf(dying?.kingdom),
    };
  }

  const causeId = causeInstanceId(state);
  const played = causeId ? lastPlayOf(state.log, causeId) : undefined;

  let source = 'A response is needed';
  let prompt = 'Your turn to respond';
  if (played) {
    const on = played.targets.length > 0 ? ` against ${played.targets.map((t) => targetLabel(t, state.players)).join(', ')}` : '';
    source = `${name(played.seatId)} played ${cardName(played.card)}${on}`;
    prompt = `Your turn to respond to ${cardName(played.card)}`;
  }

  // The latest answer to that same card, if the window follows one (a Duel's Sha).
  let latest: string | null = null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const event = state.log[i];
    if (event.kind !== 'CardPlayedEvent') continue;
    if (causeId && event.inResponseTo?.cardInstanceId === causeId) {
      latest = `${name(event.seatId)} answered with ${cardName(event.card)}`;
    }
    break;
  }

  return {
    source,
    latest,
    prompt,
    outcome: outcomeOf(pending.context.effect, viewerSeatId, state),
    outcomeForce: forceOf(state.seats.find((s) => s.id === affectedSeatOf(pending.context.effect))?.kingdom),
  };
}
