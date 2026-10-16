import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';

@Component({
  selector: 'app-rules-distance',
  imports: [RichText, TPipe],
  styleUrl: './rules-page.css',
  template: `
    <h2>{{ 'nav.rules.distance' | t }}</h2>
    <p class="lead">{{ 'rules.distance.lead' | t }}</p>
    <h3>{{ 'rules.distance.distance' | t }}</h3>
    <p>{{ 'rules.distance.text' | t }}</p>
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
})
export class RulesDistance {}
