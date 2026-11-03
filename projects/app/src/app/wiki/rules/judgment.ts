import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';

@Component({
  selector: 'app-rules-judgment',
  imports: [RichText, TPipe, SceneCard, SceneFrame],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.judgment' | t }}</h2>
    <p class="lead">{{ 'rules.judgment.lead' | t }}</p>
    <ol class="steps">
      <li>
        <div class="body">
          <p>{{ 'rules.judgment.step1' | t }}</p>
          <app-scene-card id="back" />
        </div>
      </li>
      <li><div class="body"><p>{{ 'rules.judgment.step2' | t }}</p></div></li>
      <li><div class="body"><p>{{ 'rules.judgment.step3' | t }}</p></div></li>
      <li><div class="body"><p>{{ 'rules.judgment.step4' | t }}</p></div></li>
    </ol>
    <p class="note-pending">{{ 'rules.judgment.pending' | t }}</p>

    <h3>{{ 'rules.judgment.delayed' | t }}</h3>
    <p><app-rich key="rules.judgment.delayedText" /></p>

    <app-scene>
      <div class="scene-row top">
        <app-scene-card id="capture" size="small" />
        <div class="rule">
          <h4><app-rich text="{card:capture}" /></h4>
          <p>{{ 'rules.judgment.capture' | t }}</p>
          <div class="branch">
            <div>
              <h5>{{ 'rules.judgment.safeHeart' | t }}</h5>
              <span class="pill ok">9 ♥</span> {{ 'rules.judgment.nothing' | t }}
            </div>
            <div>
              <h5>{{ 'rules.judgment.anythingElse' | t }}</h5>
              <span class="pill bad">K ♠</span> {{ 'rules.judgment.skipPlay' | t }}
            </div>
          </div>
        </div>
      </div>
    </app-scene>
    <app-scene>
      <div class="scene-row top">
        <app-scene-card id="starvation" size="small" />
        <div class="rule">
          <h4><app-rich text="{card:starvation}" /></h4>
          <p>{{ 'rules.judgment.starvation' | t }}</p>
          <div class="branch">
            <div>
              <h5>{{ 'rules.judgment.safeClub' | t }}</h5>
              <span class="pill ok">4 ♣</span> {{ 'rules.judgment.nothing' | t }}
            </div>
            <div>
              <h5>{{ 'rules.judgment.anythingElse' | t }}</h5>
              <span class="pill bad">Q ♦</span> {{ 'rules.judgment.skipDraw' | t }}
            </div>
          </div>
        </div>
      </div>
    </app-scene>
    <app-scene>
      <div class="scene-row top">
        <app-scene-card id="lightning" size="small" />
        <div class="rule">
          <h4><app-rich text="{card:lightning}" /></h4>
          <p>{{ 'rules.judgment.lightning' | t }}</p>
          <div class="branch">
            <div>
              <h5>{{ 'rules.judgment.hitSpade' | t }}</h5>
              <span class="pill bad">5 ♠</span> {{ 'rules.judgment.damage3' | t }}
            </div>
            <div>
              <h5>{{ 'rules.judgment.anythingElse' | t }}</h5>
              <span class="pill ok">J ♠</span> {{ 'rules.judgment.passes' | t }}
            </div>
          </div>
        </div>
      </div>
    </app-scene>
    <p><app-rich key="rules.judgment.see" /></p>
  `,
  styles: `
    .rule { flex: 1 1 260px; min-width: 0; }
    h4 { margin: 0 0 4px; font: var(--mat-sys-title-medium); }
    .rule p { margin: 0 0 8px; }
  `,
})
export class RulesJudgment {}
