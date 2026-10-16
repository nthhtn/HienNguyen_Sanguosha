import { Injectable } from '@angular/core';
import type { Msg } from '../i18n/msg';

// One message for the next online screen to show, such as why the Lobby
// closed under you. Taking it clears it, so it shows once.
@Injectable({ providedIn: 'root' })
export class OnlineNotice {
  private pending: Msg | null = null;

  show(notice: Msg): void {
    this.pending = notice;
  }

  take(): Msg | null {
    const text = this.pending;
    this.pending = null;
    return text;
  }
}
