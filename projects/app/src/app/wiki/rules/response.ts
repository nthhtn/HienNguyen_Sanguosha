import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneHp } from './scene/scene-hp';
import { SceneSeat } from './scene/scene-seat';

@Component({
  selector: 'app-rules-response',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneHp, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.response' | t }}</h2>
    <p class="lead">{{ 'rules.response.lead' | t }}</p>

    <h3><app-rich key="rules.response.shaTitle" /></h3>
    <app-scene>
      <ol class="steps">
        <li>
          <div class="body">
            <p><app-rich key="rules.response.sha1" /></p>
            <div class="scene-row center">
              <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
              <app-scene-card id="sha" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-seat general="guan-yu" [n]="3" force="Shu" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.response.sha2" /></p>
            <div class="branch">
              <div>
                <h5><app-rich key="rules.response.playsShan" /></h5>
                <div class="scene-row center">
                  <app-scene-card id="shan" size="small" />
                  <span><app-rich key="rules.response.shaNoEffect" /></span>
                </div>
              </div>
              <div>
                <h5>{{ 'rules.response.passes' | t }}</h5>
                <div class="scene-row center">
                  <app-scene-hp [hp]="3" [max]="4" />
                  <span>{{ 'rules.response.shaDamage' | t }}</span>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ol>
    </app-scene>

    <h3><app-rich key="rules.response.wuxieTitle" /></h3>
    <p><app-rich key="rules.response.wuxieIntro" /></p>
    <app-scene caption="rules.response.chainCap">
      <ol class="steps">
        <li>
          <div class="body">
            <p><app-rich key="rules.response.chain1" /></p>
            <div class="scene-row center">
              <app-scene-card id="break" size="small" />
              <span class="pill"><app-rich key="rules.response.waiting" /></span>
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.response.chain2" /></p>
            <div class="scene-row center">
              <app-scene-card id="wuxie" size="small" />
              <span class="pill bad"><app-rich key="rules.response.breakCancelled" /></span>
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.response.chain3" /></p>
            <div class="scene-row center">
              <app-scene-card id="wuxie" size="small" />
              <app-scene-card id="wuxie" size="small" />
              <span class="pill ok"><app-rich key="rules.response.firstCancelled" /></span>
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.response.chain4" /></p>
            <div class="scene-row center">
              <app-scene-card id="break" size="small" />
              <span class="pill ok"><app-rich key="rules.response.breakTakes" /></span>
            </div>
          </div>
        </li>
      </ol>
    </app-scene>

    <h3><app-rich key="rules.response.manyTitle" /></h3>
    <p><app-rich key="rules.response.manyIntro" /></p>
    <app-scene caption="rules.response.barbCap">
      <p><app-rich key="rules.response.barb1" /></p>
      <div class="scene-row top">
        <figure class="fig">
          <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
          <app-scene-card id="barbarians" size="small" />
        </figure>
        <span class="arrow" aria-hidden="true">→</span>
        <figure class="fig target">
          <app-scene-seat general="liu-bei" [n]="2" force="Shu" />
          <app-scene-card id="sha" size="small" />
          <figcaption><app-rich key="rules.response.barbT2" /></figcaption>
        </figure>
        <figure class="fig target">
          <app-scene-seat general="sun-quan" [n]="3" force="Wu" />
          <app-scene-card id="wuxie" size="small" />
          <span class="pill ok">{{ 'rules.response.spared' | t }}</span>
          <figcaption><app-rich key="rules.response.barbT3" /></figcaption>
        </figure>
        <figure class="fig target">
          <app-scene-seat general="zhang-jiao" [n]="4" force="Qun" />
          <span class="pill bad">{{ 'rules.response.takesDamage' | t }}</span>
          <figcaption>{{ 'rules.response.barbT4' | t }}</figcaption>
        </figure>
      </div>
    </app-scene>
  `,
  styles: `
    figure { margin: 0; }
  `,
})
export class RulesResponse {}
