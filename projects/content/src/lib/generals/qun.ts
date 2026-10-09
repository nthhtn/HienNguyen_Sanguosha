import type { CardInstance, ContentRegistry, GameState, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { colourFor } from '../shared/suits';
import type { GeneralSkillSet } from './types';
import { handOf } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { seatGender } from '../shared/gender';
import { choiceOf, discardMoves, draw, heal, isHurt, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Qun base Generals' skills (General Skills spec, "Qun"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

const red = (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) => colourFor(state, seatId, card, registry) === 'red';

// Matchless (compulsory): your Sha needs two Shan to dodge (an Eight Trigrams
// red judgment counts as one); in a Duel with you, the other seat plays two Sha
// each time it is its turn to play. Sha and Duel read the modifier.
export const matchless: SkillDefinition = { id: 'matchless', compulsory: true, modifiers: { doubleAnswers: true } };

// First Aid (conversion, respond, only outside your turn): any red card from
// your hand or equipment as a Peach.
export const firstAid: SkillDefinition = {
  id: 'first-aid',
  conversions: [{ id: 'first-aid', as: 'peach', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'respond', outsideOwnTurnOnly: true }],
};

// Living seats below their max HP, you included, in turn order from you.
const hurtSeats = (state: GameState, seatId: string) => livingSeatOrderFrom(state, seatId).filter((id) => isHurt(state, id));

// Green Vesicle (active, once per turn): discard 1 hand card; a seat of your
// choice below its max HP, you included, recovers 1 HP.
export const greenVesicle: SkillDefinition = {
  id: 'green-vesicle',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && hurtSeats(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'cards', eligibleIds: handOf(state, seatId).map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'discarded') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'pick')];
    const seats = hurtSeats(state, owner.seatId);
    return seats.length > 0 ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [heal(id)]) })] : [];
  },
};

// Other living male seats, but `except`.
const males = (state: GameState, seatId: string, registry: ContentRegistry, except: string[] = []) =>
  otherLivingSeatIds(state, seatId).filter((id) => !except.includes(id) && seatGender(state, id, registry) === 'male');

// Seats that can be the first pick: male, a Duel can target them, and another male is left to challenge them.
const challengeable = (state: GameState, seatId: string, registry: ContentRegistry) =>
  males(state, seatId, registry).filter((id) => !untargetableBy(state, id, 'duel', registry) && males(state, seatId, registry, [id]).length > 0);

// The Duel Sow Discord makes: no physical card.
const SOW_DISCORD_DUEL: UsedCard = { as: 'duel', colour: 'none', physical: [] };

// Sow Discord (active, once per turn): discard 1 card and choose two other male
// seats, in order. The second uses a Duel on the first, as if it had played
// one (the usual Wuxie check and Duel rules).
export const sowDiscord: SkillDefinition = {
  id: 'sow-discord',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }, registry) => ownCards(state, seatId, true).length > 0 && challengeable(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }) => {
      const cards = ownCards(state, seatId, true).map((c) => c.instanceId);
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: cards, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] })];
    },
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    switch (step.step) {
      case 'discarded':
        return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'first')];
      case 'first': {
        const firsts = challengeable(state, owner.seatId, registry);
        return firsts.length > 0 ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(firsts, (id) => [skillStep(owner, 'second', { first: id })]) })] : [];
      }
      default: {
        const first = step.data?.['first'] as string;
        const seconds = males(state, owner.seatId, registry, [first]);
        if (!isLiving(state, first) || seconds.length === 0) return [];
        const duelFrom = (id: string) => [{ kind: 'UseCardEffect' as const, seatId: id, card: SOW_DISCORD_DUEL, targets: [{ kind: 'seat' as const, seatId: first }] }];
        return [choiceOf(state, owner, { verb: 'pick', targetSeatId: first, options: seatOptions(seconds, duelFrom) })];
      }
    }
  },
};

// Eclipse the Moon (compulsory): at the start of your End Phase, you draw 1.
export const eclipseTheMoon: SkillDefinition = {
  id: 'eclipse-the-moon',
  compulsory: true,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'End' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 1)],
    }),
  ],
};

export const QUN_GENERALS: GeneralSkillSet[] = [
  { id: 'diao-chan', skills: [sowDiscord, eclipseTheMoon] },
  { id: 'hua-tuo', skills: [firstAid, greenVesicle] },
  { id: 'lu-bu', skills: [matchless] },
];
