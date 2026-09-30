import { Component, computed, input } from '@angular/core';
import { cardArtUrl } from 'content';

@Component({
  selector: 'app-card-art',
  template: `
    @if (url(); as url) {
      <img [src]="url" [alt]="label()" class="card-art" [class.small]="size() === 'small'" />
    } @else {
      <div class="card-art card-art-placeholder" [class.small]="size() === 'small'">{{ label() }}</div>
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

    .card-art.small {
      height: 60px;
      width: 44px;
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
  readonly size = input<'normal' | 'small'>('normal');

  protected readonly url = computed(() => cardArtUrl(this.id()));
}
