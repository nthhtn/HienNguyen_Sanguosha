import { CardInstance, Effect, EngineEvent, GameState } from 'engine';
import { abilityName, cardDisplayData } from 'content';
import { Force, cardFaceLabel, cardIdDisplayName, forceOf, judgmentReaderName, seatName, targetLabel } from '../labels';

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

// The card a window asks for, by name ("Wuxie Kongjie"), when it names one.
function askedCardName(state: GameState): string {
  const id = state.pendingResponse?.allowedCardIds?.[0];
  return id ? cardName({ definitionId: id }) : 'a card';
}

// The card whose effect the window holds back: the window's own source card,
// else the card its reason names, else the cause of the damage it would deal.
function causeInstanceId(state: GameState): string | undefined {
  const pending = state.pendingResponse;
  if (!pending) return undefined;
  if (pending.sourceCard) return pending.sourceCard.instanceId;
  if (pending.reason?.kind === 'card-effect') return pending.reason.card.physical[0]?.instanceId;
  const effect = pending.outcome ?? pending.context.effect;
  return effect.kind === 'DamageEffect' ? effect.damage.cause?.cardInstanceId : undefined;
}

function lastPlayOf(log: EngineEvent[], instanceId: string): CardPlayed | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i];
    if (event.kind === 'CardPlayedEvent' && event.card.physical.some((c) => c.instanceId === instanceId)) return event;
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
    case 'MoveCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      const owner = state.zones.find((z) => z.id === effect.toZoneId)?.ownerSeatId;
      if (!owner) return 'The effect goes ahead';
      return `${card ? cardName(card) : 'A card'} goes to ${owner === viewerSeatId ? 'you' : name(owner)}`;
    }
    default:
      return 'The effect goes ahead';
  }
}

