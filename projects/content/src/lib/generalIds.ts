// The Kingdom Wars deck's Generals share the one registry with Identity's; their ids overlap, so they are
// registered under a prefix (`kingdomWars:liu-bei`).
export const KINGDOM_WARS_GENERAL_PREFIX = 'kingdomWars:';

export const kingdomWarsGeneralId = (id: string): string => `${KINGDOM_WARS_GENERAL_PREFIX}${id}`;

export const isKingdomWarsGeneralId = (id: string): boolean => id.startsWith(KINGDOM_WARS_GENERAL_PREFIX);

// The id without the prefix (stripped once); any other id is returned unchanged.
export const baseGeneralId = (id: string): string => (isKingdomWarsGeneralId(id) ? id.slice(KINGDOM_WARS_GENERAL_PREFIX.length) : id);
