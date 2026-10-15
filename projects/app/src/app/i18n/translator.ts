import { en } from './en';
import { format } from './format';
import type { MessageKey, MessageParams, Messages } from './messages';

// What a builder is handed to turn a key into text. I18n.translator is the live
// one; englishTranslator is every builder's default, so callers that pass none
// get today's English.
export type Translator = (key: MessageKey, params?: MessageParams) => string;

export const makeTranslator =
  (messages: Messages): Translator =>
  (key, params) =>
    format(messages[key], params);

export const englishTranslator: Translator = makeTranslator(en);
