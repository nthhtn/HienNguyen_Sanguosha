import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rules-turn',
  imports: [RouterLink],
  styleUrl: './rules-page.css',
  template: `
    <h2>Turn Structure</h2>
    <p class="lead">A turn has six phases, always in the same order.</p>
    <table>
      <tr><th>Start Phase</th><td>Skills that trigger at the start of a turn resolve.</td></tr>
      <tr><th>Judgment Phase</th><td>Each Delayed Tool in your judgment area is judged. See <a routerLink="/wiki/rules/judgment">Judgment</a>.</td></tr>
      <tr><th>Draw Phase</th><td>Draw 2 cards. Some skills change this.</td></tr>
      <tr><th>Play Phase</th><td>Play cards and use skills in any order. You may use one Sha per turn. End the phase when you are done.</td></tr>
      <tr><th>Discard Phase</th><td>Discard down to your hand limit, which equals your current HP.</td></tr>
      <tr><th>End Phase</th><td>Skills that trigger at the end of a turn resolve. Then the next living seat clockwise begins its turn.</td></tr>
    </table>
    <p>
      Draw, Discard and the other phases pass by themselves. Only the Play Phase waits for you to end it. A
      Capture or Starvation can make you skip a phase.
    </p>
  `,
})
export class RulesTurn {}
