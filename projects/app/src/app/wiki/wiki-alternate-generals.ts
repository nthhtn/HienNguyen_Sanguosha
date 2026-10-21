import { Component, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { wikiAlternateGeneralTabs, wikiAlternateGenerals } from 'content';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { WikiAlternateGeneralEntry } from './wiki-alternate-general-entry';
import { tabQueryParam } from './tab-param';
import { wikiTabLabel } from './wiki-labels';

@Component({
  selector: 'app-wiki-alternate-generals',
  imports: [MatTabsModule, WikiAlternateGeneralEntry, TPipe],
  template: `
    <h2>{{ 'wiki.page.generals' | t }}</h2>
    <p class="deck-line">{{ 'lobby.deckSummary' | t: { deck: 'setup.deck.alternate' | t } }}</p>
    <p class="summary">{{ 'wiki.alternateGenerals.summary' | t: { count: generals.length, withDefault } }}</p>
    <mat-tab-group
      [selectedIndex]="tab.selectedIndex()"
      (selectedIndexChange)="tab.select($event)"
      mat-stretch-tabs="false"
      animationDuration="0ms"
    >
      @for (t of tabs; track t.key) {
        <mat-tab [label]="tabLabel(t) + ' (' + t.entries.length + ')'">
          <ng-template matTabContent>
            @for (general of t.entries; track general.id) {
              <app-wiki-alternate-general-entry [general]="general" />
            } @empty {
              <p class="empty">{{ 'wiki.empty' | t }}</p>
            }
          </ng-template>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary, .empty, .deck-line { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class WikiAlternateGenerals {
  private readonly i18n = inject(I18n);
  protected readonly generals = wikiAlternateGenerals();
  protected readonly withDefault = this.generals.filter((g) => g.skillsRunAsDefault).length;
  protected readonly tabs = wikiAlternateGeneralTabs();
  protected readonly tab = tabQueryParam(this.tabs.map((t) => t.key));

  protected tabLabel(t: { key: string; label: string }): string {
    return wikiTabLabel(t, this.i18n.translator);
  }
}
