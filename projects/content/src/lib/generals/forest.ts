import type { CardInstance, CardsTurnedUpEvent, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { requireZoneOfKind } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { competeStart, competeStep } from '../shared/compete';
import { colourFor } from '../shared/suits';
import { abilityKey } from '../shared/steps';
import { seatCardOptions } from '../shared/choices';
import { shaAt } from '../cards/sha';
import { ask, atDrawPhase, choiceOf, discardMoves, draw, handZoneId, heal, hpOf, isHurt, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Forest Generals' skills (stage 10 spec, "Rule text"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const picked = (step: { data?: Record<string, unknown> }) => (step.data?.['picked'] as string[] | undefined) ?? [];

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
type DiscardZone = Extract<Effect, { kind: 'DiscardZoneEffect' }>;
type ToolResolved = Extract<Effect, { kind: 'ToolResolvedEffect' }>;
type ToolOnTarget = Extract<Effect, { kind: 'ToolOnTargetEffect' }>;

// The HP `seatId` is missing.
const missingHp = (state: GameState, seatId: string) => {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat ? Math.max(0, seat.maxCombinedHp - seat.combinedHp) : 0;
};

// Exaltation and Violent Tyrant: Lord skills, inactive in Kingdom War.
export const exaltation: SkillDefinition = { id: 'exaltation', lord: true };
export const violentTyrant: SkillDefinition = { id: 'violent-tyrant', lord: true };

export const FOREST_GENERALS: GeneralSkillSet[] = [];
