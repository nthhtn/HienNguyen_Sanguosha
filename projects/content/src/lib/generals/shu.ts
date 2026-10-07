import type { CardInstance, SkillDefinition } from 'engine';
import { colourOf } from 'engine';
import type { GeneralSkillSet } from './types';

// The Shu base Generals' skills (General Skills spec, "Shu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

const red = (card: CardInstance) => colourOf(card) === 'red';

// Roar (compulsory): there is no limit on how many Sha you play.
export const roar: SkillDefinition = { id: 'roar', compulsory: true, modifiers: { shaLimit: Number.POSITIVE_INFINITY } };

// Horsemanship (compulsory): your distance to every other seat is 1 smaller, never below 1.
export const horsemanship: SkillDefinition = { id: 'horsemanship', compulsory: true, modifiers: { distanceToOthers: -1 } };

// Empty City (compulsory): while you have no hand cards, Sha and Duel can't target you.
export const emptyCity: SkillDefinition = { id: 'empty-city', compulsory: true, modifiers: { untargetableWithEmptyHandBy: ['sha', 'duel'] } };

// Wondrous Talent (compulsory): your Tools ignore distance (Steal, Starvation).
export const wondrousTalent: SkillDefinition = { id: 'wondrous-talent', compulsory: true, modifiers: { toolsIgnoreDistance: true } };

// Fighting Saint (conversion, play and respond): any red card from your hand
// or equipment as a Sha.
export const fightingSaint: SkillDefinition = {
  id: 'fighting-saint',
  conversions: [{ id: 'fighting-saint', as: 'sha', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'both' }],
};

// Dragon Courage (conversion, play and respond): a Shan as a Sha, and a Sha as a Shan.
export const dragonCourage: SkillDefinition = {
  id: 'dragon-courage',
  conversions: [
    { id: 'shan-as-sha', as: 'sha', cards: 1, accepts: (c) => c.definitionId === 'shan', when: 'both' },
    { id: 'sha-as-shan', as: 'shan', cards: 1, accepts: (c) => c.definitionId === 'sha', when: 'respond' },
  ],
};

export const SHU_GENERALS: GeneralSkillSet[] = [
  { id: 'guan-yu', skills: [fightingSaint] },
  { id: 'zhang-fei', skills: [roar] },
  { id: 'zhao-yun', skills: [dragonCourage] },
  { id: 'ma-chao', skills: [horsemanship] },
  { id: 'zhuge-liang', skills: [emptyCity] },
  { id: 'huang-yueying', skills: [wondrousTalent] },
];
