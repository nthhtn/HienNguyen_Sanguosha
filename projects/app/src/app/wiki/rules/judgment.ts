import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';

@Component({
  selector: 'app-rules-judgment',
  imports: [RichText, TPipe],
  styleUrl: './rules-page.css',
  template: `
    <h2>{{ 'nav.rules.judgment' | t }}</h2>
    <p class="lead">{{ 'rules.judgment.lead' | t }}</p>
    <ol>
      <li>{{ 'rules.judgment.step1' | t }}</li>
      <li>{{ 'rules.judgment.step2' | t }}</li>
      <li>{{ 'rules.judgment.step3' | t }}</li>
      <li>{{ 'rules.judgment.step4' | t }}</li>
    </ol>
    <h3>{{ 'rules.judgment.delayed' | t }}</h3>
    <p><app-rich key="rules.judgment.delayedText" /></p>
    <table>
      <tr><th><app-rich text="{card:capture}" /></th><td>{{ 'rules.judgment.capture' | t }}</td></tr>
      <tr><th><app-rich text="{card:starvation}" /></th><td>{{ 'rules.judgment.starvation' | t }}</td></tr>
      <tr><th><app-rich text="{card:lightning}" /></th><td>{{ 'rules.judgment.lightning' | t }}</td></tr>
    </table>
    <p><app-rich key="rules.judgment.see" /></p>
  `,
})
export class RulesJudgment {}
