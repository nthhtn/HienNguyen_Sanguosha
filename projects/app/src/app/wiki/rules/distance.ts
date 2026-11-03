import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { DISTANCE_EXAMPLE } from './distance-example';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneSeat } from './scene/scene-seat';

// Seats go round the table counter-clockwise from Seat 1 at the bottom, as turns do on the Game screen.
const SEATS = DISTANCE_EXAMPLE.seats.map((seat, i) => {
  const angle = Math.PI / 2 - (i / DISTANCE_EXAMPLE.seats.length) * Math.PI * 2;
  return {
    ...seat,
    left: 50 + Math.cos(angle) * 38,
    top: 50 + Math.sin(angle) * 36,
    reach: seat.distance !== undefined && seat.distance <= DISTANCE_EXAMPLE.range,
  };
});

@Component({
  selector: 'app-rules-distance',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneSeat],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.distance' | t }}</h2>
    <p class="lead">{{ 'rules.distance.lead' | t }}</p>
    <h3>{{ 'rules.distance.distance' | t }}</h3>
    <p>{{ 'rules.distance.text' | t }}</p>
    <app-scene caption="rules.distance.exampleCap">
      <div class="ring">
        @for (seat of seats; track seat.n) {
          <div class="spot" [style.left.%]="seat.left" [style.top.%]="seat.top">
            <app-scene-seat [general]="seat.general" [n]="seat.n" [force]="seat.force" [out]="!!seat.out" />
            @if (seat.distance !== undefined) {
              <span class="dbadge" [class.reach]="seat.reach" [attr.title]="'card.distance' | t: { n: seat.distance }">{{ seat.distance }}</span>
            }
            @if (seat.mount) {
              <app-scene-card class="mount" [id]="seat.mount" size="tiny" />
            }
          </div>
        }
      </div>
      <p><app-rich key="rules.distance.exampleText" /></p>
    </app-scene>
    <ul>
      <li>{{ 'rules.distance.plus' | t }}</li>
      <li>{{ 'rules.distance.minus' | t }}</li>
      <li>{{ 'rules.distance.skills' | t }}</li>
    </ul>
    <h3>{{ 'rules.distance.range' | t }}</h3>
    <ul>
      <li><app-rich key="rules.distance.range1" /></li>
      <li>{{ 'rules.distance.range2' | t }}</li>
      <li><app-rich key="rules.distance.range3" /></li>
      <li><app-rich key="rules.distance.range4" /></li>
    </ul>
    <p><app-rich key="rules.distance.see" /></p>
  `,
  styles: `
    .ring { position: relative; aspect-ratio: 1.5; min-height: 280px; background: radial-gradient(ellipse at center, var(--mat-sys-surface) 0 55%, transparent 56%); border-radius: 8px; }
    .spot { position: absolute; transform: translate(-50%, -50%); }
    .dbadge { position: absolute; top: -4px; right: 2px; min-width: 24px; height: 24px; padding: 0 5px; border-radius: 12px; display: grid; place-items: center; font: var(--mat-sys-label-large); background: var(--mat-sys-inverse-surface); color: var(--mat-sys-inverse-on-surface); }
    .dbadge.reach { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); }
    .mount { position: absolute; bottom: 22px; left: 0; }
  `,
})
export class RulesDistance {
  protected readonly seats = SEATS;
}
