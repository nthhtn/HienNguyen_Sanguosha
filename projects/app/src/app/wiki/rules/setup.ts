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
      <li>When you reveal your second General and the two Generals' HP added together was odd (so your HP was rounded down), you draw 1 card.</li>
      <li>Optional, with 5 or more seats: the first seat to reveal a General draws 2 cards. This is a checkbox in Game Setup.</li>
    </ul>
    <h3>Killing a seat</h3>
    <ul>
      <li>When a seat is eliminated, the seat whose damage killed it is rewarded or penalized.</li>
      <li>Different Force: the killer draws one card for each living seat of the dead seat's Force, counting the dead seat itself.</li>
      <li>Same Force: the killer discards its entire hand.</li>
      <li>A killer who has not revealed either General always counts as a different Force, even if it secretly shares the dead seat's Force.</li>
      <li>Qun counts as one Force like the others.</li>
      <li>Nothing happens if the death had no source, the seat killed itself, or the killer is out as well.</li>
    </ul>
    <p>Next: <a routerLink="/wiki/rules/turn">Turn Structure</a>.</p>
  `,
})
export class RulesSetup {}
