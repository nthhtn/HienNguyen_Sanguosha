import { Component, computed, inject } from '@angular/core';
import { generalDisplayData, kingdomBannerUrl } from 'content';
import { I18n } from '../../i18n/i18n.service';
import type { MessageKey } from '../../i18n/messages';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneFrame } from './scene/scene-frame';
import { SceneGeneral } from './scene/scene-general';
import { SceneSeat } from './scene/scene-seat';

// The General that stands for each Force in the Forces scene.
const FORCES = [
  { force: 'Wei', general: 'cao-cao' },
  { force: 'Shu', general: 'liu-bei' },
  { force: 'Wu', general: 'sun-quan' },
  { force: 'Qun', general: 'zhang-jiao' },
] as const;

@Component({
  selector: 'app-rules-overview',
  imports: [RichText, TPipe, SceneFrame, SceneGeneral, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.overview' | t }}</h2>
    <p class="lead">{{ 'rules.overview.lead' | t }}</p>
    <p><app-rich key="rules.overview.intro" /></p>
    <app-scene caption="rules.overview.forcesCap">
      <div class="forces">
        @for (row of forces(); track row.force) {
          <figure [attr.data-force]="row.force">
            @if (row.banner; as banner) {
              <img class="banner" [src]="banner" alt="" />
            }
            <app-scene-general [id]="row.general" size="normal" />
            <figcaption><b>{{ row.forceKey | t }}</b> {{ row.name }}</figcaption>
          </figure>
        }
      </div>
    </app-scene>
    <h3>{{ 'rules.overview.beats' | t }}</h3>
    <ol class="steps">
      @for (beat of beats; track beat) {
        <li>
          <div class="body">
            <p><b>{{ beatTitleKey(beat) | t }}.</b> <app-rich [key]="beatKey(beat)" /></p>
          </div>
        </li>
      }
    </ol>
    <h3>{{ 'rules.overview.winning' | t }}</h3>
    <ul>
      <li><app-rich key="rules.overview.win1" /></li>
      <li><app-rich key="rules.overview.win2" /></li>
      <li><app-rich key="rules.overview.win3" /></li>
      <li><app-rich key="rules.overview.win4" /></li>
    </ul>
    <app-scene caption="rules.overview.winExampleCap">
      <div class="scene-row center">
        <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
        <app-scene-seat general="zhang-liao" [n]="3" force="Wei" />
        <app-scene-seat general="liu-bei" [n]="2" [out]="true" />
        <app-scene-seat general="sun-quan" [n]="4" [out]="true" />
      </div>
      <p><app-rich key="rules.overview.winExample" /></p>
    </app-scene>
    <h3>{{ 'rules.overview.next' | t }}</h3>
    <ul>
      <li><app-rich key="rules.overview.next.setup" /></li>
      <li><app-rich key="rules.overview.next.allegiance" /></li>
      <li><app-rich key="rules.overview.next.turn" /></li>
      <li><app-rich key="rules.overview.next.cardTypes" /></li>
      <li><app-rich key="rules.overview.next.distance" /></li>
      <li><app-rich key="rules.overview.next.response" /></li>
      <li><app-rich key="rules.overview.next.damage" /></li>
      <li><app-rich key="rules.overview.next.judgment" /></li>
      <li><app-rich key="rules.overview.next.chains" /></li>
      <li><app-rich key="rules.overview.next.glossary" /></li>
      <li><app-rich key="rules.overview.next.generals" /></li>
    </ul>
  `,
  styles: `
    .forces { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px; background: var(--mat-sys-surface); border: 1px solid var(--mat-sys-outline-variant); border-radius: 6px; position: relative; }
    figcaption { text-align: center; font: var(--mat-sys-body-medium); }
    figcaption b { color: var(--force-text); display: block; }
    .banner { position: absolute; left: 6px; top: 6px; width: 10px; height: 54px; object-fit: fill; }
  `,
})
export class RulesOverview {
  private readonly i18n = inject(I18n);
  protected readonly beats = [1, 2, 3, 4] as const;
  protected readonly beatTitleKey = (n: number) => `rules.overview.beat${n}.title` as MessageKey;
  protected readonly beatKey = (n: number) => `rules.overview.beat${n}` as MessageKey;

  protected readonly forces = computed(() =>
    FORCES.map(({ force, general }) => ({
      force,
      general,
      forceKey: `label.kingdom.${force}` as MessageKey,
      banner: kingdomBannerUrl(force),
      name: generalDisplayData(general, this.i18n.locale())?.name ?? '',
    })),
  );
}
