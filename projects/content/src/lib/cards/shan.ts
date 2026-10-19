import type { CardDefinition } from 'engine';

export const shanCard: CardDefinition = {
  id: 'shan',
  name: 'Dodge',
  category: 'basic',
  legalPlayTargets: () => [], // response only
  play: () => [],
};
