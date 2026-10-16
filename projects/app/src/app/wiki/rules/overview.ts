import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';

@Component({
  selector: 'app-rules-overview',
  imports: [RichText, TPipe],
  styleUrl: './rules-page.css',
  template: `
    <h2>{{ 'nav.rules.overview' | t }}</h2>
    <p class="lead">{{ 'rules.overview.lead' | t }}</p>
    <p><app-rich key="rules.overview.intro" /></p>
    <h3>{{ 'rules.overview.winning' | t }}</h3>
    <ul>
      <li><app-rich key="rules.overview.win1" /></li>
      <li><app-rich key="rules.overview.win2" /></li>
      <li><app-rich key="rules.overview.win3" /></li>
    </ul>
    <h3>{{ 'rules.overview.next' | t }}</h3>
    <ul>
      <li><app-rich key="rules.overview.next.setup" /></li>
      <li><app-rich key="rules.overview.next.turn" /></li>
      <li><app-rich key="rules.overview.next.cardTypes" /></li>
      <li><app-rich key="rules.overview.next.distance" /></li>
      <li><app-rich key="rules.overview.next.judgment" /></li>
      <li><app-rich key="rules.overview.next.generals" /></li>
    </ul>
  `,
})
export class RulesOverview {}
