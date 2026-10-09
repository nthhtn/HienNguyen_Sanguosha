import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rules-card-types',
  imports: [RouterLink],
  styleUrl: './rules-page.css',
  template: `
    <h2>Card Types</h2>
    <p class="lead">Every card is a Basic card, a Tool or Equipment.</p>
    <table>
      <tr>
        <th><a routerLink="/wiki/basic">Basic Cards</a></th>
        <td>Sha, Shan, Peach and Wine. They attack, defend and heal. Most are played from your hand on your own Play Phase or as a response.</td>
      </tr>
      <tr>
        <th><a routerLink="/wiki/tools">Tools</a></th>
        <td>
          Played from your hand for a special effect. An Instant Tool takes effect at once; a Delayed Tool is placed in a
          judgment area and takes effect in a later Judgment Phase. Wuxie can cancel a Tool.
        </td>
      </tr>
      <tr>
        <th><a routerLink="/wiki/equipment">Equipment</a></th>
        <td>
          Stays in front of you once played. Weapons set your attack range, Armor defends, and a Mount changes distance:
          a Plus Mount pushes you farther away, a Minus Mount brings others closer.
        </td>
      </tr>
    </table>
    <p>See <a routerLink="/wiki/rules/distance">Distance / Range</a> for how Mounts and Weapons are counted.</p>
  `,
})
export class RulesCardTypes {}
