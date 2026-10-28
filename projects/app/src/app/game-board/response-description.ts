import { CardInstance, Effect, EngineEvent, GameState } from 'engine';
import { baseSkillId, cardDisplayData } from 'content';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';
import { abilityDisplayName, cardFaceLabel, cardIdDisplayName, Force, seatForce, judgmentReaderName, seatName, shownCardId, targetLabel } from '../labels';

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
  // The No Response option's own wording, when the window has one (Instigate's Pass).
  passLabel?: string;
}

type CardPlayed = Extract<EngineEvent, { kind: 'CardPlayedEvent' }>;

function cardName(card: Pick<CardInstance, 'definitionId'>, tr: Translator): string {
  return cardDisplayData(card.definitionId, localeOf(tr))?.name ?? cardIdDisplayName(card.definitionId, tr);
}

// The card a window asks for, by name ("Wuxie Kongjie"), when it names one. When
// the viewer is the seat asked and holds one of the allowed cards, that card
// is the one named (a seat with only Wuxie Kingdom is asked for it, not for Wuxie).
function askedCardName(state: GameState, tr: Translator, viewerSeatId?: string): string {
  const pending = state.pendingResponse;
  const allowed = pending?.allowedCardIds;
  if (!allowed?.length) return tr('response.anyCard');
  const hand = viewerSeatId && viewerSeatId === pending?.respondingSeatId ? (state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === viewerSeatId)?.cards ?? []) : [];
  return cardName({ definitionId: allowed.find((id) => hand.some((c) => c.definitionId === id)) ?? allowed[0] }, tr);
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

// The last card `seatId` answered a window with.
function lastAnswerBy(log: EngineEvent[], seatId: string): CardPlayed | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i];
    if (event.kind === 'CardPlayedEvent' && event.seatId === seatId && event.inResponseTo) return event;
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

function outcomeOf(effect: Effect, viewerSeatId: string, state: GameState, tr: Translator): string {
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  switch (effect.kind) {
    case 'DamageEffect': {
      const { target, amount, source, nature } = effect.damage;
      const kind = nature === 'normal' ? tr('response.damage') : tr('response.natureDamage', { nature: tr(nature === 'fire' ? 'damage.nature.fire' : 'damage.nature.thunder') });
      const detail = source
        ? tr('response.damageDetailFrom', { amount, kind, source: targetLabel(source, state.players, tr) })
        : tr('response.damageDetail', { amount, kind });
      return target.kind === 'seat' && target.seatId === viewerSeatId
        ? tr('response.outcome.youLose', { amount, detail })
        : tr('response.outcome.loses', { who: targetLabel(target, state.players, tr), amount, detail });
    }
    case 'HealEffect':
      return tr('response.outcome.recovers', { target: targetLabel(effect.target, state.players, tr), amount: effect.amount });
    case 'DrawCardsEffect':
      return tr(effect.count === 1 ? 'response.outcome.draws.one' : 'response.outcome.draws.other', { seat: name(effect.seatId), count: effect.count });
    case 'MoveCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      const owner = state.zones.find((z) => z.id === effect.toZoneId)?.ownerSeatId;
      if (!owner) return tr('response.outcome.goesAhead');
      return tr('response.outcome.cardGoesTo', {
        card: card ? cardName(card, tr) : tr('response.aCard'),
        to: owner === viewerSeatId ? tr('response.you') : name(owner),
      });
    }
    default:
      return tr('response.outcome.goesAhead');
  }
}

