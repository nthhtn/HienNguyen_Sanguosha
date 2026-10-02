import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { wikiGeneralTabs, wikiGenerals } from 'content';
import { WikiGeneralEntry } from './wiki-general-entry';
import { tabQueryParam } from './tab-param';

@Component({
  selector: 'app-wiki-generals',
  imports: [MatTabsModule, WikiGeneralEntry],
  template: `
    <h2>Generals</h2>
    <p class="summary">{{ generals.length }} generals · {{ withSkills }} with skills in the game</p>
    <mat-tab-group
      [selectedIndex]="tab.selectedIndex()"
      (selectedIndexChange)="tab.select($event)"
      mat-stretch-tabs="false"
      animationDuration="0ms"
    >
      @for (t of tabs; track t.key) {
        <mat-tab [label]="t.label + ' (' + t.entries.length + ')'">
          <ng-template matTabContent>
            @for (general of t.entries; track general.id) {
              <app-wiki-general-entry [general]="general" />
            } @empty {
              <p class="empty">Nothing here yet</p>
            }
          </ng-template>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary, .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class WikiGenerals {
  protected readonly generals = wikiGenerals();
  protected readonly withSkills = this.generals.filter((g) => g.skillsInGame).length;
  protected readonly tabs = wikiGeneralTabs();
  protected readonly tab = tabQueryParam(this.tabs.map((t) => t.key));
}
