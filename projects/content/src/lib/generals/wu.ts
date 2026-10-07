import type { CardInstance, CardMovedEvent, PhaseChangedEvent, SkillDefinition } from 'engine';
import { cardsOverHandLimit, colourOf, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { handOf } from '../shared/queries';
import { ask, atDrawPhase, draw, equipZoneId, handZoneId, on, used } from '../shared/skills';

// The Wu base Generals' skills (General Skills spec, "Wu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

// Brave Gesture (may): in your Draw Phase you may draw 1 extra card.
export const braveGesture: SkillDefinition = {
  id: 'brave-gesture',
  triggers: [atDrawPhase({ use: (_state, passed) => [{ ...passed, count: passed.count + 1 }] })],
};

const black = (card: CardInstance) => colourOf(card) === 'black';

// Country Scene (conversion, play): any diamond card from your hand or equipment as a Capture.
export const countryScene: SkillDefinition = {
  id: 'country-scene',
  conversions: [{ id: 'country-scene', as: 'capture', cards: 1, from: 'hand-and-equipment', accepts: (c) => c.suit === 'diamond', when: 'play' }],
};

// Surprise (conversion, play): any black card from your hand or equipment as a Break.
export const surprise: SkillDefinition = {
  id: 'surprise',
  conversions: [{ id: 'surprise', as: 'break', cards: 1, from: 'hand-and-equipment', accepts: black, when: 'play' }],
};

// Humility (compulsory): Steal and Capture can't target you.
export const humility: SkillDefinition = { id: 'humility', compulsory: true, modifiers: { untargetableBy: ['steal', 'capture'] } };

// Linked Camps (compulsory): whenever you lose your last hand card, however it
// happens, you draw 1.
export const linkedCamps: SkillDefinition = {
  id: 'linked-camps',
  compulsory: true,
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) =>
        event.fromZoneId === handZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId && handOf(state, owner.seatId).length === 0,
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 1)],
    }),
  ],
};

// Armed Consorts (compulsory): each time a card leaves your equipment (replaced,
// taken, discarded, or used through a conversion), you draw 2.
export const armedConsorts: SkillDefinition = {
  id: 'armed-consorts',
  compulsory: true,
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) => event.fromZoneId === equipZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId,
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 2)],
    }),
  ],
};

// Self-Restraint (may): if you played or used no Sha this turn, answers
// included, you may skip your Discard Phase. Asked as it begins, and only when
// there is something to discard.
export const selfRestraint: SkillDefinition = {
  id: 'self-restraint',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Discard' &&
        event.seatId === owner.seatId &&
        state.turn.ownerSeatId === owner.seatId &&
        (state.turn.ownerUses?.['sha'] ?? 0) === 0 &&
        cardsOverHandLimit(state, owner.seatId) > 0,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Discard') }])],
    }),
  ],
};

export const WU_GENERALS: GeneralSkillSet[] = [
  { id: 'da-qiao', skills: [countryScene] },
  { id: 'gan-ning', skills: [surprise] },
  { id: 'lu-meng', skills: [selfRestraint] },
  { id: 'lu-xun', skills: [humility, linkedCamps] },
  { id: 'sun-shangxiang', skills: [armedConsorts] },
  { id: 'zhou-yu', skills: [braveGesture] },
];
