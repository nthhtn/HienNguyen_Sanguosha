import { kingdomWarsGeneralDisplayData, cardDisplayData, generalDisplayData } from 'content';
import type { WikiKingdomWarsGeneral, WikiCard, WikiGeneral, WikiTab } from 'content';
import type { MessageKey } from '../i18n/messages';
import { SOURCE_LOCALE } from '../i18n/locales';
import type { Translator } from '../i18n/translator';
import { localeOf } from '../i18n/translator';

// The Wiki's own names and texts are the content library's English ones. These
// helpers show a language's version of them and fall back to English for a
// piece that language lacks, so the library itself never sees a locale.

const TAB_KEYS: Record<string, MessageKey> = {
  wei: 'label.kingdom.Wei',
  shu: 'label.kingdom.Shu',
  wu: 'label.kingdom.Wu',
  qun: 'label.kingdom.Qun',
  weapons: 'wiki.tab.weapons',
  armors: 'wiki.tab.armors',
  'defensive-mount': 'wiki.tab.defensive-mount',
  'offensive-mount': 'wiki.tab.offensive-mount',
  'other-mounts': 'wiki.tab.other-mounts',
  treasures: 'wiki.tab.treasures',
  instant: 'wiki.tab.instant',
  delayed: 'wiki.tab.delayed',
  other: 'wiki.tab.other',
};

// A tab's label. A tab named after a card (Sha, Peach...) takes the card's name.
export function wikiTabLabel(tab: Pick<WikiTab<unknown>, 'key' | 'label'>, tr: Translator): string {
  const locale = localeOf(tr);
  if (locale === SOURCE_LOCALE) return tab.label;
  const key = Object.prototype.hasOwnProperty.call(TAB_KEYS, tab.key) ? TAB_KEYS[tab.key] : undefined;
  return (key ? tr(key) : undefined) ?? cardDisplayData(tab.key, locale)?.name ?? tab.label;
}

export function wikiCardView(card: WikiCard, locale: string): { name: string; text: string | null } {
  const display = locale === SOURCE_LOCALE ? null : cardDisplayData(card.id, locale);
  return { name: display?.name ?? card.name, text: display?.text ?? card.text };
}

export interface WikiGeneralView {
  name: string;
  title: string | null;
  skills: { name: string; text: string }[];
}

// The skills are in the data file's order in both the Wiki's and the display data.
export function wikiGeneralView(general: WikiGeneral, locale: string): WikiGeneralView {
  const display = locale === SOURCE_LOCALE ? null : generalDisplayData(general.id, locale);
  return {
    name: display?.name ?? general.name,
    title: display?.title ?? general.title,
    skills: general.skills.map((skill, i) => ({ name: display?.skills[i]?.name ?? skill.name, text: display?.skills[i]?.text ?? skill.text })),
  };
}

export interface WikiKingdomWarsGeneralView extends WikiGeneralView {
  differenceNote: string | null;
  partners: string[];
}

// A Kingdom Wars General in a language: the Kingdom Wars file's own text, never Identity's, with English for any piece it lacks.
export function wikiKingdomWarsGeneralView(general: WikiKingdomWarsGeneral, locale: string): WikiKingdomWarsGeneralView {
  const display = locale === SOURCE_LOCALE ? null : kingdomWarsGeneralDisplayData(general.id, locale);
  return {
    name: display?.name ?? general.name,
    title: display?.title ?? general.title,
    skills: general.skills.map((skill, i) => ({ name: display?.skills[i]?.name ?? skill.name, text: display?.skills[i]?.text ?? skill.text })),
    differenceNote: display?.differenceNote ?? general.differenceNote,
    partners: display?.partners ?? general.partners,
  };
}

const PACK_KEYS: Record<string, MessageKey> = {
  Base: 'wiki.pack.Base',
  EX: 'wiki.pack.EX',
  Army: 'wiki.pack.Army',
  Wind: 'wiki.pack.Wind',
  Fire: 'wiki.pack.Fire',
  Forest: 'wiki.pack.Forest',
  Mountain: 'wiki.pack.Mountain',
};

export function wikiPackLabel(pack: string, tr: Translator): string {
  return Object.prototype.hasOwnProperty.call(PACK_KEYS, pack) ? tr(PACK_KEYS[pack]) : pack;
}
