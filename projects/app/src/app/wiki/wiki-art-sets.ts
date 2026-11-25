import { Component, computed, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { ArtSetsByGeneral } from './art-sets-by-general';
import { ArtSetsBySet } from './art-sets-by-set';
import { tabQueryParam } from './tab-param';

// Every art set to look at, then choose from: By Set (each set's gallery) and By General (one General's artwork across sets).
@Component({
  selector: 'app-wiki-art-sets',
  imports: [MatTabsModule, ArtSetsBySet, ArtSetsByGeneral, TPipe],
  template: `
    <h2>{{ 'artSetsPage.title' | t }}</h2>
    <p class="intro">{{ 'artSetsPage.intro' | t }}</p>
    <mat-tab-group [selectedIndex]="tab.selectedIndex()" (selectedIndexChange)="tab.select($event)" mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab [label]="labels().sets">
        <ng-template matTabContent><app-art-sets-by-set /></ng-template>
      </mat-tab>
      <mat-tab [label]="labels().generals">
        <ng-template matTabContent><app-art-sets-by-general /></ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .intro { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class WikiArtSets {
  private readonly i18n = inject(I18n);
  protected readonly tab = tabQueryParam(['sets', 'generals']);
  protected readonly labels = computed(() => ({ sets: this.i18n.t('artSetsPage.tab.sets'), generals: this.i18n.t('artSetsPage.tab.generals') }));
}
