import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';

@Component({
  selector: 'app-rules-turn',
  imports: [RichText, TPipe],
  styleUrl: './rules-page.css',
  template: `
    <h2>{{ 'nav.rules.turn' | t }}</h2>
    <p class="lead">{{ 'rules.turn.lead' | t }}</p>
    <table>
      <tr><th>{{ 'phase.indicator' | t: { phase: ('history.phase.Start' | t) } }}</th><td><app-rich key="rules.turn.start" /></td></tr>
      <tr><th>{{ 'phase.indicator' | t: { phase: ('history.phase.Judgment' | t) } }}</th><td><app-rich key="rules.turn.judgment" /></td></tr>
      <tr><th>{{ 'phase.indicator' | t: { phase: ('history.phase.Draw' | t) } }}</th><td><app-rich key="rules.turn.draw" /></td></tr>
      <tr><th>{{ 'phase.indicator' | t: { phase: ('history.phase.Play' | t) } }}</th><td><app-rich key="rules.turn.play" /></td></tr>
      <tr><th>{{ 'phase.indicator' | t: { phase: ('history.phase.Discard' | t) } }}</th><td><app-rich key="rules.turn.discard" /></td></tr>
      <tr><th>{{ 'phase.indicator' | t: { phase: ('history.phase.End' | t) } }}</th><td><app-rich key="rules.turn.end" /></td></tr>
    </table>
    <p><app-rich key="rules.turn.note" /></p>
  `,
})
export class RulesTurn {}