// Everything the Response window says, read off the (redacted) state and its
// public log. Null when no response is pending.
// `preview` shows a pending effect as it would really land (e.g. after Silver
// Lion's cap); without one, the effect is described as it stands.
export function describeResponse(
  state: GameState,
  viewerSeatId: string,
  preview: (effect: Effect) => Effect | null = (effect) => effect
): ResponseDescription | null {
  const pending = state.pendingResponse;
  if (!pending) return null;
  const name = (seatId: string) => seatName(state.players, seatId);
  // What not answering leads to, as the window shows it.
  const shown = pending.outcome ?? pending.context.effect;

  // The dying round: save the seat, or it is out.
  if (pending.reason?.kind === 'dying') {
    const dyingId = pending.reason.seatId;
    const dying = state.seats.find((s) => s.id === dyingId);
    const hp = dying?.combinedHp ?? 0;
    const self = dyingId === viewerSeatId;
    const needed = 1 - hp;
    // Wine is offered only to the dying seat itself; name it when you hold one.
    const viewerHand = state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === viewerSeatId)?.cards ?? [];
    const canDrink = self && !!pending.allowedCardIds?.includes('wine') && viewerHand.some((c) => c.definitionId === 'wine');
    return {
      source: `${self ? 'You are' : `${name(dyingId)} is`} dying (HP ${hp})`,
      latest: null,
      prompt: `Play a Peach${canDrink ? ' or Wine' : ''} to save ${self ? 'yourself' : name(dyingId)}?${needed > 1 ? ` (needs ${needed} Peaches)` : ''}`,
      outcome: self ? 'You are eliminated' : `${name(dyingId)} is eliminated`,
      outcomeForce: forceOf(dying?.kingdom),
    };
  }

  if (pending.reason?.kind === 'wuxie') {
    const { tool, toolUserSeatId, target } = pending.reason;
    const toolName = cardName({ definitionId: tool.as });
    // A delayed Tool still lying in a judgment area is being judged there.
    const toolCardId = tool.physical[0]?.instanceId;
    const judgedOwner = state.zones.find((z) => z.kind === 'judgment' && z.cards.some((c) => c.instanceId === toolCardId))?.ownerSeatId;
    if (judgedOwner) {
      const you = judgedOwner === viewerSeatId;
      return {
        source: `${you ? 'You are' : `${name(judgedOwner)} is`} about to judge ${toolName}`,
        latest: null,
        prompt: `Play ${askedCardName(state)} to cancel it?`,
        outcome: `${you ? 'You judge' : `${name(judgedOwner)} judges`} ${toolName}`,
        outcomeForce: forceOf(state.seats.find((s) => s.id === judgedOwner)?.kingdom),
      };
    }
    const targetId = target.kind === 'seat' ? target.seatId : undefined;
    const on = !targetId || targetId === toolUserSeatId ? '' : ` on ${targetId === viewerSeatId ? 'you' : name(targetId)}`;
    return {
      source: `${name(toolUserSeatId)} used ${toolName}${on}`,
      latest: null,
      prompt: `Play ${askedCardName(state)} to cancel it?`,
      outcome: `${toolName} takes effect${on}`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === targetId)?.kingdom),
    };
  }

  if (pending.reason?.kind === 'counter-wuxie') {
    const { wuxieSeatId } = pending.reason;
    const counter = askedCardName(state);
    return {
      source: `${name(wuxieSeatId)} played ${counter}`,
      latest: null,
      prompt: `Play ${counter} to cancel it?`,
      outcome: `${name(wuxieSeatId)}'s ${counter} stands`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === wuxieSeatId)?.kingdom),
    };
  }

  if (pending.reason?.kind === 'card-effect' && pending.reason.victimSeatId) {
    const { card, userSeatId, victimSeatId } = pending.reason;
    const holder = pending.respondingSeatId;
    return {
      source: `${name(userSeatId)} used ${cardName({ definitionId: card.as })} on ${holder === viewerSeatId ? 'you' : name(holder)}`,
      latest: null,
      prompt: `Play ${askedCardName(state)} at ${victimSeatId === viewerSeatId ? 'you' : name(victimSeatId)}?`,
      outcome: outcomeOf(preview(shown) ?? shown, viewerSeatId, state),
      outcomeForce: forceOf(state.seats.find((s) => s.id === holder)?.kingdom),
    };
  }

  // Upheaval: play a Sha at the seat this seat picked, or lose 1 HP.
  if (pending.reason?.kind === 'ability' && pending.reason.abilityId === 'upheaval') {
    const { owner, targetSeatId } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    return {
      source: `${name(owner.seatId)} used ${abilityName('upheaval')}`,
      latest: null,
      prompt: `Play a Sha at ${targetSeatId ? (targetSeatId === viewerSeatId ? 'you' : name(targetSeatId)) : 'the seat you picked'}, or lose 1 HP?`,
      outcome: you ? 'You lose 1 HP' : `${name(pending.respondingSeatId)} loses 1 HP`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === pending.respondingSeatId)?.kingdom),
    };
  }

  const causeId = causeInstanceId(state);
  const played = causeId ? lastPlayOf(state.log, causeId) : undefined;

  let source = 'A response is needed';
  let prompt = 'Your turn to respond';
  if (played) {
    const on = played.targets.length > 0 ? ` against ${played.targets.map((t) => targetLabel(t, state.players)).join(', ')}` : '';
    source = `${name(played.seatId)} played ${cardName({ definitionId: played.card.as })}${on}`;
    prompt = `Your turn to respond to ${cardName({ definitionId: played.card.as })}`;
  }

  // The latest answer to that same card, if the window follows one (a Duel's Sha).
  let latest: string | null = null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const event = state.log[i];
    if (event.kind !== 'CardPlayedEvent') continue;
    if (causeId && event.inResponseTo?.cardInstanceId === causeId) {
      latest = `${name(event.seatId)} answered with ${cardName({ definitionId: event.card.as })}`;
    }
    break;
  }

  // An armour's judgment for the responder just before the window (Eight Trigrams on black).
  if (!latest) {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const event = state.log[i];
      if (event.kind === 'CardMovedEvent') continue;
      if (event.kind === 'JudgmentEvent' && event.seatId === pending.respondingSeatId) {
        const whose = event.seatId === viewerSeatId ? 'Your' : `${name(event.seatId)}'s`;
        latest = `${whose} ${judgmentReaderName(event.reader)} judgment: ${cardFaceLabel(event.card)}`;
      }
      break;
    }
  }

  return {
    source,
    latest,
    prompt,
    outcome: outcomeOf(preview(shown) ?? shown, viewerSeatId, state),
    outcomeForce: forceOf(state.seats.find((s) => s.id === affectedSeatOf(shown))?.kingdom),
  };
}

// The table centre's "Waiting on …" line, with what the seat is being asked.
export function waitingLine(state: GameState): string | null {
  const selection = state.pendingSelection;
  if (selection) return `Waiting on ${seatName(state.players, selection.seatId)} to choose`;
  const asking = state.pendingChoice;
  if (asking?.reason.kind === 'ability') {
    return `Waiting on ${seatName(state.players, asking.seatId)}: ${cardName({ definitionId: asking.reason.abilityId })}?`;
  }
  const choice = state.pendingChoice;
  if (choice) return `Waiting on ${seatName(state.players, choice.seatId)} to choose a card`;
  const pending = state.pendingResponse;
  if (!pending) return null;
  const who = `Waiting on ${seatName(state.players, pending.respondingSeatId)}`;
  const reason = pending.reason;
  if (reason?.kind === 'dying') return `${who} to save ${seatName(state.players, reason.seatId)}`;
  if (reason?.kind === 'wuxie' || reason?.kind === 'counter-wuxie') return `${who}: ${askedCardName(state)}?`;
  if (reason?.kind === 'card-effect') return `${who} to answer ${cardName({ definitionId: reason.card.as })}`;
  if (reason?.kind === 'ability' && reason.abilityId === 'upheaval') return `${who} to play a Sha for ${abilityName('upheaval')}`;
  return who;
}

// Whether the Response window should start on No Response rather than the
// first answer: true for Wuxie questions, where answering cancels a Tool
// (possibly the viewer's own), so a hasty click must not do it.
export function startsOnNoResponse(state: GameState): boolean {
  const kind = state.pendingResponse?.reason?.kind;
  return kind === 'wuxie' || kind === 'counter-wuxie';
}
