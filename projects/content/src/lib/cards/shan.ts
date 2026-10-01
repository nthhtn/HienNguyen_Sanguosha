import type { CardDefinition } from 'engine';

export const shanCard: CardDefinition = {
  id: 'shan',
  name: 'Shan',
  category: 'basic',
  legalPlayTargets: () => [], // response only
  play: () => [],
};
