import { Injectable } from '@angular/core';

// One message for the next online screen to show, such as why the Lobby
// closed under you. Taking it clears it, so it shows once.
@Injectable({ providedIn: 'root' })
export class OnlineNotice {
  private pending: string | null = null;

  show(text: string): void {
    this.pending = text;
  }

  take(): string | null {
    const text = this.pending;
    this.pending = null;
    return text;
  }
}
