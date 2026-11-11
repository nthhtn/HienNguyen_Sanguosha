import { Component } from '@angular/core';
import type { MessageKey } from '../../i18n/messages';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneGeneral } from './scene/scene-general';
import { SceneHp } from './scene/scene-hp';
import { SceneSeat } from './scene/scene-seat';

// The seven Generals dealt in the example: at least two of the same Force.
const DEAL = [
  { general: 'cao-cao', force: 'Wei' },
  { general: 'zhang-liao', force: 'Wei' },
  { general: 'liu-bei', force: 'Shu' },
  { general: 'guan-yu', force: 'Shu' },
  { general: 'sun-quan', force: 'Wu' },
  { general: 'gan-ning', force: 'Wu' },
  { general: 'zhang-jiao', force: 'Qun' },
] as const;

@Component({
  selector: 'app-rules-setup',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneGeneral, SceneHp, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.setup' | t }}</h2>
    <p class="lead">{{ 'rules.setup.lead' | t }}</p>
    <ol class="steps">
      <li>
        <div class="body">
          <p><app-rich key="rules.setup.step1" /></p>
          <div class="scene-row top">
            @for (dealt of deal; track dealt.general) {
              <figure class="fig" [attr.data-force]="dealt.force">
                <app-scene-general [id]="dealt.general" />
                <figcaption class="force">{{ dealt.forceKey | t }}</figcaption>
              </figure>
            }
          </div>
        </div>
      </li>
      <li>
        <div class="body">
          <p><app-rich key="rules.setup.step2" /></p>
          <div class="scene-row top">
            <figure class="fig">
              <app-scene-general id="cao-cao" />
              <span class="tag">{{ 'choice.label.mainGeneral' | t }}</span>
              <app-scene-hp [hp]="4" />
            </figure>
            <figure class="fig">
              <app-scene-general id="guo-jia" />
              <span class="tag">{{ 'choice.label.deputyGeneral' | t }}</span>
              <app-scene-hp [hp]="3" />
            </figure>
            <span class="arrow" aria-hidden="true">→</span>
            <figure class="fig">
              <app-scene-general id="hidden" />
              <span class="tag">{{ 'choice.label.mainGeneral' | t }}</span>
              <figcaption>{{ 'seat.faceDown' | t }}</figcaption>
            </figure>
            <figure class="fig">
              <app-scene-general id="hidden" />
              <span class="tag">{{ 'choice.label.deputyGeneral' | t }}</span>
              <figcaption>{{ 'seat.faceDown' | t }}</figcaption>
            </figure>
          </div>
        </div>
      </li>
      <li>
        <div class="body">
          <p><app-rich key="rules.setup.step3" /></p>
          <div class="scene-row center">
            <span>{{ 'rules.setup.hpSum' | t }}</span>
            <app-scene-hp [hp]="3" />
          </div>
        </div>
      </li>
      <li>
        <div class="body">
          <p><app-rich key="rules.setup.step4" /></p>
          <div class="scene-row">
            @for (n of [1, 2, 3, 4]; track n) {
              <app-scene-card id="back" />
            }
          </div>
        </div>
      </li>
    </ol>
    <h3>{{ 'rules.setup.revealing' | t }}</h3>
    <ul>
      <li><app-rich key="rules.setup.reveal1" /></li>
      <li><app-rich key="rules.setup.reveal2" /></li>
      <li><app-rich key="rules.setup.reveal3" /></li>
      <li><app-rich key="rules.setup.reveal4" /></li>
      <li><app-rich key="rules.setup.reveal5" /></li>
      <li><app-rich key="rules.setup.revealPartners" /></li>
      <li><app-rich key="rules.setup.reveal6" /></li>
    </ul>
    <app-scene caption="rules.setup.revealBonusCap">
      <div class="scene-row top">
        <figure class="fig">
          <app-scene-general id="cao-cao" size="small" />
          <span class="tag">{{ 'choice.label.mainGeneral' | t }}</span>
          <figcaption>{{ 'rules.setup.revealed' | t }}</figcaption>
        </figure>
        <figure class="fig">
          <app-scene-general id="hidden" size="small" />
          <span class="tag">{{ 'choice.label.deputyGeneral' | t }}</span>
          <figcaption>{{ 'seat.faceDown' | t }}</figcaption>
        </figure>
        <span class="arrow" aria-hidden="true">→</span>
        <figure class="fig">
          <app-scene-general id="cao-cao" size="small" />
          <span class="tag">{{ 'choice.label.mainGeneral' | t }}</span>
          <figcaption>{{ 'rules.setup.revealed' | t }}</figcaption>
        </figure>
        <figure class="fig">
          <app-scene-general id="guo-jia" size="small" />
          <span class="tag">{{ 'choice.label.deputyGeneral' | t }}</span>
          <figcaption>{{ 'rules.setup.revealed' | t }}</figcaption>
        </figure>
        <figure class="fig">
          <app-scene-card id="back" size="small" />
          <figcaption>{{ 'rules.setup.drawOne' | t }}</figcaption>
        </figure>
      </div>
      <p>{{ 'rules.setup.revealBonusEx' | t }}</p>
    </app-scene>
    <h3>{{ 'rules.setup.killing' | t }}</h3>
    <p><app-rich key="rules.setup.kill1" /></p>
    <div class="pair">
      <app-scene caption="rules.setup.killDifferent">
        <div class="scene-row center">
          <app-scene-seat general="cao-cao" [n]="1" force="Wei" [label]="'rules.setup.killer' | t" />
          <span class="arrow" aria-hidden="true">→</span>
          <app-scene-seat general="liu-bei" [n]="2" force="Shu" [out]="true" />
        </div>
        <p><app-rich key="rules.setup.kill2" /></p>
      </app-scene>
      <app-scene caption="rules.setup.killSame">
        <div class="scene-row center">
          <app-scene-seat general="cao-cao" [n]="1" force="Wei" [label]="'rules.setup.killer' | t" />
          <span class="arrow" aria-hidden="true">→</span>
          <app-scene-seat general="zhang-liao" [n]="3" force="Wei" [out]="true" />
        </div>
        <p><app-rich key="rules.setup.kill3" /></p>
      </app-scene>
    </div>
    <ul>
      <li><app-rich key="rules.setup.kill4" /></li>
      <li><app-rich key="rules.setup.kill5" /></li>
      <li><app-rich key="rules.setup.kill6" /></li>
      <li><app-rich key="rules.setup.kill7" /></li>
    </ul>
    <p><app-rich key="rules.setup.next" /></p>
  `,
  styles: `
    figure { margin: 0; }
    .force { color: var(--force-text); font-weight: 700; }
    .pair { display: flex; flex-wrap: wrap; gap: 12px; }
    .pair app-scene { flex: 1 1 260px; margin: 8px 0; }
  `,
})
export class RulesSetup {
  protected readonly deal = DEAL.map((dealt) => ({ ...dealt, forceKey: `label.kingdom.${dealt.force}` as MessageKey }));
}
