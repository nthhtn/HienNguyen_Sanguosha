import type { MessageKey } from '../../i18n/messages';

// The Rules topics, in the order the index on the left lists them. Overview is the default page.
export const RULES_PAGES: { path: string; label: MessageKey }[] = [
  { path: '/wiki/rules/overview', label: 'nav.rules.overview' },
  { path: '/wiki/rules/setup', label: 'rules.group.setup' },
  { path: '/wiki/rules/turn', label: 'rules.group.turn' },
  { path: '/wiki/rules/attack', label: 'rules.group.attack' },
  { path: '/wiki/rules/judgment', label: 'rules.group.judgment' },
  { path: '/wiki/rules/glossary', label: 'nav.rules.glossary' },
];