// Everything the Response window says, read off the (redacted) state and its
// public log. Null when no response is pending.
// `preview` shows a pending effect as it would really land (e.g. after Silver
// Lion's cap); without one, the effect is described as it stands.
export function describeResponse(
  state: GameState,
  viewerSeatId: string,
  preview: (effect: Effect) => Effect | null = (effect) => effect,
  tr: Translator = englishTranslator
): ResponseDescription | null {
  const pending = state.pendingResponse;
  if (!pending) return null;
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  // A seat as a target of a sentence: "you" for the viewer, else its name.
  const whom = (seatId: string) => (seatId === viewerSeatId ? tr('response.you') : name(seatId));
  // The card names the sentences mention.
  const sha = cardName({ definitionId: 'sha' }, tr);
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
    const peach = cardName({ definitionId: 'peach' }, tr);
    const who = self ? tr('response.yourself') : name(dyingId);
    const ask = canDrink
      ? tr('response.dying.promptWine', { peach, wine: cardName({ definitionId: 'wine' }, tr), who })
      : tr('response.dying.prompt', { peach, who });
    return {
      source: self ? tr('response.dying.you', { hp }) : tr('response.dying.other', { seat: name(dyingId), hp }),
      latest: null,
      prompt: ask + (needed > 1 ? tr('response.dying.needs', { n: needed, peaches: tr('response.peaches', { peach }) }) : ''),
      outcome: self ? tr('response.eliminated.you') : tr('response.eliminated.other', { seat: name(dyingId) }),
      outcomeForce: seatForce(dying),
    };
  }

  if (pending.reason?.kind === 'wuxie') {
    const { tool, toolUserSeatId, target } = pending.reason;
    const toolName = cardName({ definitionId: shownCardId(tool) }, tr);
    // A delayed Tool still lying in a judgment area is being judged there.
    const toolCardId = tool.physical[0]?.instanceId;
    const judgedOwner = state.zones.find((z) => z.kind === 'judgment' && z.cards.some((c) => c.instanceId === toolCardId))?.ownerSeatId;
    if (judgedOwner) {
      const you = judgedOwner === viewerSeatId;
      return {
        source: you ? tr('response.judge.source.you', { tool: toolName }) : tr('response.judge.source.other', { seat: name(judgedOwner), tool: toolName }),
        latest: null,
        prompt: tr('response.cancelIt', { card: askedCardName(state, tr, viewerSeatId) }),
        outcome: you ? tr('response.judge.outcome.you', { tool: toolName }) : tr('response.judge.outcome.other', { seat: name(judgedOwner), tool: toolName }),
        outcomeForce: seatForce(state.seats.find((s) => s.id === judgedOwner)),
      };
    }
    const targetId = target.kind === 'seat' ? target.seatId : undefined;
    // Named only when the Tool is aimed at a seat other than its own user.
    const aimedAt = targetId && targetId !== toolUserSeatId ? targetId : undefined;
    return {
      source: aimedAt ? tr('response.usedOn', { seat: name(toolUserSeatId), tool: toolName, target: whom(aimedAt) }) : tr('response.used', { seat: name(toolUserSeatId), tool: toolName }),
      latest: null,
      prompt: tr('response.cancelIt', { card: askedCardName(state, tr, viewerSeatId) }),
      outcome: aimedAt ? tr('response.takesEffectOn', { tool: toolName, target: whom(aimedAt) }) : tr('response.takesEffect', { tool: toolName }),
      outcomeForce: seatForce(state.seats.find((s) => s.id === targetId)),
    };
  }

  if (pending.reason?.kind === 'counter-wuxie') {
    const { wuxieSeatId } = pending.reason;
    const asked = askedCardName(state, tr, viewerSeatId);
    // The counter card that seat answered with (Wuxie, or Wuxie Kingdom), else the asked one.
    const answered = lastAnswerBy(state.log, wuxieSeatId);
    const counter = answered ? cardName({ definitionId: shownCardId(answered.card) }, tr) : asked;
    return {
      source: tr('response.played', { seat: name(wuxieSeatId), card: counter }),
      latest: null,
      prompt: tr('response.cancelIt', { card: asked }),
      outcome: tr('response.stands', { seat: name(wuxieSeatId), card: counter }),
      outcomeForce: seatForce(state.seats.find((s) => s.id === wuxieSeatId)),
    };
  }

  if (pending.reason?.kind === 'card-effect' && pending.reason.victimSeatId) {
    const { card, userSeatId, victimSeatId } = pending.reason;
    const holder = pending.respondingSeatId;
    return {
      source: tr('response.usedOn', { seat: name(userSeatId), tool: cardName({ definitionId: shownCardId(card) }, tr), target: whom(holder) }),
      latest: null,
      prompt: tr('response.playAt', { card: askedCardName(state, tr), target: whom(victimSeatId) }),
      outcome: outcomeOf(preview(shown) ?? shown, viewerSeatId, state, tr),
      outcomeForce: seatForce(state.seats.find((s) => s.id === holder)),
    };
  }

  // Upheaval: play a Sha at the seat this seat picked, or lose 1 HP.
  if (pending.reason?.kind === 'ability' && baseSkillId(pending.reason.abilityId) === 'upheaval') {
    const { owner, targetSeatId } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    return {
      source: tr('response.usedAbility', { seat: name(owner.seatId), ability: abilityDisplayName(pending.reason.abilityId, tr) }),
      latest: null,
      prompt: tr('response.upheaval.prompt', { sha, target: targetSeatId ? whom(targetSeatId) : tr('response.seatYouPicked') }),
      outcome: you ? tr('response.loseOne.you') : tr('response.loseOne.other', { seat: name(pending.respondingSeatId) }),
      outcomeForce: seatForce(state.seats.find((s) => s.id === pending.respondingSeatId)),
    };
  }

  // Instigate: play a Sha at its user, or have a card discarded.
  if (pending.reason?.kind === 'ability' && pending.reason.abilityId === 'instigate') {
    const { owner } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    return {
      source: tr('response.usedAbility', { seat: name(owner.seatId), ability: abilityDisplayName('instigate', tr) }),
      latest: null,
      prompt: tr('response.instigate.prompt', { sha, target: whom(owner.seatId) }),
      passLabel: tr('response.instigate.pass'),
      outcome: you
        ? tr('response.instigate.outcome.you', { owner: name(owner.seatId) })
        : tr('response.instigate.outcome.other', { owner: name(owner.seatId), target: name(pending.respondingSeatId) }),
      outcomeForce: seatForce(state.seats.find((s) => s.id === pending.respondingSeatId)),
    };
  }

  const causeId = causeInstanceId(state);
  const played = causeId ? lastPlayOf(state.log, causeId) : undefined;

  let source = tr('response.needed');
  let prompt = tr('response.yourTurn');
  if (played) {
    const card = cardName({ definitionId: shownCardId(played.card) }, tr);
    source =
      played.targets.length > 0
        ? tr('response.playedAgainst', { seat: name(played.seatId), card, targets: played.targets.map((t) => targetLabel(t, state.players, tr)).join(', ') })
        : tr('response.played', { seat: name(played.seatId), card });
    prompt = tr('response.respondTo', { card });
  }

  // The latest answer to that same card, if the window follows one (a Duel's Sha).
  let latest: string | null = null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const event = state.log[i];
    if (event.kind !== 'CardPlayedEvent') continue;
    if (causeId && event.inResponseTo?.cardInstanceId === causeId) {
      latest = tr('response.answeredWith', { seat: name(event.seatId), card: cardName({ definitionId: shownCardId(event.card) }, tr) });
    }
    break;
  }

  // An armour's judgment for the responder just before the window (Eight Trigrams on black).
  if (!latest) {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const event = state.log[i];
      if (event.kind === 'CardMovedEvent') continue;
      if (event.kind === 'JudgmentEvent' && event.seatId === pending.respondingSeatId) {
        const params = { reader: judgmentReaderName(event.reader, tr), face: cardFaceLabel(event.card) };
        latest = event.seatId === viewerSeatId ? tr('response.judgment.you', params) : tr('response.judgment.other', { ...params, seat: name(event.seatId) });
      }
      break;
    }
  }

  return {
    source,
    latest,
    prompt,
    outcome: outcomeOf(preview(shown) ?? shown, viewerSeatId, state, tr),
    outcomeForce: seatForce(state.seats.find((s) => s.id === affectedSeatOf(shown))),
  };
}

