import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneSeat } from './scene/scene-seat';

@Component({
  selector: 'app-rules-allegiance',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.allegiance' | t }}</h2>
    <p class="lead">{{ 'rules.allegiance.lead' | t }}</p>

    <h3>{{ 'rules.allegiance.kindsTitle' | t }}</h3>
    <p>{{ 'rules.allegiance.decided' | t }}</p>
    <p>{{ 'rules.allegiance.kinds' | t }}</p>
    <app-scene caption="rules.allegiance.kindsCap">
      <div class="scene-row center">
        <app-scene-seat general="cao-cao" [n]="1" force="Wei" [note]="'rules.allegiance.noteForce' | t" />
        <app-scene-seat general="zhang-liao" [n]="4" [ambitionist]="true" [note]="'rules.allegiance.noteAlone' | t" />
      </div>
      <p><app-rich key="rules.allegiance.kindsEx" /></p>
    </app-scene>

    <h3>{{ 'rules.allegiance.capTitle' | t }}</h3>
    <p>{{ 'rules.allegiance.capText' | t }} <app-rich key="rules.allegiance.capSee" /></p>
    <p><app-rich key="rules.allegiance.ignoreText" /></p>
    <app-scene caption="rules.allegiance.capCap">
      <ol class="steps">
        <li>
          <div class="body">
            <p><app-rich key="rules.allegiance.c1" /></p>
            <div class="scene-row top">
              <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
              <app-scene-seat general="xiahou-dun" [n]="2" force="Wei" />
              <app-scene-seat general="guo-jia" [n]="3" force="Wei" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.allegiance.c2" /></p>
            <div class="scene-row top">
              <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
              <app-scene-seat general="xiahou-dun" [n]="2" force="Wei" />
              <app-scene-seat general="guo-jia" [n]="3" force="Wei" />
              <app-scene-seat general="zhang-liao" [n]="4" [ambitionist]="true" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.allegiance.c3" /></p>
            <div class="scene-row top">
              <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
              <app-scene-seat general="xiahou-dun" [n]="2" force="Wei" [out]="true" />
              <app-scene-seat general="guo-jia" [n]="3" force="Wei" />
              <app-scene-seat general="zhang-liao" [n]="4" [ambitionist]="true" />
            </div>
          </div>
        </li>
      </ol>
    </app-scene>

    <h3>{{ 'rules.allegiance.killTitle' | t }}</h3>
    <p>{{ 'rules.allegiance.killText' | t }}</p>
    <app-scene caption="rules.allegiance.killCap">
      <div class="scene-row center">
        <app-scene-seat general="sun-quan" [n]="5" force="Wu" [label]="'rules.setup.killer' | t" />
        <span class="arrow" aria-hidden="true">→</span>
        <app-scene-seat general="zhang-liao" [n]="4" [ambitionist]="true" [out]="true" />
        <span class="arrow" aria-hidden="true">→</span>
        <app-scene-card id="back" size="small" />
        <app-scene-card id="back" size="small" />
        <app-scene-card id="back" size="small" />
        <span class="pill ok">{{ 'rules.allegiance.draws3' | t }}</span>
      </div>
    </app-scene>

    <h3>{{ 'rules.allegiance.winTitle' | t }}</h3>
    <p>{{ 'rules.allegiance.winText' | t }}</p>
    <div class="branch">
      <div>
        <h5>{{ 'rules.allegiance.winForce' | t }}</h5>
        <div class="scene-row center">
          <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
          <app-scene-seat general="guo-jia" [n]="3" force="Wei" />
        </div>
        <p><app-rich key="rules.allegiance.winForceText" /></p>
      </div>
      <div>
        <h5>{{ 'rules.allegiance.goesOn' | t }}</h5>
        <div class="scene-row center">
          <app-scene-seat general="cao-cao" [n]="1" force="Wei" />
          <app-scene-seat general="zhang-liao" [n]="4" [ambitionist]="true" />
        </div>
        <p><app-rich key="rules.allegiance.goesOnText" /></p>
      </div>
      <div>
        <h5>{{ 'rules.allegiance.lastWins' | t }}</h5>
        <div class="scene-row center">
          <app-scene-seat general="zhang-liao" [n]="4" [ambitionist]="true" />
        </div>
        <p>{{ 'rules.allegiance.lastWinsText' | t }}</p>
      </div>
    </div>
  `,
})
export class RulesAllegiance {}
