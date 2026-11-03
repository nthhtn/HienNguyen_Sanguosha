import { Component, inject } from '@angular/core';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneSeat } from './scene/scene-seat';

@Component({
  selector: 'app-rules-chains',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.chains' | t }}</h2>
    <p class="lead">{{ 'rules.chains.lead' | t }}</p>

    <h3>{{ 'rules.chains.chainTitle' | t }}</h3>
    <p><app-rich key="rules.chains.chainText" /></p>
    <app-scene>
      <div class="scene-row top">
        <app-scene-card id="chains" size="small" />
        <span class="arrow" aria-hidden="true">→</span>
        <app-scene-seat general="guan-yu" [n]="3" force="Shu" [note]="'rules.chains.notChained' | t" />
        <span class="arrow" aria-hidden="true">→</span>
        <app-scene-seat general="guan-yu" [n]="3" force="Shu" [chained]="true" />
      </div>
    </app-scene>

    <h3>{{ 'rules.chains.waveTitle' | t }}</h3>
    <p>{{ 'rules.chains.waveText' | t }}</p>
    <app-scene caption="rules.chains.waveCap">
      <ol class="steps">
        <li>
          <div class="body">
            <p><app-rich key="rules.chains.w1" /></p>
            <div class="scene-row top">
              <app-scene-card id="fire-attack" size="small" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-seat general="sun-quan" [n]="2" force="Wu" [chained]="true" mark="fire" [note]="hp(4)" />
              <app-scene-seat general="guan-yu" [n]="3" force="Shu" [chained]="true" [note]="hp(4)" />
              <app-scene-seat general="zhang-jiao" [n]="5" force="Qun" [chained]="true" [note]="hp(4)" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p>{{ 'rules.chains.w2' | t }}</p>
            <div class="scene-row top">
              <app-scene-seat general="sun-quan" [n]="2" force="Wu" [note]="hp(2)" />
              <app-scene-seat general="guan-yu" [n]="3" force="Shu" [chained]="true" [note]="hp(4)" />
              <app-scene-seat general="zhang-jiao" [n]="5" force="Qun" [chained]="true" [note]="hp(4)" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p>{{ 'rules.chains.w3' | t }}</p>
            <div class="scene-row top">
              <app-scene-seat general="sun-quan" [n]="2" force="Wu" [note]="hp(2)" />
              <app-scene-seat general="guan-yu" [n]="3" force="Shu" mark="fire" [note]="hp(2)" />
              <app-scene-seat general="zhang-jiao" [n]="5" force="Qun" mark="fire" [note]="hp(2)" />
            </div>
          </div>
        </li>
      </ol>
    </app-scene>
  `,
})
export class RulesChains {
  private readonly i18n = inject(I18n);
  // "{n} HP" in the current language, for the line under a seat.
  protected readonly hp = (n: number) => this.i18n.t('rules.scene.hpCount', { n });
}
