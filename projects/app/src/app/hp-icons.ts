import { Component, computed, input } from '@angular/core';
import { hpIconUrls } from 'content';

// A row of HP icons: one per HP, up to `max`, in the HP ramp's colours.
// - Icons from `hp` up to `max` are dimmed as lost.
// - The `fading` icons just below `hp` are dimmed too and pop, for a loss still playing.
// Decorative: the parent carries the accessible label.
@Component({
  selector: 'app-hp-icons',
  template: `
    @for (icon of icons(); track $index) {
      <img [class.lost]="icon.lost" [class.pop]="icon.fading" [src]="icon.url" alt="" aria-hidden="true" [style.height.px]="size()" />
    }
  `,
  styles: `
    :host { display: inline-flex; gap: 1px; align-items: center; vertical-align: middle; }
    img { width: auto; transition: filter 0.3s, opacity 0.3s; }
    .lost { filter: grayscale(1) brightness(0.6); opacity: 0.5; }
    .pop { animation: pop 0.5s; }
    @keyframes pop { 0% { transform: scale(1); } 40% { transform: scale(1.35); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { img { transition: none; } .pop { animation: none; } }
  `,
})
export class HpIcons {
  readonly hp = input.required<number>();
  readonly max = input<number | null | undefined>();
  readonly fading = input(0);
  readonly size = input(20);

  protected readonly icons = computed(() => {
    const hp = this.hp();
    return hpIconUrls(Math.max(this.max() ?? hp, hp)).map((url, i) => ({
      url,
      lost: i >= hp - this.fading(),
      fading: i >= hp - this.fading() && i < hp,
    }));
  });
}
