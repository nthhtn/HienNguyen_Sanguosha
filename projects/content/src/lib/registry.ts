import type { ContentRegistry, GeneralDefinition } from 'engine';
import { generalsData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { shaCard } from './cards/sha';
import { shanCard } from './cards/shan';
import { peachCard } from './cards/peach';
import { duelCard } from './cards/duel';
import { wuxieCard } from './cards/wuxie';
import { drawTwoCard } from './cards/draw-two';
import { barbariansCard, hailOfArrowsCard } from './cards/mass-attack';
import { peachGardenCard } from './cards/peach-garden';
import { silverLionCard, greenDragonBladeCard } from './cards/equipment';

function buildGenerals(): GeneralDefinition[] {
  const generals: GeneralDefinition[] = [];
  for (const [id, data] of Object.entries(generalsData)) {
    // maxHp is load-bearing for combined HP, so a general without one stays out
    // of play rather than silently defaulting.
    if (data.maxHp === null) {
      console.warn(`Excluding general "${id}" from registry: maxHp not yet known.`);
      continue;
    }
    generals.push({ id, kingdom: data.kingdom, maxHp: data.maxHp, skills: GENERAL_SKILLS.get(id) ?? [] });
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
  const cards = [shaCard, shanCard, peachCard, duelCard, wuxieCard, drawTwoCard, barbariansCard, hailOfArrowsCard, peachGardenCard, silverLionCard, greenDragonBladeCard];
  const generals = buildGenerals();
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    generals: new Map(generals.map((g) => [g.id, g])),
  };
}
