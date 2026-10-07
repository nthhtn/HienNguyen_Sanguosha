import type {
  CardInstance, CardMovedEvent, CardsDrawnEvent, ChoiceOption, ContentRegistry, DecisionReason, Effect, GameState,
  GeneralOwner, PendingChoice, SelectionContinuation, SkillTrigger, TriggerPoint,
} from 'engine';
import { livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { abilityKey } from './steps';
import { handOf } from './queries';

// Building blocks for the General skills (generals/*.ts). Each takes the
// `owner` the engine gathered the skill for: the seat and slot it acts for.

export type SkillStep = Extract<Effect, { kind: 'SkillStepEffect' }>;
type DrawPhase = Extract<Effect, { kind: 'DrawPhaseEffect' }>;

// A step of `owner`'s skill (SkillDefinition.onStep), carrying `data`.
export function skillStep(owner: GeneralOwner, step: string, data: Record<string, unknown> = {}): SkillStep {
  return { kind: 'SkillStepEffect', owner, step, data };
}

// What a skill's decisions are about; `targetSeatId`: the other seat involved.
export function reasonOf(owner: GeneralOwner, targetSeatId?: string): DecisionReason {
  return { kind: 'ability', owner, abilityId: owner.skillId, ...(targetSeatId ? { targetSeatId } : {}) };
}

// Asks `owner`'s seat whether to use the skill: Use queues `effects`, Don't
// queues `otherwise`. A hidden General's ask reveals it on Use (the engine).
export function ask(owner: GeneralOwner, effects: Effect[], otherwise: Effect[] = [], targetSeatId?: string): Effect {
  return { kind: 'AskUseEffect', owner, abilityId: owner.skillId, effects, ...(otherwise.length > 0 ? { otherwise } : {}), ...(targetSeatId ? { targetSeatId } : {}) };
}

// Logs that the skill applied: `outcome` is content's code the history reads.
export function used(owner: GeneralOwner, outcome = 'used', targetSeatId?: string): Effect {
  return { kind: 'AbilityUsedEffect', owner, abilityId: owner.skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) };
}

export const draw = (seatId: string, count: number): Effect => ({ kind: 'DrawCardsEffect', seatId, count });
export const heal = (seatId: string, amount = 1): Effect => ({ kind: 'HealEffect', target: { kind: 'seat', seatId }, amount });

// Damage from `owner`'s seat to `targetSeatId`, caused by the skill (no card).
export function skillDamage(owner: GeneralOwner, targetSeatId: string, amount = 1): Effect {
  return {
    kind: 'DamageEffect',
    damage: { source: { kind: 'seat', seatId: owner.seatId }, target: { kind: 'seat', seatId: targetSeatId }, amount, nature: 'normal', cause: { skillId: owner.skillId } },
  };
}

// Each card to the discard pile, in order.
export function discardMoves(state: GameState, cardInstanceIds: readonly string[]): Effect[] {
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  return cardInstanceIds.map((cardInstanceId) => ({ kind: 'MoveCardEffect', cardInstanceId, toZoneId: discardPileId }));
}

interface SelectionSpec {
  of: 'cards' | 'seats';
  eligibleIds: string[];
  min: number;
  max: number;
  then: SelectionContinuation;
  // Absent: it can't be cancelled.
  onCancel?: Effect[];
  // Who selects; default the owner's seat.
  seatId?: string;
  targetSeatId?: string;
}

// A selection for `owner`'s skill.
export function selectionOf(state: GameState, owner: GeneralOwner, spec: SelectionSpec): Effect {
  const seatId = spec.seatId ?? owner.seatId;
  return {
    kind: 'OpenSelectionEffect',
    selection: {
      id: `${owner.skillId}-${seatId}-${state.log.length}`,
      seatId,
      reason: reasonOf(owner, spec.targetSeatId),
      of: spec.of,
      eligibleIds: spec.eligibleIds,
      min: spec.min,
      max: spec.max,
      then: spec.then,
      ...(spec.onCancel ? { onCancel: spec.onCancel } : {}),
    },
  };
}

interface ChoiceSpec {
  verb: PendingChoice['verb'];
  options: ChoiceOption[];
  // Who chooses; default the owner's seat.
  seatId?: string;
  targetSeatId?: string;
}

