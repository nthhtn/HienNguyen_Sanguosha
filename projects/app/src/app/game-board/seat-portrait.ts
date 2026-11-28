import { Component, computed, inject, input, signal } from '@angular/core';
import { SeatGenerals } from 'engine';
import { HIDDEN_GENERAL_ART_URL, generalSkinUrl } from 'content';
import { ArtSets } from '../art-sets.service';

const HIDDEN_ID = 'hidden';

// One seat's Generals as a small split portrait, Main left and Deputy right, for a picker option. Plain
// pictures: unlike SeatAvatar it has no buttons, so it can sit inside an option button. A General still
// face down, or a seat with no General known, shows the card back. The border takes `--force` from the
// enclosing element.
@Component({
  selector: 'app-seat-portrait',
  template: `
    <div class="frame" [class.medium]="size() === 'medium'" [class.fill]="size() === 'fill'">
      @for (url of urls(); track $index) {
        <span class="half">
          <img [src]="url" alt="" (error)="markFailed(url)" />
        </span>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; max-width: 100%; line-height: 0; overflow: hidden; }
    .frame {
      display: flex; width: 72px; height: 52px; border: 2px solid var(--force, var(--force-none));
      border-radius: 8px; overflow: hidden; box-sizing: border-box; background: #f1ece2; contain: layout paint;
    }
    .frame.medium { width: 104px; height: 76px; }
    .frame.fill { width: 100%; height: 92px; }
    :host(.fill-host) { display: block; }
    /* The phone board (spec 3h): picker cells are often wider than 104 px; scale the frame, keep aspect. */
    :host-context([data-layout='compact']) {
      display: block; width: 100%; max-width: 104px; margin-inline: auto;
    }
    :host-context([data-layout='compact']) .frame.medium {
      width: 100%; height: auto; aspect-ratio: 400 / 290; max-height: 76px;
    }
    .half { display: block; flex: 1 1 0; min-width: 0; min-height: 0; overflow: hidden; position: relative; }
    .half + .half { border-left: 1px solid rgb(0 0 0 / 35%); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  `,
})
export class SeatPortrait {
  readonly generals = input<SeatGenerals | null>(null);
  readonly size = input<'small' | 'medium' | 'fill'>('medium');

  private readonly artSets = inject(ArtSets);
  private readonly failed = signal<ReadonlySet<string>>(new Set());

  protected readonly urls = computed(() => {
    const generals = this.generals();
    const ids = generals ? [generals.main.generalDefinitionId, generals.deputy.generalDefinitionId] : [HIDDEN_ID, HIDDEN_ID];
    const choice = this.artSets.choice();
    return ids.map((id) => {
      const url = id === HIDDEN_ID ? null : generalSkinUrl(id, choice);
      return url && !this.failed().has(url) ? url : HIDDEN_GENERAL_ART_URL;
    });
  });

  protected markFailed(url: string): void {
    this.failed.update((urls) => new Set(urls).add(url));
  }
}
