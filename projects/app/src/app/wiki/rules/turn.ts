import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneGeneral } from './scene/scene-general';
import { SceneHp } from './scene/scene-hp';

@Component({
  selector: 'app-rules-turn',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneGeneral, SceneHp],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.turn' | t }}</h2>
    <p class="lead">{{ 'rules.turn.lead' | t }}</p>
    <div class="phases">
      <div class="phase">
        <h4>{{ 'phase.indicator' | t: { phase: ('history.phase.Start' | t) } }}</h4>
        <div class="art"><app-scene-general id="hidden" size="small" /></div>
        <p><app-rich key="rules.turn.start" /></p>
      </div>
      <div class="phase">
        <h4>{{ 'phase.indicator' | t: { phase: ('history.phase.Judgment' | t) } }}</h4>
        <div class="art"><app-scene-card id="capture" size="small" /><app-scene-card id="lightning" size="small" /></div>
        <p><app-rich key="rules.turn.judgment" /></p>
      </div>
      <div class="phase">
        <h4>{{ 'phase.indicator' | t: { phase: ('history.phase.Draw' | t) } }}</h4>
        <div class="art"><app-scene-card id="back" size="small" /><app-scene-card id="back" size="small" /></div>
        <p><app-rich key="rules.turn.draw" /></p>
      </div>
      <div class="phase waits">
        <h4>{{ 'phase.indicator' | t: { phase: ('history.phase.Play' | t) } }}</h4>
        <div class="art"><app-scene-card id="sha" size="small" /><app-scene-card id="peach" size="small" /><app-scene-card id="steal" size="small" /></div>
        <p><app-rich key="rules.turn.play" /></p>
        <span class="pill ok">{{ 'rules.turn.waits' | t }}</span>
      </div>
      <div class="phase">
        <h4>{{ 'phase.indicator' | t: { phase: ('history.phase.Discard' | t) } }}</h4>
        <div class="art"><app-scene-hp [hp]="3" /></div>
        <p><app-rich key="rules.turn.discard" /></p>
      </div>
      <div class="phase">
        <h4>{{ 'phase.indicator' | t: { phase: ('history.phase.End' | t) } }}</h4>
        <div class="art"><span class="arrow" aria-hidden="true">→</span></div>
        <p><app-rich key="rules.turn.end" /></p>
      </div>
    </div>
    <p><app-rich key="rules.turn.note" /></p>

    <h3>{{ 'phase.indicator' | t: { phase: ('history.phase.Play' | t) } }}</h3>
    <app-scene caption="rules.turn.playExCap">
      <ol class="steps">
        <li>
          <div class="body">
            <p><app-rich key="rules.turn.playEx1" /></p>
            <div class="scene-row center">
              <app-scene-card id="peach" size="normal" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-hp [hp]="3" [max]="4" />
              <span class="arrow" aria-hidden="true">→</span>
              <app-scene-hp [hp]="4" />
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.turn.playEx2" /></p>
            <div class="scene-row center">
              <app-scene-card id="sha" size="normal" />
              <span class="pill">{{ 'rules.turn.oncePerTurn' | t }}</span>
            </div>
          </div>
        </li>
        <li>
          <div class="body">
            <p><app-rich key="rules.turn.playEx3" /></p>
          </div>
        </li>
      </ol>
    </app-scene>

    <h3>{{ 'phase.indicator' | t: { phase: ('history.phase.Discard' | t) } }}</h3>
    <app-scene caption="rules.turn.discardExCap">
      <div class="scene-row top">
        <app-scene-card id="sha" />
        <app-scene-card id="shan" />
        <app-scene-card id="peach" />
        <app-scene-card id="wuxie" />
        <div class="fig"><app-scene-card id="steal" [dim]="true" /><span class="pill bad">{{ 'ui.discard' | t }}</span></div>
        <div class="fig"><app-scene-card id="break" [dim]="true" /><span class="pill bad">{{ 'ui.discard' | t }}</span></div>
      </div>
      <p>{{ 'rules.turn.discardEx' | t }} <app-scene-hp [hp]="4" /></p>
    </app-scene>
  `,
  styles: `
    .phases { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
    .phase { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px 8px; text-align: center; min-width: 0; background: var(--mat-sys-surface-container); border: 1px solid var(--mat-sys-outline-variant); border-radius: 6px; }
    .phase.waits { border-color: var(--mat-sys-primary); box-shadow: inset 0 0 0 1px var(--mat-sys-primary); }
    .phase h4 { margin: 0; font: var(--mat-sys-title-small); }
    .phase p { margin: 0; font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .art { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; min-height: 60px; align-items: center; }
    @media (max-width: 900px) { .phases { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class RulesTurn {}
