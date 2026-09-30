import { Component, computed, input } from '@angular/core';
import { cardArtUrl } from 'content';

@Component({
  selector: 'app-card-art',
  template: `
    @if (url(); as url) {
      <img [src]="url" [alt]="label()" class="card-art" />
    } @else {
      <div class="card-art card-art-placeholder">{{ label() }}</div>
    }
  `,
  styles: `
    .card-art {
      height: 96px;
      width: 70px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #888;
    }

    .card-art-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 0.7em;
      padding: 2px;
      background: #eee;
      color: #444;
      box-sizing: border-box;
    }
  `,
})
export class CardArt {
  readonly id = input.required<string>();
  readonly label = input.required<string>();

  protected readonly url = computed(() => cardArtUrl(this.id()));
}
