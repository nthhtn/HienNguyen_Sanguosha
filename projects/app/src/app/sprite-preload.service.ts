import { Injectable, InjectionToken, inject } from '@angular/core';
import { SPRITE_IDS, spriteSheet } from 'content';

// Starts fetching an image so the browser has it cached before it is needed. A test swaps it for a recorder.
export const IMAGE_PRELOADER = new InjectionToken<(url: string) => void>('IMAGE_PRELOADER', {
  providedIn: 'root',
  factory: () => (url: string) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  },
});

// A seat effect (a Slash hit, the chain, damage) is a CSS background set at the moment of the event, so a sheet that
// nothing fetched earlier arrives after the hit's burst on a slow connection. The game board starts this when it is
// created: all seven sheets (about 0.34 MB together), once per page load, never waiting and never failing the board.
@Injectable({ providedIn: 'root' })
export class SpritePreload {
  private readonly load = inject(IMAGE_PRELOADER);
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    for (const id of SPRITE_IDS) {
      try {
        this.load(spriteSheet(id).url);
      } catch {
        // The effect fetches its own sheet when it plays, as it did before the preload.
      }
    }
  }
}
