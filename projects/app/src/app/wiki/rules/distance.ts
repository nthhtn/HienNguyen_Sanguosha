import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rules-distance',
  imports: [RouterLink],
  styleUrl: './rules-page.css',
  template: `
    <h2>Distance / Range</h2>
    <p class="lead">Who you can reach with a card.</p>
    <h3>Distance</h3>
    <p>
      Distance between two seats is the number of steps the short way around the table, counting only seats still in
      play. When a seat is knocked out, the seats beside it get closer. It is never below 1.
    </p>
    <ul>
      <li>A Plus Mount on the target adds 1.</li>
      <li>A Minus Mount on the attacker subtracts 1.</li>
      <li>Some skills change distance too.</li>
    </ul>
    <h3>Range</h3>
    <ul>
      <li>Sha can target a seat whose distance is no more than your attack range.</li>
      <li>Your attack range is your Weapon's range, or 1 with no Weapon.</li>
      <li>Steal and Starvation can only target a seat at distance 1.</li>
      <li>Tools that hit everyone, such as Barbarians and Hail of Arrows, ignore distance.</li>
    </ul>
    <p>Weapons and Mounts are listed under <a routerLink="/wiki/equipment">Equipment</a>.</p>
  `,
})
export class RulesDistance {}
