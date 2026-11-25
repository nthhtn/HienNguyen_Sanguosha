import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';
import { Layout } from '../layout.service';
import { Box, Size, cardPlacement, holeBlockers, holeBox } from './spotlight-geometry';
import { TutorialService } from './tutorial.service';

// Above Material's dialog layer, so the spotlight covers a dialog that holds the target. Set as inline styles with
// the pointer rules below: they are what makes the rail work, so a spec checks them.
export const OVERLAY_Z_INDEX = 2100;

// Room left around the target inside the ring.
const PADDING = 8;
// The card's size until it has been measured.
const CARD_GUESS: Size = { width: 340, height: 170 };

const sameBox = (a: Box | null, b: Box | null) => (a === null || b === null ? a === b : a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

// The Tutorial's spotlight: it dims the screen except for a hole over the step's target, rings the target and shows the
// instruction beside it. The dim layer is four boxes around the hole, so a click anywhere else lands on a box and a click
// in the hole reaches the real control. It rules nothing: what the beginner may do is the action filter's job.
@Component({
  selector: 'app-tutorial-overlay',
  imports: [MatButtonModule, TPipe],
  template: `
    @if (active()) {
      <div class="tutorial-overlay" [style.z-index]="zIndex" style="position: fixed; inset: 0; pointer-events: none">
        @for (box of blockers(); track $index) {
          <div class="blocker" style="pointer-events: auto" [style.left.px]="box.left" [style.top.px]="box.top" [style.width.px]="box.width" [style.height.px]="box.height"></div>
        }
        @if (ring(); as r) {
          <div class="ring" style="pointer-events: none" [style.left.px]="r.left" [style.top.px]="r.top" [style.width.px]="r.width" [style.height.px]="r.height"></div>
        }
        <section class="card" style="pointer-events: auto" role="status" aria-live="polite" [attr.data-side]="placement().side" [style.left.px]="placement().left" [style.top.px]="placement().top">
          <p class="text">{{ textKey()! | t }}</p>
          <div class="buttons">
            <button mat-button type="button" class="exit" (click)="tutorial.exit()">{{ 'tutorial.exit' | t }}</button>
            @if (active()!.completes.kind === 'next') {
              <button mat-flat-button type="button" class="next" (click)="tutorial.next()">{{ 'tutorial.next' | t }}</button>
            }
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .blocker { position: absolute; background: color-mix(in srgb, var(--mat-sys-scrim, #000) 62%, transparent); }
    .ring {
      position: absolute; box-sizing: border-box;
      border: 3px solid var(--mat-sys-primary, #ffb300); border-radius: 14px;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--mat-sys-primary, #ffb300) 35%, transparent), 0 0 24px color-mix(in srgb, var(--mat-sys-primary, #ffb300) 55%, transparent);
    }
    .card {
      position: absolute; box-sizing: border-box; width: 340px; max-width: calc(100vw - 16px);
      padding: 16px; border-radius: 16px; display: flex; flex-direction: column; gap: 12px;
      background: var(--mat-sys-surface-container-high, #fff); color: var(--mat-sys-on-surface, #000);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
    }
    .text { margin: 0; font-size: 1rem; line-height: 1.45; }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  `,
})
export class TutorialOverlay {
  protected readonly zIndex = OVERLAY_Z_INDEX;
  protected readonly tutorial = inject(TutorialService);
  private readonly layout = inject(Layout);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  // The step on show: none before a lesson starts or once it has finished (the page then shows what comes next).
  protected readonly active = computed(() => (this.tutorial.finished() ? null : this.tutorial.step()));
  private readonly phone = computed(() => this.layout.kind() === 'compact');
  private readonly targetId = computed(() => {
    const step = this.active();
    return step ? ((this.phone() ? step.phone?.target : undefined) ?? step.target ?? null) : null;
  });
  protected readonly textKey = computed<MessageKey | null>(() => {
    const step = this.active();
    return step ? ((this.phone() ? step.phone?.textKey : undefined) ?? step.textKey) : null;
  });

  private readonly viewport = signal<Size>({ width: window.innerWidth, height: window.innerHeight }, { equal: (a, b) => a.width === b.width && a.height === b.height });
  // The target's box on screen, or null when it is not in the page, has no size or is out of the window.
  private readonly box = signal<Box | null>(null, { equal: sameBox });
  private readonly cardSize = signal<Size>(CARD_GUESS, { equal: (a, b) => a.width === b.width && a.height === b.height });

  protected readonly blockers = computed<Box[]>(() => {
    const viewport = this.viewport();
    const box = this.box();
    return box ? holeBlockers(box, viewport, PADDING) : [{ left: 0, top: 0, width: viewport.width, height: viewport.height }];
  });
  protected readonly ring = computed(() => {
    const box = this.box();
    return box ? holeBox(box, this.viewport(), PADDING) : null;
  });
  protected readonly placement = computed(() => cardPlacement(this.box(), this.viewport(), this.cardSize()));

  private frame: number | null = null;
  private scrolled = false;
  private readonly onChange = () => this.measure();

  constructor() {
    // A new target: look for it, scroll it into view once, and follow it until the step has none.
    effect(() => {
      const id = this.targetId();
      untracked(() => this.follow(id));
    });
    window.addEventListener('resize', this.onChange);
    window.addEventListener('scroll', this.onChange, true);
    inject(DestroyRef).onDestroy(() => {
      this.stopFollowing();
      window.removeEventListener('resize', this.onChange);
      window.removeEventListener('scroll', this.onChange, true);
    });
  }

  private follow(id: string | null): void {
    this.stopFollowing();
    this.scrolled = false;
    this.box.set(null);
    if (!id) return;
    this.measure();
    // The board can move under the ring (an animation, a dialog opening, content loading): keep looking each frame.
    const tick = () => {
      this.measure();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stopFollowing(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private measure(): void {
    const viewport: Size = { width: window.innerWidth, height: window.innerHeight };
    this.viewport.set(viewport);
    const card = this.host.nativeElement.querySelector('.card');
    const cardRect = card?.getBoundingClientRect();
    if (cardRect && cardRect.width > 0 && cardRect.height > 0) this.cardSize.set({ width: cardRect.width, height: cardRect.height });
    const id = this.targetId();
    const el = id ? findAnchor(id) : null;
    if (!el) {
      this.box.set(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const inside = r.left >= 0 && r.top >= 0 && r.right <= viewport.width && r.bottom <= viewport.height;
    if (!this.scrolled && (r.width > 0 || r.height > 0)) {
      this.scrolled = true;
      if (!inside) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    const seen = r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < viewport.width && r.top < viewport.height;
    this.box.set(seen ? { left: r.left, top: r.top, width: r.width, height: r.height } : null);
  }
}

// The element carrying `data-tutorial="<id>"`, in the page or in a dialog's overlay container.
function findAnchor(id: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial]'))) {
    if (el.getAttribute('data-tutorial') === id) return el;
  }
  return null;
}
