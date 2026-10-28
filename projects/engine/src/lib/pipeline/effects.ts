import { AbilityOwner, GeneralOwner, GameEvent, GameState, Kingdom, ToolCancellation, Damage, Judgment, JudgmentReader, PendingArrangement, PendingChoice, PendingResponse, PendingSelection, Seat, Target, UsedCard, WuxieSubject } from '../domain/types';
import { queueFront } from './queue';
import { toolKeyOf } from '../domain/usedCard';
import { nextInt } from '../rng/rng';
import { drawTop, moveCard, recordCountsAs, requireZoneOfKind } from '../cards/zones';
import { EngineEvent } from './events';
import type { TriggerPoint } from '../registry/types';
import { isFaceUpZoneKind } from '../domain/redact';

export type Effect =
  | { kind: 'DrawCardsEffect'; seatId: string; count: number }
  // `acted`: abilities that had their say on it (Fantasy).
  | { kind: 'DamageEffect'; damage: Damage; acted?: string[] }
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
  // Turns a revealed General face down again (no-op when it already is).
  | { kind: 'HideGeneralEffect'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'HealEffect'; target: Target; amount: number }
  // `onlyFrom`: move it only if it is still in that zone (a judged card a
  // reader already moved on).
  // `countsAs`: the card counts as that card where it lands (a Tool placed
  // through a conversion).
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string; onlyFrom?: string; countsAs?: string }
  | { kind: 'EliminateSeatEffect'; seatId: string }
  | { kind: 'ReduceMaxHpEffect'; seatId: string; amount: number }
  // The seat gains a skill for the rest of the game, held by the General in `slot`.
  | { kind: 'GainSkillEffect'; seatId: string; slot: 'main' | 'deputy'; skillId: string }
  // The seat loses every skill for the rest of the game.
  // No `slot`: the whole seat (Heartbroken). A `slot`: only that General's skills (Kingdom Wars Sorrow).
  | { kind: 'SilenceSeatEffect'; seatId: string; slot?: 'main' | 'deputy' }
  // Deals up to `count` spare Generals from the pool to the seat; the General in `slot` holds them. Logs nothing.
  | { kind: 'DealSpareGeneralsEffect'; seatId: string; slot: 'main' | 'deputy'; count: number }
  // The seat chooses `skillId` of its spare General `generalId`, which turns face up.
  | { kind: 'ChooseFormSkillEffect'; seatId: string; generalId: string; skillId: string }
  // Queues an extra turn for `seatId`; the normal order resumes after `resumeAfterSeatId`.
  | { kind: 'GrantExtraTurnEffect'; seatId: string; resumeAfterSeatId: string }
  // Marks the end of a played Tool's queue items; it does nothing itself. A
  // before-trigger on it is "after the Tool has finished resolving".
  | { kind: 'ToolResolvedEffect'; seatId: string; tool: UsedCard }
  // The dying round for `seatId`: ask the seats in `order` (turn order from the
  // turn owner) one at a time. Any seat may save it with `rescueCardIds.any`
  // (Peach); only the dying seat itself may also use `rescueCardIds.self`
  // (Wine). Content says which. See the Peach and dying spec.
  // `acted`: abilities that had their say on entering (Refusing Death);
  // `pointsBelowOne`: how many points of HP the drop took below 1, set by the mode on entering.
  | { kind: 'DyingEffect'; seatId: string; order: string[]; rescueCardIds: { any: string[]; self: string[] }; entering?: boolean; acted?: string[]; pointsBelowOne?: number; killerSeatId?: string }
  // The Tool lifecycle (see the Tools spec). One per target: a Wuxie check,
  // then the Tool's own rule (CardDefinition.onTarget). Content supplies the
  // counter card ids, so the engine names no card.
  | { kind: 'ToolOnTargetEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[]; counterCardIds: string[] }
  | { kind: 'ToolRuleEffect'; tool: UsedCard; userSeatId: string; target: Target; extra?: Target[] }
  // Asks, in `order`, the next living seat holding a counter card; none left = no cancel.
  | { kind: 'WuxieCheckEffect'; subject: WuxieSubject; order: string[]; counterCardIds: string[] }
  // Removes the next queued item: a counter card's way of cancelling what it guards.
  | { kind: 'SkipNextEffect' }
  // Wuxie Kingdom: `tool` is cancelled for every later target whose Kingdom is
  // `kingdom` (read live as each comes). `targetSeatId` is the target it was
  // played about, whose own cancel goes through the usual counter check.
  | { kind: 'CancelToolForKingdomEffect'; tool: UsedCard; kingdom: Exclude<Kingdom, 'hidden'>; targetSeatId: string }
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
  | { kind: 'DiscardZoneEffect'; zoneId: string; acted?: string[] }
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
  // `oldTo`: where the replaced card goes; default the discard pile.
  | { kind: 'ReplaceJudgmentEffect'; judgment: Judgment; withCardInstanceId: string; owner: AbilityOwner; abilityId: string; oldTo?: string }
  // A delayed Tool's turn in the Judgment phase is over (CardDefinition.onCleanup).
  | { kind: 'DelayedCleanupEffect'; tool: UsedCard; ownerSeatId: string }
  // One step of a card's resolution (a Sha's steps; see the Sha-Equipment
  // spec). The card's onStep says what it leads to; abilities hook in with
  // before:CardStepEffect triggers.
  | { kind: 'CardStepEffect'; step: string; card: UsedCard; userSeatId: string; target: Target; data?: Record<string, unknown> }
  // Asks `owner`'s seat whether to use an optional ability: Use queues
  // `effects`, Don't queues `otherwise`.
  // `judgmentChange`: a skill that may change a judgment's card is asking (counts a round of the judgment).
  | { kind: 'AskUseEffect'; owner: AbilityOwner; abilityId: string; effects: Effect[]; otherwise?: Effect[]; targetSeatId?: string; judgmentChange?: true }
  // Logs that an ability applied, for the Action History.
  // `cardId`: the card it was about (Bewilder's claim).
  | { kind: 'AbilityUsedEffect'; owner: AbilityOwner; abilityId: string; outcome: string; targetSeatId?: string; cardId?: string }
  // Asks `selection.seatId` to pick cards or seats; the queue waits.
  | { kind: 'OpenSelectionEffect'; selection: PendingSelection }
  // One step of a General's skill (SkillDefinition.onStep).
  | { kind: 'SkillStepEffect'; owner: GeneralOwner; step: string; data?: Record<string, unknown> }
  // `owner`'s triggers at `point` for `subject`, gathered now and queued: a
  // skill gained while that event's after-triggers resolve still takes part
  // (Incarnation's Form chosen at Start). Logs nothing.
  | { kind: 'FireSkillTriggersEffect'; owner: GeneralOwner; point: TriggerPoint; subject: GameEvent }
  // Closes the Start window and enters Start (queued behind the reveals the window confirmed).
  | { kind: 'EnterStartPhaseEffect' }
  // `effect` resolved again with the hidden compulsory skills among its first `declined` before-triggers
  // (gather order) not asking to be revealed: the owner declined them, so asking again would never end.
  // A count, not skill ids: the effect sits in a pending choice other seats can see.
  | { kind: 'UnaskedEffect'; effect: Effect; declined: number }
  // `seatId` uses `card` at `targets`, as a play outside any limit: a card a
  // skill makes a seat use (Sow Discord's Duel). Not counted toward limits.
  // `counted`: a play toward per-turn limits, spending Wine; `answering`: the
  // card answers that window.
  | { kind: 'UseCardEffect'; seatId: string; card: UsedCard; targets: Target[]; counted?: boolean; answering?: PendingResponse }
  // Turns a seat face down (Entrench): its next turn is passed as it turns up.
  | { kind: 'TurnFaceDownEffect'; seatId: string }
  | { kind: 'TurnFaceUpEffect'; seatId: string }
  // Shows a card to everyone (Sow Revolt's taken card): logs its face.
  | { kind: 'ShowCardEffect'; seatId: string; cardInstanceId: string; abilityId?: string }
  // Chains or unchains a living seat; logs only a change.
  | { kind: 'SetChainedEffect'; seatId: string; chained: boolean }
  // A chain's wave after `damage` fully resolved: the next seat of `remaining`
  // still living and chained takes `damage` again, at its base amount, marked
  // `chained` so it starts no wave of its own; then the rest follow.
  | { kind: 'ChainPropagationEffect'; damage: Damage; remaining: string[] };

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
      // Fire or thunder damage actually dealt to a chained seat unchains it.
      const unchains = !!seat.chained && effect.damage.nature !== 'normal' && effect.damage.amount > 0;
      const seats = state.seats.map((s) =>
        // HP may go below 0: a big hit needs more Peaches to recover from.
        s.id === seatId ? withoutChain({ ...s, combinedHp: s.combinedHp - effect.damage.amount }, unchains) : s
      );
      const events: EngineEvent[] = [
        { kind: 'DamageDealtEvent', damage: effect.damage },
        ...(unchains ? [{ kind: 'ChainToggledEvent' as const, seatId, chained: false }] : []),
      ];
      return { state: { ...state, seats, log: [...state.log, ...events] }, events };
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
    case 'HideGeneralEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const generals = seat.generals;
      if (!generals) throw new Error(`Seat ${effect.seatId} has not chosen its generals yet`);
      if (!generals[effect.slot].revealed) return { state, events: [] };
      const seats = state.seats.map((s) =>
        s.id === effect.seatId ? { ...s, generals: { ...generals, [effect.slot]: { ...generals[effect.slot], revealed: false } } } : s
      );
      const event: EngineEvent = { kind: 'GeneralHiddenEvent', seatId: effect.seatId, slot: effect.slot };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'HealEffect': {
      if (effect.target.kind !== 'seat') throw new Error('HealEffect currently only supports seat targets');
      const seat = state.seats.find((s) => s.id === effect.target.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.target.seatId}`);
      if (seat.eliminated) return { state, events: [] };
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
    case 'GainSkillEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const held = seat.gainedSkills ?? [];
      if (held.some((g) => g.slot === effect.slot && g.skillId === effect.skillId)) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, gainedSkills: [...held, { slot: effect.slot, skillId: effect.skillId }] } : s));
      const event: EngineEvent = { kind: 'SkillGainedEvent', seatId: seat.id, slot: effect.slot, skillId: effect.skillId };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'SilenceSeatEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const { slot } = effect;
      if (seat.silenced || (slot && seat.silencedSlots?.includes(slot))) return { state, events: [] };
      const silence = (s: Seat): Seat => (slot ? { ...s, silencedSlots: [...(s.silencedSlots ?? []), slot] } : { ...s, silenced: true as const });
      const seats = state.seats.map((s) => (s.id === seat.id ? silence(s) : s));
      const event: EngineEvent = { kind: 'SeatSilencedEvent', seatId: seat.id, ...(slot ? { slot } : {}) };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'DealSpareGeneralsEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const pool = state.spareGenerals ?? [];
      const taken = pool.slice(0, Math.max(0, effect.count));
      if (taken.length === 0) return { state, events: [] };
      const forms = { slot: effect.slot, held: [...(seat.forms?.held ?? []), ...taken], ...(seat.forms?.chosen ? { chosen: seat.forms.chosen } : {}) };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, forms } : s));
      // Nothing is logged: the log is public, and a seat dealt Forms would give its hidden General away.
      return { state: { ...state, seats, spareGenerals: pool.slice(taken.length) }, events: [] };
    }
    case 'ChooseFormSkillEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat?.forms) throw new Error(`Seat ${effect.seatId} holds no spare Generals`);
      const forms = { ...seat.forms, chosen: { generalId: effect.generalId, skillId: effect.skillId } };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, forms } : s));
      const event: EngineEvent = { kind: 'FormChosenEvent', seatId: seat.id, generalId: effect.generalId, skillId: effect.skillId };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'GrantExtraTurnEffect': {
      const turn = { ...state.turn, extraTurnStack: [...state.turn.extraTurnStack, effect.seatId], resumeAfterSeatId: state.turn.resumeAfterSeatId ?? effect.resumeAfterSeatId };
      const event: EngineEvent = { kind: 'ExtraTurnGrantedEvent', seatId: effect.seatId };
      return { state: { ...state, turn, log: [...state.log, event] }, events: [event] };
    }
    case 'EliminateSeatEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated) return { state, events: [] };
      const { seats, events: revealed } = eliminateIn(state.seats, seat.id);
      const events: EngineEvent[] = [...revealed, { kind: 'SeatEliminatedEvent', seatId: effect.seatId }];
      return { state: { ...state, seats, log: [...state.log, ...events] }, events };
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
        ...(effect.judgmentChange ? { judgmentChange: true as const } : {}),
      };
      // A changer's ask while the judgment is still open is one more round of it.
      const view = state.judgmentView;
      const counted: Partial<GameState> = effect.judgmentChange && view && !view.settled ? { judgmentView: { ...view, rounds: (view.rounds ?? 0) + 1 } } : {};
      return { state: { ...state, ...counted, pendingChoice: choice }, events: [] };
    }
    case 'AbilityUsedEffect': {
      const event: EngineEvent = {
        kind: 'AbilityUsedEvent',
        owner: effect.owner,
        abilityId: effect.abilityId,
        outcome: effect.outcome,
        ...(effect.targetSeatId ? { targetSeatId: effect.targetSeatId } : {}),
        ...(effect.cardId ? { cardId: effect.cardId } : {}),
      };
      return { state: { ...state, log: [...state.log, event] }, events: [event] };
    }
    case 'ShowCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      if (!card) return { state, events: [] };
      const event: EngineEvent = { kind: 'CardShownEvent', seatId: effect.seatId, card, ...(effect.abilityId ? { abilityId: effect.abilityId } : {}) };
      return { state: { ...state, log: [...state.log, event] }, events: [event] };
    }
    case 'TurnFaceDownEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated || seat.faceDown) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, faceDown: true as const } : s));
      const event: EngineEvent = { kind: 'SeatTurnedEvent', seatId: seat.id, faceDown: true };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'TurnFaceUpEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (!seat.faceDown) return { state, events: [] };
      const { faceDown: _up, ...faceUp } = seat;
      const seats = state.seats.map((s) => (s.id === seat.id ? faceUp : s));
      const event: EngineEvent = { kind: 'SeatTurnedEvent', seatId: seat.id, faceDown: false };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'ReduceMaxHpEffect': {
      // 0 max HP is immediate death: no dying round, no rescue (official rule).
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated || effect.amount <= 0) return { state, events: [] };
      const maxCombinedHp = Math.max(0, seat.maxCombinedHp - effect.amount);
      const combinedHp = Math.min(seat.combinedHp, maxCombinedHp);
      const out = maxCombinedHp <= 0;
      const lowered = state.seats.map((s) => (s.id === seat.id ? { ...s, maxCombinedHp, combinedHp } : s));
      const { seats, events: revealed } = out ? eliminateIn(lowered, seat.id) : { seats: lowered, events: [] };
      const events: EngineEvent[] = [
        { kind: 'MaxHpReducedEvent', seatId: seat.id, amount: seat.maxCombinedHp - maxCombinedHp, maxHp: maxCombinedHp },
        ...revealed,
        ...(out ? [{ kind: 'SeatEliminatedEvent' as const, seatId: seat.id }] : []),
      ];
      return { state: { ...state, seats, log: [...state.log, ...events] }, events };
    }
    case 'SetChainedEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated || !!seat.chained === effect.chained) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? (effect.chained ? { ...s, chained: true as const } : withoutChain(s, true)) : s));
      const event: EngineEvent = { kind: 'ChainToggledEvent', seatId: seat.id, chained: effect.chained };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'ChainPropagationEffect': {
      // Each seat is checked as its turn comes: one that died or was unchained meanwhile is skipped.
      const index = effect.remaining.findIndex((id) => state.seats.some((s) => s.id === id && !s.eliminated && !!s.chained));
      if (index === -1) return { state, events: [] };
      const rest = effect.remaining.slice(index + 1);
      const base = effect.damage.base ?? effect.damage.amount;
      const hit: Effect = {
        kind: 'DamageEffect',
        damage: { ...effect.damage, target: { kind: 'seat', seatId: effect.remaining[index] }, amount: base, base, chained: true },
      };
      return { state: queueFront(state, [hit, ...(rest.length > 0 ? [{ ...effect, remaining: rest }] : [])]), events: [] };
    }
    case 'ToolResolvedEffect': {
      // Its Kingdom cancels end with it.
      const key = toolKeyOf(effect.tool);
      const left = (state.toolCancellations ?? []).filter((c) => c.toolKey !== key);
      return { state: withToolCancellations(state, left), events: [] };
    }
    case 'SkillStepEffect':
    case 'FireSkillTriggersEffect':
    case 'EnterStartPhaseEffect':
    case 'UnaskedEffect':
    case 'UseCardEffect':
      throw new Error(`${effect.kind} needs the registry: resolve it through the pipeline`);
    default:
      throw new Error(`Unhandled effect kind: ${(effect as Effect).kind}`);
  }
}

// The seat out of the game: no longer chained, and both its Generals shown (a
// death reveals them; the events are marked so no reveal bonus follows a dead
// seat). The reveals come before its elimination in the log.
function eliminateIn(seats: Seat[], seatId: string): { seats: Seat[]; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  const out = seats.map((seat) => {
    if (seat.id !== seatId) return seat;
    const generals = seat.generals;
    if (generals) {
      for (const slot of ['main', 'deputy'] as const) {
        if (!generals[slot].revealed) events.push({ kind: 'GeneralRevealedEvent', seatId, slot, onDeath: true });
      }
    }
    const shown = generals ? { generals: { main: { ...generals.main, revealed: true }, deputy: { ...generals.deputy, revealed: true } } } : {};
    return { ...withoutChain(seat, true), ...shown, eliminated: true };
  });
  return { seats: out, events };
}

// `seat` unchained when `unchain` holds.
function withoutChain(seat: Seat, unchain: boolean): Seat {
  if (!unchain || !seat.chained) return seat;
  const { chained: _dropped, ...rest } = seat;
  return rest;
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
  const events: EngineEvent[] = effect.entering && seat.combinedHp <= 0 ? [{ kind: 'SeatDyingEvent', seatId: seat.id, ...(effect.killerSeatId ? { killerSeatId: effect.killerSeatId } : {}) }] : [];
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
    const { seats, events: revealed } = eliminateIn(state.seats, seat.id);
    return logged({ ...state, seats }, [...revealed, { kind: 'SeatEliminatedEvent', seatId: seat.id, ...(effect.killerSeatId ? { killerSeatId: effect.killerSeatId } : {}) }]);
  }

  const askerId = effect.order[index];
  const pendingResponse: PendingResponse = {
    id: `dying-${seat.id}-${state.log.length + events.length}`,
    respondingSeatId: askerId,
    allowedActionKinds: ['RespondAction', 'PassAction'],
    allowedCardIds: askerId === seat.id ? [...effect.rescueCardIds.any, ...effect.rescueCardIds.self] : effect.rescueCardIds.any,
    reason: { kind: 'dying', seatId: seat.id },
    // Pass: move on to the next seat.
    context: { effect: { kind: 'DyingEffect', seatId: seat.id, order: effect.order.slice(index + 1), rescueCardIds: effect.rescueCardIds, ...(effect.killerSeatId ? { killerSeatId: effect.killerSeatId } : {}) } },
    // A rescue card: heal the dying seat, then ask again from this same seat.
    onAnswer: [
      { kind: 'HealEffect', target: { kind: 'seat', seatId: seat.id }, amount: 1 },
      { kind: 'DyingEffect', seatId: seat.id, order: effect.order.slice(index), rescueCardIds: effect.rescueCardIds, ...(effect.killerSeatId ? { killerSeatId: effect.killerSeatId } : {}) },
    ],
  };
  return logged({ ...state, pendingResponse });
}

// Sets the Kingdom cancels; none is stored as no field at all.
export function withToolCancellations(state: GameState, cancellations: ToolCancellation[]): GameState {
  if (cancellations.length > 0) return { ...state, toolCancellations: cancellations };
  if (state.toolCancellations === undefined) return state;
  const { toolCancellations: _dropped, ...rest } = state;
  return rest;
}
