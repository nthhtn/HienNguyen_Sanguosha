import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { wikiCardTabs, wikiCards, WikiCard } from 'content';
import { WikiCardEntry } from './wiki-card-entry';
import { tabQueryParam } from './tab-param';

const PAGE_TITLES: Record<WikiCard['category'], string> = { basic: 'Basic Cards', equipment: 'Equipments', trick: 'Tools' };

// One page per card category; the category comes from the route's data and
// the tabs from content.
@Component({
  selector: 'app-wiki-cards',
  imports: [MatTabsModule, WikiCardEntry],
  template: `
    <h2>{{ title }}</h2>
    <p class="summary">{{ cards.length }} cards · {{ inGame }} in the game</p>
    <mat-tab-group
      [selectedIndex]="tab.selectedIndex()"
      (selectedIndexChange)="tab.select($event)"
      mat-stretch-tabs="false"
      animationDuration="0ms"
    >
      @for (t of tabs; track t.key) {
        <mat-tab [label]="t.label + ' (' + t.entries.length + ')'">
          <ng-template matTabContent>
            @for (card of t.entries; track card.id) {
              <app-wiki-card-entry [card]="card" />
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
export class WikiCards {
  private readonly category = inject(ActivatedRoute).snapshot.data['category'] as WikiCard['category'];
  protected readonly title = PAGE_TITLES[this.category];
  protected readonly cards = wikiCards(this.category);
  protected readonly inGame = this.cards.filter((c) => c.inGame).length;
  protected readonly tabs = wikiCardTabs(this.category);
  protected readonly tab = tabQueryParam(this.tabs.map((t) => t.key));
}
