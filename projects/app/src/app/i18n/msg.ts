import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18n } from './i18n.service';
import type { MessageKey, MessageParams } from './messages';
import type { Translator } from './translator';

// A message a service hands to a screen: a catalog key to translate when it is
// shown (so a language switch re-renders it), or text that has no key (a
// server message this version does not know). `detail` is raw technical text
// that stays as it is.
export type Msg = { key: MessageKey; params?: MessageParams; detail?: string } | { text: string; detail?: string };

export const msg = (key: MessageKey, params?: MessageParams): Msg => (params ? { key, params } : { key });

export function resolveMsg(message: Msg, tr: Translator): string {
  return 'key' in message ? tr(message.key, message.params) : message.text;
}

// {{ error() | tm }}. Impure for the same reason as the t pipe.
@Pipe({ name: 'tm', pure: false })
export class TMsgPipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(message: Msg | null | undefined): string {
    return message ? resolveMsg(message, this.i18n.translator) : '';
  }
}
