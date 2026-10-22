// The Alternate deck's Generals share the one registry with Default's; their ids overlap, so they are
// registered under a prefix (`alternate:liu-bei`).
export const ALTERNATE_GENERAL_PREFIX = 'alternate:';

export const alternateGeneralId = (id: string): string => `${ALTERNATE_GENERAL_PREFIX}${id}`;

export const isAlternateGeneralId = (id: string): boolean => id.startsWith(ALTERNATE_GENERAL_PREFIX);

// The id without the prefix (stripped once); any other id is returned unchanged.
export const baseGeneralId = (id: string): string => (isAlternateGeneralId(id) ? id.slice(ALTERNATE_GENERAL_PREFIX.length) : id);
