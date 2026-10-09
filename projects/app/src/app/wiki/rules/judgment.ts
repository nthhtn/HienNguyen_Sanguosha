import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rules-judgment',
  imports: [RouterLink],
  styleUrl: './rules-page.css',
  template: `
    <h2>Judgment</h2>
    <p class="lead">Turn up the top card of the draw pile to decide an effect.</p>
    <ol>
      <li>The top card of the draw pile is turned face up.</li>
      <li>Skills that change a judgment can replace the card before it is read.</li>
      <li>The final card is read for its suit and rank, and the effect follows.</li>
      <li>The card goes to the discard pile.</li>
    </ol>
    <h3>Delayed Tools</h3>
    <p>
      A Delayed Tool sits in a judgment area. It is judged in its holder's Judgment Phase. Wuxie can cancel it
      when it is judged.
    </p>
    <table>
      <tr><th>Capture</th><td>Placed on another seat. Anything but a heart means that seat skips its Play Phase.</td></tr>
      <tr><th>Starvation</th><td>Placed on another seat at distance 1. Anything but a club means that seat skips its Draw Phase.</td></tr>
      <tr><th>Lightning</th><td>Placed on yourself. A spade from 2 to 9 deals 3 damage to its holder. Otherwise it passes to the next seat.</td></tr>
    </table>
    <p>Read more under <a routerLink="/wiki/tools">Tools</a>.</p>
  `,
})
export class RulesJudgment {}
