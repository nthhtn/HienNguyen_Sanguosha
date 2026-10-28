import { Component, inject } from '@angular/core';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { DEFAULT_DECK_ID, wikiCardTabs, wikiCards, WikiCard } from 'content';
import type { DeckId } from 'content';
import { WikiCardEntry } from './wiki-card-entry';
import { tabQueryParam } from './tab-param';
import { wikiTabLabel } from './wiki-labels';

const PAGE_TITLES: Record<WikiCard['category'], MessageKey> = { basic: 'wiki.page.basic', equipment: 'wiki.page.equipment', tool: 'wiki.page.tool' };

// One page per card category; the category comes from the route's data and
// the tabs from content.
@Component({
  selector: 'app-wiki-cards',
  imports: [MatTabsModule, WikiCardEntry, TPipe],
  template: `
    <h2>{{ title | t }}</h2>
    <p class="deck-line">{{ 'lobby.deckSummary' | t: { deck: deckName | t } }}</p>
    <p class="summary">{{ 'wiki.cards.summary' | t: { count: cards.length, inGame } }}</p>
    @if (flat) {
      @for (card of ordered; track card.id) {
        <app-wiki-card-entry [card]="card" />
      }
    } @else {
    <mat-tab-group
      [selectedIndex]="tab.selectedIndex()"
      (selectedIndexChange)="tab.select($event)"
      mat-stretch-tabs="false"
      animationDuration="0ms"
    >
      @for (t of tabs; track t.key) {
        <mat-tab [label]="tabLabel(t) + ' (' + t.entries.length + ')'">
          <ng-template matTabContent>
            @for (card of t.entries; track card.id) {
              <app-wiki-card-entry [card]="card" />
            } @empty {
              <p class="empty">{{ 'wiki.empty' | t }}</p>
            }
          </ng-template>
        </mat-tab>
      }
    </mat-tab-group>
    }
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary, .empty, .deck-line { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class WikiCards {
  private readonly i18n = inject(I18n);
  private readonly category = inject(ActivatedRoute).snapshot.data['category'] as WikiCard['category'];
  // The deck comes from the route's data; the default deck when a route names none.
  private readonly deck = (inject(ActivatedRoute).snapshot.data['deck'] ?? DEFAULT_DECK_ID) as DeckId;
  protected readonly title = PAGE_TITLES[this.category];
  protected readonly deckName: MessageKey = this.deck === 'kingdomWars' ? 'setup.deck.kingdomWars' : 'setup.deck.identity';
  protected readonly cards = wikiCards(this.category, this.deck);
  // The list in the order the cards are meant to read.
  protected readonly ordered = this.category === 'basic' ? wikiCardTabs('basic', this.deck).flatMap((t) => t.entries) : this.cards;
  protected readonly inGame = this.cards.filter((c) => c.inGame).length;
  // Basic Cards are only six: one list, no tabs.
  protected readonly flat = this.category === 'basic';
  protected readonly tabs = this.flat ? [] : wikiCardTabs(this.category, this.deck);
  protected readonly tab = tabQueryParam(this.tabs.map((t) => t.key));

  protected tabLabel(t: { key: string; label: string }): string {
    return wikiTabLabel(t, this.i18n.translator);
  }
}