// The table centre's "Waiting on …" line, with what the seat is being asked.
export function waitingLine(state: GameState, tr: Translator = englishTranslator): string | null {
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  const selection = state.pendingSelection;
  if (selection) return tr('response.waiting.choose', { seat: name(selection.seatId) });
  const asking = state.pendingChoice;
  if (asking?.reason.kind === 'ability') {
    return tr('response.waiting.ask', { seat: name(asking.seatId), what: abilityDisplayName(asking.reason.abilityId, tr) });
  }
  const choice = state.pendingChoice;
  if (choice) return tr('response.waiting.chooseCard', { seat: name(choice.seatId) });
  const pending = state.pendingResponse;
  if (!pending) return null;
  const seat = name(pending.respondingSeatId);
  const reason = pending.reason;
  if (reason?.kind === 'dying') return tr('response.waiting.toSave', { seat, dying: name(reason.seatId) });
  if (reason?.kind === 'wuxie' || reason?.kind === 'counter-wuxie') return tr('response.waiting.ask', { seat, what: askedCardName(state, tr) });
  if (reason?.kind === 'card-effect') return tr('response.waiting.answer', { seat, card: cardName({ definitionId: shownCardId(reason.card) }, tr) });
  const sha = cardName({ definitionId: 'sha' }, tr);
  if (reason?.kind === 'ability' && baseSkillId(reason.abilityId) === 'upheaval') return tr('response.waiting.playSha', { seat, sha, ability: abilityDisplayName(reason.abilityId, tr) });
  if (reason?.kind === 'ability' && reason.abilityId === 'instigate') return tr('response.waiting.playSha', { seat, sha, ability: abilityDisplayName('instigate', tr) });
  return tr('response.waiting.on', { seat });
}

// Whether the Response window should start on No Response rather than the
// first answer: true for Wuxie questions, where answering cancels a Tool
// (possibly the viewer's own), so a hasty click must not do it.
export function startsOnNoResponse(state: GameState): boolean {
  const kind = state.pendingResponse?.reason?.kind;
  return kind === 'wuxie' || kind === 'counter-wuxie';
}
