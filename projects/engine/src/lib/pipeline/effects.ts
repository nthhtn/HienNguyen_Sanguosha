import { AbilityOwner, GeneralOwner, GameState, Damage, Judgment, JudgmentReader, PendingArrangement, PendingChoice, PendingResponse, PendingSelection, Target, UsedCard, WuxieSubject } from '../domain/types';
import { queueFront } from './queue';
import { nextInt } from '../rng/rng';
import { drawTop, moveCard, recordCountsAs, requireZoneOfKind } from '../cards/zones';
import { EngineEvent } from './events';
import { isFaceUpZoneKind } from '../domain/redact';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  | { kind: 'DamageEffect'; damage: Damage }
  | { kind: 'OpenResponseEffect'; pendingResponse: PendingResponse }
  // Asks `arrangement.seatId` to arrange cards; the queue waits.
  | { kind: 'OpenArrangementEffect'; arrangement: PendingArrangement }
  // Lowers HP without damage (see HpLostEvent). The mode starts the dying round.
  | { kind: 'LoseHpEffect'; seatId: string; amount: number; abilityId?: string }
  // The Draw Phase's draw: `count` cards. Skills rewrite the count or replace
  // the draw with before-triggers. `acted`: the skills that had their say (an
  // ask's Don't sends it back through its before-triggers).
  | { kind: 'DrawPhaseEffect'; seatId: string; count: number; acted?: string[] }
  // Adds `by` to a counter: this turn's ability uses (scope 'turn'), or a
  // seat's game-long marks (scope 'seat', with `seatId`). Logs nothing.
  | { kind: 'IncrementEffect'; scope: 'turn' | 'seat'; key: string; by: number; seatId?: string }
  // `forAbilityId`: revealed to use that skill (the history names it).
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy'; forAbilityId?: string }
  | { kind: 'HealEffect'; target: Target; amount: number }
  // `onlyFrom`: move it only if it is still in that zone (a judged card a
  // reader already moved on).
  // `countsAs`: the card counts as that card where it lands (a Tool placed
  // through a conversion).
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string; onlyFrom?: string; countsAs?: string }
  | { kind: 'EliminateSeatEffect'; seatId: string }
  // The dying round for `seatId`: ask the seats in `order` (turn order from the
  // turn owner) one at a time. Any seat may save it with `rescueCardIds.any`
  // (Peach); only the dying seat itself may also use `rescueCardIds.self`
  // (Wine). Content says which. See the Peach and dying spec.
  | { kind: 'DyingEffect'; seatId: string; order: string[]; rescueCardIds: { any: string[]; self: string[] }; entering?: boolean }
  // The Tool lifecycle (see the Tools spec). One per target: a Wuxie check,
  // then the Tool's own rule (CardDefinition.onTarget). Content supplies the
  // counter card ids, so the engine names no card.
  | { kind: 'ToolOnTargetEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[]; counterCardIds: string[] }
  | { kind: 'ToolRuleEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[] }
  // Asks, in `order`, the next living seat holding a counter card; none left = no cancel.
  | { kind: 'WuxieCheckEffect'; subject: WuxieSubject; order: string[]; counterCardIds: string[] }
  // Removes the next queued item: a counter card's way of cancelling what it guards.
  | { kind: 'SkipNextEffect' }
  // Asks `choice.seatId` to pick one option; the queue waits for the pick.
  | { kind: 'OpenChoiceEffect'; choice: PendingChoice }
  // Moves a random card (seeded) of `fromZoneId` to `toZoneId`: a pick from a
  // hand the chooser can't see. Nothing happens when the zone is empty.
  | { kind: 'MoveRandomCardEffect'; fromZoneId: string; toZoneId: string }
  // Turns `count` cards from the draw pile face up into the processing zone
  // (Harvest), shuffling the discard pile in first when the draw pile is short
  // (all but `keepInDiscard`: the Tool being resolved never turns itself up).
  | { kind: 'RevealToProcessingEffect'; count: number; keepInDiscard?: string[] }
  // Moves every card in `zoneId` to the discard pile, in order.
  | { kind: 'DiscardZoneEffect'; zoneId: string }
  // Sets a flag of the current turn (e.g. skipFlagOf('Play')), or clears it
  // with `value: false`. Flags end with the turn.
  | { kind: 'SetTurnFlagEffect'; flag: string; value?: boolean }
  // Judgment, step 1: turn the top card up for `seatId`, for `reader` (which
  // receives `data`). Nothing left to judge with: `otherwise` goes ahead.
  | { kind: 'JudgeEffect'; seatId: string; reader: JudgmentReader; data?: Record<string, unknown>; otherwise?: Effect[] }
  // Step 2: the card is shown. Skills that change judgments hook in here with
  // before-triggers (`acted`: those that had their say; `changedBy`: the seat
  // that replaced the card last).
  | { kind: 'JudgmentShownEffect'; judgment: Judgment; acted?: string[]; changedBy?: string }
  // Step 3: the reader reads the final card.
  | { kind: 'JudgmentResolveEffect'; judgment: Judgment }
  // Step 4: the card goes to the discard pile, unless something took it
  // (a before-trigger here may take it first; `acted` as above).
  | { kind: 'JudgmentDoneEffect'; judgment: Judgment; acted?: string[] }
  // Replaces the judgment's card with a hand card: the old one is discarded,
  // and the judgment is shown again.
  | { kind: 'ReplaceJudgmentEffect'; judgment: Judgment; withCardInstanceId: string; owner: AbilityOwner; abilityId: string }
  // A delayed Tool's turn in the Judgment phase is over (CardDefinition.onCleanup).
  | { kind: 'DelayedCleanupEffect'; tool: UsedCard; ownerSeatId: string }
  // One step of a card's resolution (a Sha's steps; see the Sha-Equipment
  // spec). The card's onStep says what it leads to; abilities hook in with
  // before:CardStepEffect triggers.
  | { kind: 'CardStepEffect'; step: string; card: UsedCard; userSeatId: string; target: Target; data?: Record<string, unknown> }
  // Asks `owner`'s seat whether to use an optional ability: Use queues
  // `effects`, Don't queues `otherwise`.
  | { kind: 'AskUseEffect'; owner: AbilityOwner; abilityId: string; effects: Effect[]; otherwise?: Effect[]; targetSeatId?: string }
  // Logs that an ability applied, for the Action History.
  | { kind: 'AbilityUsedEffect'; owner: AbilityOwner; abilityId: string; outcome: string; targetSeatId?: string }
  // Asks `selection.seatId` to pick cards or seats; the queue waits.
  | { kind: 'OpenSelectionEffect'; selection: PendingSelection }
  // One step of a General's skill (SkillDefinition.onStep).
  | { kind: 'SkillStepEffect'; owner: GeneralOwner; step: string; data?: Record<string, unknown> }
  // `seatId` uses `card` at `targets`, as a play outside any limit: a card a
  // skill makes a seat use (Sow Discord's Duel). Not counted toward limits.
  | { kind: 'UseCardEffect'; seatId: string; card: UsedCard; targets: Target[] }
  // Shows a card to everyone (Sow Revolt's taken card): logs its face.
  | { kind: 'ShowCardEffect'; seatId: string; cardInstanceId: string; abilityId?: string };

export interface ApplyResult {
  state: GameState;
  events: EngineEvent[];
}

export function applyEffect(state: GameState, effect: Effect): ApplyResult {
  switch (effect.kind) {
    case 'DrawCardsEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, seat.hand.zoneId, effect.count, state.rng);
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'CardsDrawnEvent', seatId: seat.id, cardInstanceIds: drawn.map((c) => c.instanceId) },
      ];
      return { state: { ...state, zones, rng, log: [...state.log, ...events] }, events };
    }
    case 'DamageEffect': {
      if (effect.damage.target.kind !== 'seat') {
        throw new Error('DamageEffect currently only supports seat targets');
      }
      const seatId = effect.damage.target.seatId;
      const seat = state.seats.find((s) => s.id === seatId);
      if (!seat) throw new Error(`Unknown seat: ${seatId}`);
      const seats = state.seats.map((s) =>
        // HP may go below 0: a big hit needs more Peaches to recover from.
        s.id === seatId ? { ...s, combinedHp: s.combinedHp - effect.damage.amount } : s
      );
      const event: EngineEvent = { kind: 'DamageDealtEvent', damage: effect.damage };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'OpenResponseEffect':
      return { state: { ...state, pendingResponse: effect.pendingResponse }, events: [] };
    case 'RevealGeneralEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const generals = seat.generals;
      if (!generals) throw new Error(`Seat ${effect.seatId} has not chosen its generals yet`);
      if (generals[effect.slot].revealed) {
        return { state, events: [] };
      }
      const seats = state.seats.map((s) =>
        s.id === effect.seatId
          ? { ...s, generals: { ...generals, [effect.slot]: { ...generals[effect.slot], revealed: true } } }
          : s
      );
      const event: EngineEvent = {
        kind: 'GeneralRevealedEvent',
        seatId: effect.seatId,
        slot: effect.slot,
        ...(effect.forAbilityId ? { forAbilityId: effect.forAbilityId } : {}),
      };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'HealEffect': {
      if (effect.target.kind !== 'seat') throw new Error('HealEffect currently only supports seat targets');
      const seat = state.seats.find((s) => s.id === effect.target.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.target.seatId}`);
      const combinedHp = Math.min(seat.maxCombinedHp, seat.combinedHp + effect.amount);
      // Only what was actually recovered is logged; at full HP, nothing.
      const recovered = combinedHp - seat.combinedHp;
      if (recovered <= 0) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === effect.target.seatId ? { ...s, combinedHp } : s));
      const event: EngineEvent = { kind: 'HealEvent', target: effect.target, amount: recovered };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'MoveCardEffect': {
      const origin = state.zones.find((z) => z.cards.some((c) => c.instanceId === effect.cardInstanceId));
      if (effect.onlyFrom && origin?.id !== effect.onlyFrom) return { state, events: [] };
      const moved = moveCard(state.zones, effect.cardInstanceId, effect.toZoneId);
      const card = moved.find((z) => z.id === effect.toZoneId)!.cards.at(-1)!;
      const zones = recordCountsAs(moved, origin!.id, effect.toZoneId, card, effect.countsAs);
      const destination = zones.find((z) => z.id === effect.toZoneId)!;
      const event: EngineEvent = {
        kind: 'CardMovedEvent',
        cardInstanceId: effect.cardInstanceId,
        // moveCard has already thrown if the card was in no zone.
        fromZoneId: origin!.id,
        toZoneId: effect.toZoneId,
        ...(isFaceUpZoneKind(destination.kind) ? { card } : {}),
      };
      return { state: { ...state, zones, log: [...state.log, event] }, events: [event] };
    }
    case 'EliminateSeatEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === effect.seatId ? { ...s, eliminated: true } : s));
      const event: EngineEvent = { kind: 'SeatEliminatedEvent', seatId: effect.seatId };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'OpenChoiceEffect':
      return { state: { ...state, pendingChoice: effect.choice }, events: [] };
    case 'MoveRandomCardEffect': {
      const from = state.zones.find((z) => z.id === effect.fromZoneId);
      if (!from) throw new Error(`Zone ${effect.fromZoneId} not found`);
      if (from.cards.length === 0) return { state, events: [] };
      const { value, rng } = nextInt(state.rng, from.cards.length);
      return applyEffect({ ...state, rng }, { kind: 'MoveCardEffect', cardInstanceId: from.cards[value].instanceId, toZoneId: effect.toZoneId });
    }
    case 'RevealToProcessingEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const processing = requireZoneOfKind(state.zones, 'processing');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, effect.count, state.rng, effect.keepInDiscard);
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'CardsTurnedUpEvent', zoneId: processing.id, cards: drawn },
      ];
      return { state: { ...state, zones, rng, log: [...state.log, ...events] }, events };
    }
    case 'DiscardZoneEffect': {
      const zone = state.zones.find((z) => z.id === effect.zoneId);
      if (!zone) throw new Error(`Zone ${effect.zoneId} not found`);
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      let current = state;
      const events: EngineEvent[] = [];
      for (const card of zone.cards) {
        const moved = applyEffect(current, { kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: discardPile.id });
        current = moved.state;
        events.push(...moved.events);
      }
      return { state: current, events };
    }
    case 'SetTurnFlagEffect': {
      const { [effect.flag]: _previous, ...others } = state.turn.flags ?? {};
      const flags = effect.value === false ? others : { ...others, [effect.flag]: true };
      const { flags: _old, ...turn } = state.turn;
      return { state: { ...state, turn: Object.keys(flags).length > 0 ? { ...turn, flags } : turn }, events: [] };
    }
    case 'DyingEffect':
      return applyDying(state, effect);
    case 'OpenArrangementEffect':
      return { state: { ...state, pendingArrangement: effect.arrangement }, events: [] };
    case 'LoseHpEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, combinedHp: s.combinedHp - effect.amount } : s));
      const event: EngineEvent = { kind: 'HpLostEvent', seatId: seat.id, amount: effect.amount, ...(effect.abilityId ? { abilityId: effect.abilityId } : {}) };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'DrawPhaseEffect':
      if (effect.count <= 0) return { state, events: [] };
      return applyEffect(state, { kind: 'DrawCardsEffect', seatId: effect.seatId, count: effect.count });
    case 'IncrementEffect': {
      if (effect.scope === 'turn') {
        const uses = state.turn.abilityUses ?? {};
        return { state: { ...state, turn: { ...state.turn, abilityUses: { ...uses, [effect.key]: (uses[effect.key] ?? 0) + effect.by } } }, events: [] };
      }
      if (!effect.seatId) throw new Error('IncrementEffect with scope seat needs a seatId');
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const marks = seat.marks ?? {};
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, marks: { ...marks, [effect.key]: (marks[effect.key] ?? 0) + effect.by } } : s));
      return { state: { ...state, seats }, events: [] };
    }
    case 'OpenSelectionEffect':
      return { state: { ...state, pendingSelection: effect.selection }, events: [] };
    case 'AskUseEffect': {
      const owner = state.seats.find((s) => s.id === effect.owner.seatId);
      // An owner who is out can't be asked: what happens otherwise goes ahead.
      if (!owner || owner.eliminated) return { state: queueFront(state, effect.otherwise ?? []), events: [] };
      // A hidden General's skill: Use reveals it first.
      const hidden = effect.owner.kind === 'general' && owner.generals && !owner.generals[effect.owner.slot].revealed ? effect.owner.slot : null;
      const reveal: Effect[] = hidden ? [{ kind: 'RevealGeneralEffect', seatId: owner.id, slot: hidden, forAbilityId: effect.abilityId }] : [];
      const choice: PendingChoice = {
        id: `ask-${effect.abilityId}-${owner.id}-${state.log.length}`,
        seatId: owner.id,
        reason: { kind: 'ability', owner: effect.owner, abilityId: effect.abilityId, ...(effect.targetSeatId ? { targetSeatId: effect.targetSeatId } : {}) },
        verb: 'use',
        options: [
          { id: 'use', shows: { kind: 'use', ...(hidden ? { reveals: hidden } : {}) }, effects: [...reveal, ...effect.effects] },
          { id: 'decline', shows: { kind: 'decline' }, effects: effect.otherwise ?? [] },
        ],
      };
      return { state: { ...state, pendingChoice: choice }, events: [] };
    }
    case 'AbilityUsedEffect': {
      const event: EngineEvent = {
        kind: 'AbilityUsedEvent',
        owner: effect.owner,
        abilityId: effect.abilityId,
        outcome: effect.outcome,
        ...(effect.targetSeatId ? { targetSeatId: effect.targetSeatId } : {}),
      };
      return { state: { ...state, log: [...state.log, event] }, events: [event] };
    }
    case 'ShowCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      if (!card) return { state, events: [] };
      const event: EngineEvent = { kind: 'CardShownEvent', seatId: effect.seatId, card, ...(effect.abilityId ? { abilityId: effect.abilityId } : {}) };
      return { state: { ...state, log: [...state.log, event] }, events: [event] };
    }
    case 'SkillStepEffect':
    case 'UseCardEffect':
      throw new Error(`${effect.kind} needs the registry: resolve it through the pipeline`);
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}

// One step of the dying round. Saved once above 0 HP; otherwise ask the next
// seat in `order` that must be asked — the dying seat always, any other seat
// only while it holds a rescue card; eliminated when no one is left to ask.
// `mayRescue`: whether a seat with no rescue card in hand could still answer
// with one (a conversion into a Peach); the pipeline supplies it, since it
// needs the registry.
export function applyDying(state: GameState, effect: Extract<Effect, { kind: 'DyingEffect' }>, mayRescue?: (seatId: string) => boolean): ApplyResult {
  const seat = state.seats.find((s) => s.id === effect.seatId);
  if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
  if (seat.eliminated) return { state, events: [] };
  const events: EngineEvent[] = effect.entering && seat.combinedHp <= 0 ? [{ kind: 'SeatDyingEvent', seatId: seat.id }] : [];
  const logged = (next: GameState, more: EngineEvent[] = []): ApplyResult => ({
    state: { ...next, log: [...next.log, ...events, ...more] },
    events: [...events, ...more],
  });

  if (seat.combinedHp > 0) return logged(state, [{ kind: 'SeatSavedEvent', seatId: seat.id }]);

  // Other seats are asked only while they hold a card that may save someone else.
  const holdsRescue = (seatId: string) => {
    const s = state.seats.find((x) => x.id === seatId);
    const hand = s && state.zones.find((z) => z.id === s.hand.zoneId);
    return !!hand?.cards.some((c) => effect.rescueCardIds.any.includes(c.definitionId)) || !!mayRescue?.(seatId);
  };
  const isLiving = (seatId: string) => !!state.seats.find((x) => x.id === seatId && !x.eliminated);
  const index = effect.order.findIndex((id) => isLiving(id) && (id === seat.id || holdsRescue(id)));
  if (index === -1) {
    const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, eliminated: true } : s));
    return logged({ ...state, seats }, [{ kind: 'SeatEliminatedEvent', seatId: seat.id }]);
  }

  const askerId = effect.order[index];
  const pendingResponse: PendingResponse = {
    id: `dying-${seat.id}-${state.log.length + events.length}`,
    respondingSeatId: askerId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: askerId === seat.id ? [...effect.rescueCardIds.any, ...effect.rescueCardIds.self] : effect.rescueCardIds.any,
    reason: { kind: 'dying', seatId: seat.id },
    // Pass: move on to the next seat.
    context: { effect: { kind: 'DyingEffect', seatId: seat.id, order: effect.order.slice(index + 1), rescueCardIds: effect.rescueCardIds } },
    // A rescue card: heal the dying seat, then ask again from this same seat.
    onAnswer: [
      { kind: 'HealEffect', target: { kind: 'seat', seatId: seat.id }, amount: 1 },
      { kind: 'DyingEffect', seatId: seat.id, order: effect.order.slice(index), rescueCardIds: effect.rescueCardIds },
    ],
  };
  return logged({ ...state, pendingResponse });
}
