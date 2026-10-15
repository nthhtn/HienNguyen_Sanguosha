import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18n } from './i18n.service';
import type { MessageKey, MessageParams } from './messages';

// {{ 'some.key' | t }} or {{ 'some.key' | t: { n: 2 } }}. Impure on purpose: a
// pure pipe would not run again when only the language changes, and the signal
// read inside I18n.t is what schedules the re-render.
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18n);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}
