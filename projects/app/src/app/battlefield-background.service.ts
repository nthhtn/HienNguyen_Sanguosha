import { Injectable, signal } from '@angular/core';

// The battlefield's look, picked from the Battlefield menu: the original brown
// table, or one of the pictures in content/assets/misc/battlefield.
export const BATTLEFIELD_BACKGROUNDS = ['default', '1', '2', '3'] as const;
export type BattlefieldBackground = (typeof BATTLEFIELD_BACKGROUNDS)[number];

const KEY = 'battlefield-background';

// The CSS background of a picture; null for the default, which the table's own style draws.
export const battlefieldBackgroundCss = (choice: BattlefieldBackground): string | null =>
  choice === 'default' ? null : `url('/card-art/misc/battlefield/${choice}.jpg') center / cover no-repeat`;

// A per-viewer convenience: storage can be missing or blocked, so fall back to the default.
@Injectable({ providedIn: 'root' })
export class BattlefieldBackgrounds {
  readonly choice = signal<BattlefieldBackground>(read());

  // Whether a battlefield is on screen: the Battlefield menu is offered only then.
  readonly available = signal(false);

  select(choice: BattlefieldBackground): void {
    this.choice.set(choice);
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  }
}

function read(): BattlefieldBackground {
  try {
    const stored = localStorage.getItem(KEY);
    return BATTLEFIELD_BACKGROUNDS.find((b) => b === stored) ?? 'default';
  } catch {
    return 'default';
  }
}
