import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { wikiCards, WikiCard } from 'content';
import { WikiCardEntry } from './wiki-card-entry';

const PAGE_TITLES: Record<WikiCard['category'], string> = { basic: 'Basic Cards', equipment: 'Equipments', trick: 'Tools' };
const SUBTYPE_TITLES: Record<NonNullable<WikiCard['subtype']>, string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  horse: 'Horses',
  treasure: 'Treasure',
};

// One page per card category; the category comes from the route's data.
@Component({
  selector: 'app-wiki-cards',
  imports: [WikiCardEntry],
  template: `
    <h2>{{ title }}</h2>
    <p class="summary">{{ cards.length }} cards · {{ inGame }} in the game</p>
    @for (group of groups; track group.title) {
      <section class="group">
        @if (group.title) {
          <h3 class="group-title">{{ group.title }}</h3>
        }
        @for (card of group.cards; track card.id) {
          <app-wiki-card-entry [card]="card" />
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
export class WikiCards {
  private readonly category = inject(ActivatedRoute).snapshot.data['category'] as WikiCard['category'];
  protected readonly title = PAGE_TITLES[this.category];
  protected readonly cards = wikiCards(this.category);
  protected readonly inGame = this.cards.filter((c) => c.inGame).length;
  // Equipment splits by subtype (already ordered by content); other categories are one list.
  protected readonly groups: { title: string; cards: WikiCard[] }[] =
    this.category === 'equipment'
      ? [...new Set(this.cards.map((c) => c.subtype!))].map((subtype) => ({
          title: SUBTYPE_TITLES[subtype],
          cards: this.cards.filter((c) => c.subtype === subtype),
        }))
      : [{ title: '', cards: this.cards }];
}
