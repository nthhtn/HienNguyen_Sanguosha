import type { MessageKey } from '../../i18n/messages';

// The Rules topics, in the order the index on the left lists them. Overview is the default page.
export const RULES_PAGES: { path: string; label: MessageKey }[] = [
  { path: '/wiki/rules/overview', label: 'nav.rules.overview' },
  { path: '/wiki/rules/setup', label: 'nav.rules.setup' },
  { path: '/wiki/rules/allegiance', label: 'nav.rules.allegiance' },
  { path: '/wiki/rules/turn', label: 'nav.rules.turn' },
  { path: '/wiki/rules/card-types', label: 'nav.rules.cardTypes' },
  { path: '/wiki/rules/distance', label: 'nav.rules.distance' },
  { path: '/wiki/rules/response', label: 'nav.rules.response' },
  { path: '/wiki/rules/damage', label: 'nav.rules.damage' },
  { path: '/wiki/rules/judgment', label: 'nav.rules.judgment' },
  { path: '/wiki/rules/chains', label: 'nav.rules.chains' },
  { path: '/wiki/rules/glossary', label: 'nav.rules.glossary' },
];
