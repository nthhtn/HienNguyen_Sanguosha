import { Component, inject } from '@angular/core';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneSeat } from './scene/scene-seat';

@Component({
  selector: 'app-rules-damage',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.damage' | t }}</h2>
    <p class="lead">{{ 'rules.damage.lead' | t }}</p>

    <h3>{{ 'rules.damage.hpTitle' | t }}</h3>
    <p>{{ 'rules.damage.hpText' | t }}</p>
    <app-scene caption="rules.damage.hpCap">
      <div class="scene-row top">
        <app-scene-seat general="sun-quan" [n]="2" force="Wu" [note]="hp(4)" />
        <span class="arrow" aria-hidden="true">→</span>
        <app-scene-seat general="sun-quan" [n]="2" force="Wu" mark="damage" [note]="hp(3)" />
      </div>
      <p>{{ 'rules.damage.hpEx' | t }}</p>
    </app-scene>

    <h3><app-rich key="rules.damage.wineTitle" /></h3>
    <p><app-rich key="rules.damage.wineText" /></p>
    <app-scene caption="rules.damage.wineCap">
      <div class="scene-row center">
        <app-scene-card id="wine" size="small" />
        <span class="arrow" aria-hidden="true">+</span>
        <app-scene-card id="sha" size="small" />
        <span class="arrow" aria-hidden="true">→</span>
        <span><app-rich key="rules.damage.wineEx" /></span>
      </div>
    </app-scene>

    <h3>{{ 'rules.damage.kindsTitle' | t }}</h3>
    <p><app-rich key="rules.damage.kindsText" /></p>
    <div class="scene-row top">
      <figure class="fig kind">
        <app-scene-card id="sha" size="small" />
        <figcaption><b>{{ 'rules.damage.kindNormal' | t }}</b> <app-rich key="rules.damage.kindNormalCards" /></figcaption>
      </figure>
      <figure class="fig kind">
        <app-scene-card id="fire-attack" size="small" />
        <figcaption><b>{{ 'rules.damage.kindFire' | t }}</b> <app-rich key="rules.damage.kindFireCards" /></figcaption>
      </figure>
      <figure class="fig kind">
        <app-scene-card id="lightning-attack" size="small" />
        <figcaption><b>{{ 'rules.damage.kindThunder' | t }}</b> <app-rich key="rules.damage.kindThunderCards" /></figcaption>
      </figure>
    </div>

    <h3>{{ 'rules.damage.dyingTitle' | t }}</h3>
    <p>{{ 'rules.damage.dyingText' | t }}</p>
    <app-scene caption="rules.damage.dyingCap">
      <ol class="steps">
        <li>
          <div class="body">
            <p><app-rich key="rules.damage.d1" /></p>
            <div class="scene-row center">
              <app-scene-seat general="gan-ning" [n]="4" force="Wu" [note]="hp(1)" />
              <app-scene-card id="wine" size="small" />
              <span class="arrow" aria-hidden="true">+</span>
              <app-scene-card id="sha" size="small" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-seat general="gan-ning" [n]="4" force="Wu" mark="damage" [note]="hp(-1)" />
              <span class="pill bad">{{ 'rules.damage.dying' | t }}</span>
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.damage.d2" /></p>
            <div class="scene-row top">
              <figure class="fig">
                <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
                <app-scene-card id="peach" size="small" />
              </figure>
              <span class="arrow" aria-hidden="true">→</span>
              <figure class="fig">
                <app-scene-seat general="liu-bei" [n]="2" force="Shu" />
                <app-scene-card id="peach" size="small" />
              </figure>
              <span class="arrow" aria-hidden="true">→</span>
              <figure class="fig">
                <app-scene-seat general="sun-quan" [n]="3" force="Wu" />
                <span class="pill">{{ 'rules.damage.skipped' | t }}</span>
              </figure>
              <span class="arrow" aria-hidden="true">→</span>
              <figure class="fig">
                <app-scene-seat general="gan-ning" [n]="4" force="Wu" />
                <span class="pill bad">{{ 'rules.damage.dying' | t }}</span>
              </figure>
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.damage.d3" /></p>
            <div class="scene-row center">
              <app-scene-seat general="gan-ning" [n]="4" force="Wu" [note]="hp(-1)" />
              <app-scene-card id="peach" size="small" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-seat general="gan-ning" [n]="4" force="Wu" [note]="hp(0)" />
              <app-scene-card id="peach" size="small" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-seat general="gan-ning" [n]="4" force="Wu" [note]="hp(1)" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p>{{ 'rules.damage.d4' | t }}</p>
            <div class="branch">
              <div>
                <h5>{{ 'rules.damage.saved' | t }}</h5>
                <app-scene-card id="peach" size="small" />
                <p>{{ 'rules.damage.savedText' | t }}</p>
              </div>
              <div>
                <h5>{{ 'rules.damage.out' | t }}</h5>
                <p><app-rich key="rules.damage.outText" /></p>
              </div>
            </div>
          </div>
        </li>
      </ol>
    </app-scene>
  `,
  styles: `
    figure { margin: 0; }
    figcaption { font: var(--mat-sys-body-small); max-width: 140px; }
  `,
})
export class RulesDamage {
  private readonly i18n = inject(I18n);
  // "{n} HP" in the current language, for the line under a seat.
  protected readonly hp = (n: number) => this.i18n.t('rules.scene.hpCount', { n });
}
