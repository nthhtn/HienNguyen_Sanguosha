import { Component, computed, input } from '@angular/core';
import type { WikiCard } from 'content';
import { CardArt } from '../game-board/card-art';
import { printingLabel } from './printing-label';

// One card in the Wiki: art beside its rules text, stats and printings.
@Component({
  selector: 'app-wiki-card-entry',
  imports: [CardArt],
  template: `
    <article class="entry" [attr.data-id]="card().id">
      <app-card-art [id]="card().id" [label]="card().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ card().name }}</span>
            @if (card().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
          <span class="badge" [class.on]="card().inGame">{{ card().inGame ? 'In the game' : 'Not in the game yet' }}</span>
        </header>
        @if (card().range !== null) {
          <p class="range">Range {{ card().range }}</p>
        }
        @if (card().text; as text) {
          <p class="text">{{ text }}</p>
        } @else {
          <p class="gap">Rules text not available</p>
        }
        @if (card().printings.length > 0) {
          <p class="printings">{{ copies() }} copies: {{ printings() }}</p>
        } @else {
          <p class="gap">Printings not recorded</p>
        }
      </div>
    </article>
  `,
  styles: `
    .entry { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .body { flex: 1; min-width: 0; }
    header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
    h4 { margin: 0; font: var(--mat-sys-title-large); }
    .zh { margin-left: 8px; color: var(--mat-sys-on-surface-variant); }
    .badge { padding: 2px 10px; border-radius: 12px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .badge.on { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); }
    .range { margin: 8px 0 0; font-weight: 600; }
    .text { margin: 8px 0; }
    .printings { margin: 8px 0; letter-spacing: 0.04em; }
    .gap { margin: 8px 0; color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiCardEntry {
  readonly card = input.required<WikiCard>();
  protected readonly copies = computed(() => this.card().count ?? this.card().printings.length);
  protected readonly printings = computed(() => this.card().printings.map(printingLabel).join(' '));
}
