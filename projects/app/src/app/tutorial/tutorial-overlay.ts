import { OverlayContainer } from '@angular/cdk/overlay';
import { Component, DestroyRef, Directive, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PlaybackGate } from '../playback-gate.service';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';
import { Layout } from '../layout.service';
import { anchorBox } from './anchor-rect';
import { isWaiting } from './step-rules';
import { Box, Size, cardPlacement, holeBlockers, holeBox } from './spotlight-geometry';
import { TutorialService } from './tutorial.service';

// Ranks the spotlight above the page. Dialogs are not ranked by it: they open in the browser's top layer (see TopLayer).
// Set as inline styles with the pointer rules below: they are what makes the rail work, so a spec checks them.
export const OVERLAY_Z_INDEX = 2100;

// Room left around the target inside the ring.
const PADDING = 8;
// The card's size until it has been measured.
const CARD_GUESS: Size = { width: 340, height: 170 };

const sameBox = (a: Box | null, b: Box | null) => (a === null || b === null ? a === b : a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

// Puts its element in the browser's top layer, above every dialog. Material opens a dialog as a popover, and in the top
// layer a later popover always sits over an earlier one whatever their z-index. So the spotlight is a popover too, and
// goes to the top again each time something is added to the overlay container (a dialog opening, a menu).
@Directive({ selector: '[appTutorialTopLayer]', host: { popover: 'manual' } })
export class TutorialTopLayer {
  constructor() {
    const el: HTMLElement = inject(ElementRef).nativeElement;
    // Without the Popover API the z-index is all there is.
    if (typeof el.showPopover !== 'function') return;
    const container = inject(OverlayContainer).getContainerElement();
    const raise = () => {
      try {
        // Hidden first: showing a popover that is already open leaves it where it is in the stack.
        el.hidePopover();
      } catch {
        // Not open yet.
      }
      try {
        el.showPopover();
      } catch {
        // Not in the page yet, or already open.
      }
    };
    afterNextRender(raise, { injector: inject(Injector) });
    const observer = new MutationObserver(raise);
    observer.observe(container, { childList: true });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}

// The Tutorial's spotlight: it dims the screen except for a hole over the step's target, rings the target and shows the
// instruction beside it. The dim layer is four boxes around the hole, so a click anywhere else lands on a box and a click
// in the hole reaches the real control. It rules nothing: what the beginner may do is the action filter's job.
@Component({
  selector: 'app-tutorial-overlay',
  imports: [MatButtonModule, TPipe, TutorialTopLayer],
  template: `
    @if (active()) {
      <div class="tutorial-overlay" appTutorialTopLayer [style.z-index]="zIndex" style="position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; pointer-events: none">
        @for (box of blockers(); track $index) {
          <div class="blocker" style="pointer-events: auto" [style.left.px]="box.left" [style.top.px]="box.top" [style.width.px]="box.width" [style.height.px]="box.height"></div>
        }
        @if (ring(); as r) {
          <div class="ring" style="pointer-events: none" [style.left.px]="r.left" [style.top.px]="r.top" [style.width.px]="r.width" [style.height.px]="r.height"></div>
        }
        @if (minimized()) {
          <div class="minimized" style="pointer-events: auto" role="status">
            <button mat-flat-button type="button" class="restore" (click)="minimized.set(false)">{{ 'tutorial.restore' | t }}</button>
            <button mat-button type="button" class="exit" (click)="tutorial.exit()">{{ 'tutorial.exit' | t }}</button>
            @if (active()!.completes.kind === 'next') {
              <button mat-button type="button" class="next" (click)="tutorial.next()">{{ 'tutorial.next' | t }}</button>
            }
          </div>
        } @else {
          <section class="card" [class.compact]="waiting()" style="pointer-events: auto" role="status" aria-live="polite" [attr.data-side]="placement().side" [style.left.px]="placement().left" [style.top.px]="placement().top">
            <p class="text">{{ textKey()! | t }}</p>
            <div class="buttons">
              <button mat-button type="button" class="minimize" (click)="minimized.set(true)">{{ 'tutorial.minimize' | t }}</button>
              <button mat-button type="button" class="exit" (click)="tutorial.exit()">{{ 'tutorial.exit' | t }}</button>
              @if (active()!.completes.kind === 'next') {
                <button mat-flat-button type="button" class="next" (click)="tutorial.next()">{{ 'tutorial.next' | t }}</button>
              }
            </div>
          </section>
        }
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
    /* A waiting step shrinks to a small, see-through note, so the board behind it stays in view. */
    .card.compact { width: 240px; padding: 8px 12px; gap: 4px; border-radius: 12px; opacity: 0.85; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); }
    .compact .text { font-size: 0.85rem; line-height: 1.35; }
    /* The card put away: two small buttons in the bottom-left corner, so the board is in full view. */
    .minimized {
      position: absolute; left: 8px; bottom: 8px; display: flex; gap: 4px; align-items: center; padding: 4px 6px; border-radius: 999px;
      background: var(--mat-sys-surface-container-high, #fff); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35); opacity: 0.9;
    }
    .text { margin: 0; font-size: 1rem; line-height: 1.45; }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  `,
})
export class TutorialOverlay {
  protected readonly zIndex = OVERLAY_Z_INDEX;
  protected readonly tutorial = inject(TutorialService);
  private readonly layout = inject(Layout);
  private readonly gate = inject(PlaybackGate);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  // The step on show: none before a lesson starts, once it has finished (the page then shows what comes next), or
  // while the board is covered by the rotate or install prompt. A spotlight there would ring controls the prompt
  // is hiding.
  protected readonly active = computed(() => (this.tutorial.finished() || !this.layout.canPlay() ? null : this.tutorial.step()));
  private readonly phone = computed(() => this.layout.kind() === 'compact');
  // The step's anchor ids in the order to try them; none for a centred card.
  private readonly targetIds = computed<string[]>(
    () => {
      const step = this.active();
      const target = step ? ((this.phone() ? step.phone?.target : undefined) ?? step.target) : undefined;
      return target === undefined ? [] : Array.isArray(target) ? target : [target];
    },
    { equal: (a, b) => a.length === b.length && a.every((id, i) => id === b[i]) }
  );
  protected readonly textKey = computed<MessageKey | null>(() => {
    const step = this.active();
    return step ? ((this.phone() ? step.phone?.textKey : undefined) ?? step.textKey) : null;
  });

  private readonly viewport = signal<Size>({ width: window.innerWidth, height: window.innerHeight }, { equal: (a, b) => a.width === b.width && a.height === b.height });
  // The target's box on screen, or null when it is not in the page, has no size or is out of the window.
  private readonly box = signal<Box | null>(null, { equal: sameBox });
  private readonly cardSize = signal<Size>(CARD_GUESS, { equal: (a, b) => a.width === b.width && a.height === b.height });

  // Nothing to click while a bot moves, the board plays an animation or a popup closes by itself, so nothing is dimmed, the note shrinks, and the board can be watched.
  protected readonly waiting = computed(() => {
    const step = this.active();
    // Also while the board plays something out, whatever the step: the beginner is only watching then.
    return !!step && (isWaiting(step) || !this.gate.idle());
  });
  // The beginner has put the card away to see the board; it stays away until they bring it back or another lesson starts.
  protected readonly minimized = signal(false);
  protected readonly blockers = computed<Box[]>(() => {
    if (this.waiting() || this.minimized()) return [];
    const viewport = this.viewport();
    const box = this.box();
    return box ? holeBlockers(box, viewport, PADDING) : [{ left: 0, top: 0, width: viewport.width, height: viewport.height }];
  });
  // The ring stays on a waiting step: its target is what to watch (a judgment's result). Only a minimized card drops it.
  protected readonly ring = computed(() => {
    if (this.minimized()) return null;
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
      const ids = this.targetIds();
      untracked(() => this.follow(ids));
    });
    // A new lesson starts with the card open; within a lesson it stays as the beginner left it.
    effect(() => {
      this.tutorial.lesson();
      untracked(() => this.minimized.set(false));
    });
    window.addEventListener('resize', this.onChange);
    window.addEventListener('scroll', this.onChange, true);
    inject(DestroyRef).onDestroy(() => {
      this.stopFollowing();
      window.removeEventListener('resize', this.onChange);
      window.removeEventListener('scroll', this.onChange, true);
    });
  }

  private follow(ids: string[]): void {
    this.stopFollowing();
    this.scrolled = false;
    this.box.set(null);
    if (ids.length === 0) return;
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
    const el = findAnchor(this.targetIds());
    if (!el) {
      this.box.set(null);
      return;
    }
    const r = anchorBox(el);
    const right = r.left + r.width;
    const bottom = r.top + r.height;
    const inside = r.left >= 0 && r.top >= 0 && right <= viewport.width && bottom <= viewport.height;
    if (!this.scrolled && (r.width > 0 || r.height > 0)) {
      this.scrolled = true;
      if (!inside) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
    const seen = r.width > 0 && r.height > 0 && right > 0 && bottom > 0 && r.left < viewport.width && r.top < viewport.height;
    this.box.set(seen ? r : null);
  }
}

// The element carrying `data-tutorial="<id>"` for the first of `ids` that has one, in the page or in a dialog's overlay container.
function findAnchor(ids: string[]): HTMLElement | null {
  const anchored = Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial]'));
  for (const id of ids) {
    const el = anchored.find((candidate) => candidate.getAttribute('data-tutorial') === id);
    if (el) return el;
  }
  return null;
}
