import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rules-setup',
  imports: [RouterLink],
  styleUrl: './rules-page.css',
  template: `
    <h2>Setup</h2>
    <p class="lead">What happens before the first turn.</p>
    <ol>
      <li>Every seat is dealt 5 Generals. Each set includes at least two Generals of the same Force.</li>
      <li>Each player chooses two of their Generals: a Main General and a Deputy General. Both start face down.</li>
      <li>HP is shared: half the sum of the two Generals' HP, rounded down. Damage and healing apply to this one pool.</li>
      <li>The draw pile is shuffled and every seat draws 4 cards.</li>
    </ol>
    <h3>Revealing Generals</h3>
    <ul>
      <li>You can reveal a General when you need its skill or Force.</li>
      <li>A seat's Main General is revealed when its HP drops to half its maximum or lower.</li>
      <li>Its Deputy General is revealed when its HP drops to 0 or lower.</li>
    </ul>
    <p>Next: <a routerLink="/wiki/rules/turn">Turn Structure</a>.</p>
  `,
})
export class RulesSetup {}
