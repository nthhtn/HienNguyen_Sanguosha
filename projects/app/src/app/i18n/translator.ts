import { en } from './en';
import { format } from './format';
import type { MessageKey, MessageParams, Messages } from './messages';

// What a builder is handed to turn a key into text. I18n.translator is the live
// one; englishTranslator is every builder's default, so callers that pass none
// get today's English. `locale` names the language it speaks, for the prose that
// lives outside the catalog (the content package's per-language tables).
export type Translator = ((key: MessageKey, params?: MessageParams) => string) & { readonly locale?: string };

export const makeTranslator = (messages: Messages, locale = 'en'): Translator =>
  Object.assign((key: MessageKey, params?: MessageParams) => format(messages[key], params), { locale });

export const englishTranslator: Translator = makeTranslator(en);

// The language a translator speaks; English when it says nothing.
export const localeOf = (tr: Translator): string => tr.locale ?? 'en';
