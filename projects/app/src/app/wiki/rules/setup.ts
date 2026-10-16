import { Component } from '@angular/core';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';

@Component({
  selector: 'app-rules-setup',
  imports: [RichText, TPipe],
  styleUrl: './rules-page.css',
  template: `
    <h2>{{ 'nav.rules.setup' | t }}</h2>
    <p class="lead">{{ 'rules.setup.lead' | t }}</p>
    <ol>
      <li><app-rich key="rules.setup.step1" /></li>
      <li><app-rich key="rules.setup.step2" /></li>
      <li><app-rich key="rules.setup.step3" /></li>
      <li><app-rich key="rules.setup.step4" /></li>
    </ol>
    <h3>{{ 'rules.setup.revealing' | t }}</h3>
    <ul>
      <li><app-rich key="rules.setup.reveal1" /></li>
      <li><app-rich key="rules.setup.reveal2" /></li>
      <li><app-rich key="rules.setup.reveal3" /></li>
      <li><app-rich key="rules.setup.reveal4" /></li>
      <li><app-rich key="rules.setup.reveal5" /></li>
      <li><app-rich key="rules.setup.reveal6" /></li>
    </ul>
    <h3>{{ 'rules.setup.killing' | t }}</h3>
    <ul>
      <li><app-rich key="rules.setup.kill1" /></li>
      <li><app-rich key="rules.setup.kill2" /></li>
      <li><app-rich key="rules.setup.kill3" /></li>
      <li><app-rich key="rules.setup.kill4" /></li>
      <li><app-rich key="rules.setup.kill5" /></li>
      <li><app-rich key="rules.setup.kill6" /></li>
    </ul>
    <p><app-rich key="rules.setup.next" /></p>
  `,
})
export class RulesSetup {}