// A choice for `owner`'s skill.
export function choiceOf(state: GameState, owner: GeneralOwner, spec: ChoiceSpec): Effect {
  const seatId = spec.seatId ?? owner.seatId;
  return {
    kind: 'OpenChoiceEffect',
    choice: { id: `${owner.skillId}-${seatId}-${state.log.length}`, seatId, reason: reasonOf(owner, spec.targetSeatId), verb: spec.verb, options: spec.options },
  };
}

// One option per seat; picking one queues `effectsFor(seatId)`.
export function seatOptions(seatIds: readonly string[], effectsFor: (seatId: string) => Effect[]): ChoiceOption[] {
  return seatIds.map((seatId) => ({ id: seatId, shows: { kind: 'seat', seatId }, effects: effectsFor(seatId) }));
}

export const isLiving = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated);
export const isHurt = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated && s.combinedHp < s.maxCombinedHp);

export function handZoneId(state: GameState, seatId: string): string {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat.hand.zoneId;
}

export function equipZoneId(state: GameState, seatId: string): string {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat.equipped.zoneId;
}

// A seat's hand, then (with `withEquipment`) its worn cards.
export function ownCards(state: GameState, seatId: string, withEquipment: boolean): CardInstance[] {
  const worn = withEquipment ? (state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []) : [];
  return [...handOf(state, seatId), ...worn];
}

// The other living seats, in turn order after `seatId`.
export function otherLivingSeatIds(state: GameState, seatId: string): string[] {
  return livingSeatOrderFrom(state, seatId).filter((id) => id !== seatId);
}

// The cards `seatId` drew last (the latest CardsDrawnEvent for it).
export function lastDrawnBy(state: GameState, seatId: string): string[] {
  const event = [...state.log].reverse().find((e): e is CardsDrawnEvent => e.kind === 'CardsDrawnEvent' && e.seatId === seatId);
  return event?.cardInstanceIds ?? [];
}

// The card that last moved from `fromZoneId` to `toZoneId`, if any.
export function lastMoveBetween(state: GameState, fromZoneId: string, toZoneId: string): string | undefined {
  return [...state.log].reverse().find((e): e is CardMovedEvent => e.kind === 'CardMovedEvent' && e.fromZoneId === fromZoneId && e.toZoneId === toZoneId)?.cardInstanceId;
}

// A General skill's trigger: the owner is always a General's here.
export interface SkillRule<S> {
  condition(state: GameState, subject: S, owner: GeneralOwner, registry: ContentRegistry): boolean;
  effect(state: GameState, subject: S, owner: GeneralOwner, registry: ContentRegistry): Effect[];
}

export function on<S>(point: TriggerPoint, rule: SkillRule<S>): SkillTrigger {
  return {
    point,
    condition: (state, subject, owner, registry) => owner?.kind === 'general' && !!registry && rule.condition(state, subject as S, owner, registry),
    effect: (state, subject, owner, registry) => rule.effect(state, subject as S, owner as GeneralOwner, registry!),
  };
}

interface DrawPhaseRule {
  condition?(state: GameState, draw: DrawPhase, owner: GeneralOwner, registry: ContentRegistry): boolean;
  // What Use does, given the draw marked as having had this skill's say.
  use(state: GameState, passed: DrawPhase, owner: GeneralOwner, registry: ContentRegistry): Effect[];
}

// An optional skill at its owner's Draw Phase draw (Bare the Chest, Brave
// Gesture, Raid): asked once per draw; Don't lets the draw go ahead.
export function atDrawPhase(rule: DrawPhaseRule): SkillTrigger {
  return on<DrawPhase>('before:DrawPhaseEffect', {
    condition: (state, draw, owner, registry) =>
      draw.seatId === owner.seatId && !(draw.acted ?? []).includes(abilityKey(owner)) && (rule.condition?.(state, draw, owner, registry) ?? true),
    effect: (state, draw, owner, registry) => {
      const passed: DrawPhase = { ...draw, acted: [...(draw.acted ?? []), abilityKey(owner)] };
      return [ask(owner, rule.use(state, passed, owner, registry), [passed])];
    },
  });
}
