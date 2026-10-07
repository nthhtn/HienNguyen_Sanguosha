import type { ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { endFlagOf, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { actedOn, askAtStep, atStep } from '../shared/steps';
import { ask, choiceOf, discardMoves, draw, equipZoneId, heal, isLiving, on, otherLivingSeatIds, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Wind Generals' skills (stage 8 spec, "Rule text"). Every skill acts for
// the `owner` the engine passes in: the same General can sit at two seats in
// tests, so a skill must never find "its" seat by searching for its id.

// Entrench (may): at the start of your End Phase, you may turn your seat face
// down and draw 3 cards.
export const entrench: SkillDefinition = {
  id: 'entrench',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'End' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'TurnFaceDownEffect', seatId: owner.seatId }, draw(owner.seatId, 3)])],
    }),
  ],
};

// Godspeed's Sha: no physical card, outside the Sha limit.
export const GODSPEED_SHA: UsedCard = { as: 'sha', colour: 'none', physical: [] };

// The seats a Sha of `seatId` may target, ignoring distance.
const anyShaTarget = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => !untargetableBy(state, id, 'sha', registry));

// The Equipment cards `seatId` holds or wears.
const equipmentOf = (state: GameState, seatId: string, registry: ContentRegistry) => [
  ...handOf(state, seatId).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment'),
  ...(state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []),
];

// Godspeed (may; each option at most once per turn): skip your Judgment and
// Draw Phases (asked as the turn starts, since the Judgment Phase judges on
// entry), or skip your Play Phase and discard an Equipment card (asked as it
// begins). Either way you use a Sha on any seat a Sha may target, ignoring
// distance.
export const godspeed: SkillDefinition = {
  id: 'godspeed',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) => event.phase === 'Start' && event.seatId === owner.seatId && anyShaTarget(state, owner.seatId, registry).length > 0,
      effect: (_state, _event, owner) => [
        ask(owner, [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Judgment') }, { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Draw') }, skillStep(owner, 'sha')]),
      ],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) =>
        event.phase === 'Play' && event.seatId === owner.seatId && equipmentOf(state, owner.seatId, registry).length > 0 && anyShaTarget(state, owner.seatId, registry).length > 0,
      effect: (state, _event, owner, registry) => [
        ask(owner, [
          selectionOf(state, owner, {
            of: 'cards', eligibleIds: equipmentOf(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
            then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [],
          }),
        ]),
      ],
    }),
  ],
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'discarded') {
      // The Play Phase ends once the Sha is done (endFlagOf).
      return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), { kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }, skillStep(owner, 'sha')];
    }
    const targets = anyShaTarget(state, owner.seatId, registry);
    const shaAt = (seatId: string): Effect[] => [{ kind: 'UseCardEffect', seatId: owner.seatId, card: GODSPEED_SHA, targets: [{ kind: 'seat', seatId }] }];
    return targets.length > 0 && isLiving(state, owner.seatId) ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(targets, shaAt) })] : [];
  },
};

const hpOf = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId)?.combinedHp ?? 0;

// Strong Bow (may): in your turn, after your Sha targets a seat whose hand size
// is at least your HP, or at most your attack range, you may make it
// unblockable.
export const strongBow: SkillDefinition = {
  id: 'strong-bow',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner, registry) => {
        if (owner.kind !== 'general' || step.userSeatId !== owner.seatId || state.turn.ownerSeatId !== owner.seatId) return false;
        const cards = handOf(state, step.target.seatId).length;
        return cards >= hpOf(state, owner.seatId) || cards <= attackRange(state, owner.seatId, registry);
      },
      effect: (_state, step, owner) => {
        const passed = actedOn(step, owner);
        return [askAtStep(owner, 'strong-bow', step, [used(owner as GeneralOwner, 'unblockable', step.target.seatId), { ...passed, data: { ...passed.data, unblockable: true } }])];
      },
    }),
  ],
};

// Violent Spirit (compulsory): after you deal damage to a seat within your
// attack range (measured after the damage), you recover 1 HP per point dealt.
export const violentSpirit: SkillDefinition = {
  id: 'violent-spirit',
  compulsory: true,
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner, registry) => {
        const { source, target, amount } = event.damage;
        return (
          source?.kind === 'seat' && source.seatId === owner.seatId && target.seatId !== owner.seatId && amount > 0 &&
          seatDistance(state, owner.seatId, target.seatId, registry) <= attackRange(state, owner.seatId, registry)
        );
      },
      effect: (_state, event, owner) => [used(owner), heal(owner.seatId, event.damage.amount)],
    }),
  ],
};

export const WIND_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-ren', skills: [entrench] },
  { id: 'xiahou-yuan', skills: [godspeed] },
  { id: 'huang-zhong', skills: [strongBow] },
  { id: 'wei-yan', skills: [violentSpirit] },
];
