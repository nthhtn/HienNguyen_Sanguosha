import { afterNextRender, Component, computed, DestroyRef, ElementRef, inject, input, viewChild } from '@angular/core';
import { spriteSheet, SpriteId } from 'content';
import { framePosition, spriteKeyframes, spritePlan } from './sprite-plan';

// A frame animation over a seat (a hit, a chain): plays once, holds its last frame and fades out. The
// owner removes it when `spriteDurationMs` has passed. Where the browser cannot animate, or the player
// prefers reduced motion, it shows the sprite's peak frame still for that time instead.
@Component({
  selector: 'app-sprite-effect',
  host: { 'aria-hidden': 'true', '[style.width]': 'width()' },
  template: `<div
    #sprite
    class="sprite"
    [style.background-image]="'url(' + sheet().url + ')'"
    [style.background-size]="sheet().cols * 100 + '% ' + sheet().rows * 100 + '%'"
    [style.background-position]="still()"
    [style.aspect-ratio]="sheet().width + ' / ' + sheet().height"
  ></div>`,
  styles: `
    :host { display: block; }
    .sprite { width: 100%; background-repeat: no-repeat; transform-origin: center; }
  `,
})
export class SpriteEffect {
  readonly image = input.required<SpriteId>();

  protected readonly sheet = computed(() => spriteSheet(this.image()));
  protected readonly width = computed(() => `min(100%, ${this.sheet().width}px)`);

  private readonly canAnimate =
    typeof HTMLElement !== 'undefined' &&
    typeof HTMLElement.prototype.animate === 'function' &&
    !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  protected readonly still = computed(() => framePosition(this.sheet(), this.canAnimate ? 0 : this.sheet().peak));

  private readonly sprite = viewChild.required<ElementRef<HTMLElement>>('sprite');
  private readonly playing: Animation[] = [];

  constructor() {
    afterNextRender(() => this.play());
    inject(DestroyRef).onDestroy(() => this.playing.forEach((a) => a.cancel()));
  }

  private play(): void {
    if (!this.canAnimate) return;
    const sheet = this.sheet();
    const plan = spritePlan(sheet);
    const { frames, fade } = spriteKeyframes(sheet, plan);
    const element = this.sprite().nativeElement;
    const options = { duration: plan.totalMs, fill: 'forwards' } as const;
    this.playing.push(element.animate(frames, options), element.animate(fade, options));
  }
}
