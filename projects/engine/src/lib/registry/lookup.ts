import { ContentRegistry, ModeRegistry, CardDefinition, GeneralDefinition, GameModeDefinition } from './types';

export function lookupCard(registry: ContentRegistry, id: string): CardDefinition {
  const card = registry.cards.get(id);
  if (!card) throw new Error(`Unknown card definition id: ${id}`);
  return card;
}

export function lookupGeneral(registry: ContentRegistry, id: string): GeneralDefinition {
  const general = registry.generals.get(id);
  if (!general) throw new Error(`Unknown general definition id: ${id}`);
  return general;
}

export function lookupMode(modes: ModeRegistry, id: string): GameModeDefinition {
  const mode = modes.get(id);
  if (!mode) throw new Error(`Unknown game mode id: ${id}`);
  return mode;
}
