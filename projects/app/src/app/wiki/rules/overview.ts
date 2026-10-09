import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-rules-overview',
  imports: [RouterLink],
  styleUrl: './rules-page.css',
  template: `
    <h2>Overview</h2>
    <p class="lead">What Kingdom War is and how a game is won.</p>
    <p>
      Kingdom War is a game of hidden loyalties. Every player holds two secret Generals and belongs to the Force of
      their face-up General: Wei, Shu, Wu or Qun. Play cards, use skills and defeat the others until the seats
      still standing all belong to one Force.
    </p>
    <h3>Winning</h3>
    <ul>
      <li>The game ends when every seat still in play belongs to the same Force. Those seats win together.</li>
      <li>Qun seats never win as a group: a Qun seat wins only when it is the last seat standing.</li>
      <li>A seat that loses its last HP and is not rescued is out. It discards every card it holds.</li>
    </ul>
    <h3>Where to read next</h3>
    <ul>
      <li><a routerLink="/wiki/rules/setup">Setup</a>: how a game starts.</li>
      <li><a routerLink="/wiki/rules/turn">Turn Structure</a>: what you do on your turn.</li>
      <li><a routerLink="/wiki/rules/card-types">Card Types</a>: Basic, Tool and Equipment cards.</li>
      <li><a routerLink="/wiki/rules/distance">Distance / Range</a>: who you can reach.</li>
      <li><a routerLink="/wiki/rules/judgment">Judgment</a>: flipping the top card to decide an effect.</li>
      <li><a routerLink="/wiki/generals">Generals</a>: every General and skill.</li>
    </ul>
  `,
})
export class RulesOverview {}
