import { Component } from '@angular/core';
import { wikiGenerals, WikiGeneral } from 'content';
import { WikiGeneralEntry } from './wiki-general-entry';

const KINGDOMS: readonly WikiGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];

@Component({
  selector: 'app-wiki-generals',
  imports: [WikiGeneralEntry],
  template: `
    <h2>Generals</h2>
    <p class="summary">{{ generals.length }} generals · {{ withSkills }} with skills in the game</p>
    @for (group of groups; track group.kingdom) {
      <section class="group" [attr.data-kingdom]="group.kingdom">
        <h3 class="group-title">{{ group.kingdom }}</h3>
        @for (general of group.generals; track general.id) {
          <app-wiki-general-entry [general]="general" />
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary { color: var(--mat-sys-on-surface-variant); }
    .group-title { margin: 24px 0 0; font: var(--mat-sys-headline-small); }
  `,
})
export class WikiGenerals {
  protected readonly generals = wikiGenerals();
  protected readonly withSkills = this.generals.filter((g) => g.skillsInGame).length;
  protected readonly groups = KINGDOMS.map((kingdom) => ({
    kingdom,
    generals: this.generals.filter((g) => g.kingdom === kingdom),
  })).filter((group) => group.generals.length > 0);
}
