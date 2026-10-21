import type { ContentRegistry, GeneralDefinition } from 'engine';
import { generalsData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { fireAttackCard, lightningAttackCard, shaCard } from './cards/sha';
import { shanCard } from './cards/shan';
import { peachCard } from './cards/peach';
import { wineCard } from './cards/wine';
import { duelCard } from './cards/duel';
import { wuxieCard } from './cards/wuxie';
import { wuxieGuoCard } from './cards/wuxie-guo';
import { drawTwoCard } from './cards/draw-two';
import { barbariansCard, hailOfArrowsCard } from './cards/mass-attack';
import { peachGardenCard } from './cards/peach-garden';
import { stealCard } from './cards/steal';
import { breakCard } from './cards/break';
import { harvestCard } from './cards/harvest';
import { coerceCard } from './cards/coerce';
import { captureCard } from './cards/capture';
import { starvationCard } from './cards/starvation';
import { lightningCard } from './cards/lightning';
import { silverLionCard, horseCards, crossbowCard, blackPommelCard } from './cards/equipment';
import { greenDragonBladeCard } from './cards/equipment/green-dragon-blade';
import { axeCard } from './cards/equipment/axe';
import { skyScorcherCard } from './cards/equipment/sky-scorcher';
import { blazeCard } from './cards/blaze';
import { chainsCard } from './cards/chains';
import { serpentSpearCard } from './cards/equipment/serpent-spear';
import { eightTrigramsCard } from './cards/equipment/eight-trigrams';
import { blackShieldCard } from './cards/equipment/black-shield';
import { woodArmorCard } from './cards/equipment/wood-armor';
import { genderSwordsCard } from './cards/equipment/gender-swords';
import { ancientScimitarCard } from './cards/equipment/ancient-scimitar';
import { iceSwordCard } from './cards/equipment/ice-sword';
import { wuSixSwordsCard } from './cards/equipment/wu-six-swords';
import { tridentGlaiveCard } from './cards/equipment/trident-glaive';
import { longbowCard } from './cards/equipment/longbow';

function buildGenerals(): GeneralDefinition[] {
  const generals: GeneralDefinition[] = [];
  for (const [id, data] of Object.entries(generalsData)) {
    // maxHp is load-bearing for combined HP, so a general without one stays out
    // of play rather than silently defaulting.
    if (data.maxHp === null) {
      console.warn(`Excluding general "${id}" from registry: maxHp not yet known.`);
      continue;
    }
    generals.push({ id, kingdom: data.kingdom, maxHp: data.maxHp, gender: data.gender, skills: GENERAL_SKILLS.get(id) ?? [] });
  }
  // Skill logic with no data file would silently never be playable.
  for (const id of GENERAL_SKILLS.keys()) {
    if (!generals.some((g) => g.id === id)) {
      throw new Error(`Hand-coded skills exist for general "${id}" but it has no data file`);
    }
  }
  return generals;
}

export function buildContentRegistry(): ContentRegistry {
  const cards = [shaCard, fireAttackCard, lightningAttackCard, shanCard, peachCard, wineCard, duelCard, wuxieCard, drawTwoCard, barbariansCard, hailOfArrowsCard, peachGardenCard, stealCard, breakCard, harvestCard, coerceCard, captureCard, starvationCard, lightningCard, silverLionCard, greenDragonBladeCard, ...horseCards, crossbowCard, blackPommelCard, eightTrigramsCard, blackShieldCard, woodArmorCard, genderSwordsCard, ancientScimitarCard, iceSwordCard, longbowCard, axeCard, skyScorcherCard, serpentSpearCard, blazeCard, chainsCard, wuSixSwordsCard, tridentGlaiveCard, wuxieGuoCard];
  const generals = buildGenerals();
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    generals: new Map(generals.map((g) => [g.id, g])),
  };
}

let natureRegistry: ContentRegistry | undefined;

// The element an elemental card carries (Fire Attack: fire, Lightning Attack:
// thunder), for the UI to mark it; null for any other card.
export function cardNature(id: string): 'fire' | 'thunder' | null {
  natureRegistry ??= buildContentRegistry();
  return natureRegistry.cards.get(id)?.nature ?? null;
}
