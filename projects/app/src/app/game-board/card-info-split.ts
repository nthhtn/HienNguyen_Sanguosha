import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { CardInstance } from 'engine';
import { TPipe } from '../i18n/t.pipe';
import { Layout } from '../layout.service';
import { CardInfoPane } from './card-info-pane';

// How much wider a popup becomes while its card info is open beside the list.
const INFO_WIDTH_PX = 480;
// The room kept between the grown popup and the left edge of the window.
const EDGE_GAP_PX = 24;

// A popup's content (the History or Discard list) with the info of a selected card.
// - On a large window the info opens to the left of the list and the popup grows to the left, its right edge
//   staying where it was. Escape, a click outside and the pane's button close the pane before the popup.
// - On a narrower window there is no room beside the list: the info is a tab (the list's tab, then Card Info), and
//   selecting a card switches to it.
@Component({
  selector: 'app-card-info-split',
  imports: [NgTemplateOutlet, MatTabsModule, MatButtonModule, MatIconModule, CardInfoPane, TPipe],
  template: `
    <ng-template #main><ng-content /></ng-template>
    @if (tabs()) {
      <mat-tab-group animationDuration="0ms" stretchTabs="true" [selectedIndex]="tab()" (selectedIndexChange)="tab.set($event)">
        <mat-tab [label]="listLabel()">
          <ng-container [ngTemplateOutlet]="main" />
        </mat-tab>
        <mat-tab [label]="'card.info.tab' | t" [disabled]="!card()">
          @if (card(); as c) {
            <div class="tab-info"><app-card-info-pane [card]="c" /></div>
          }
        </mat-tab>
      </mat-tab-group>
    } @else {
      <div class="split">
        @if (card(); as c) {
          <aside class="info">
            <button mat-icon-button type="button" class="close" [attr.aria-label]="'card.info.close' | t" (click)="closed.emit()"><mat-icon>close</mat-icon></button>
            <app-card-info-pane [card]="c" [sideBySide]="true" />
          </aside>
        }
        <div class="main"><ng-container [ngTemplateOutlet]="main" /></div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .split { display: flex; align-items: stretch; gap: 16px; }
    .info { position: relative; flex: none; width: ${INFO_WIDTH_PX - 16}px; box-sizing: border-box; padding: 28px 20px 24px 32px; border-right: 1px solid var(--mat-sys-outline-variant); }
    .close { position: absolute; top: 4px; right: 4px; }
    .main { flex: 1; min-width: 0; }
    .tab-info { padding: 16px 24px; }
  `,
})
export class CardInfoSplit {
  // The selected card, or null.
  readonly card = input<CardInstance | null>(null);
  // The list's tab label on a narrow window.
  readonly listLabel = input.required<string>();
  // The pane asks to be closed (its button, Escape or a click outside the popup).
  readonly closed = output<void>();

  private readonly layout = inject(Layout);
  private readonly ref = inject(MatDialogRef, { optional: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tabs = () => this.layout.kind() !== 'large';
  protected readonly tab = signal(0);
  // The popup's width and distance from the right edge of the window before it grew.
  private grown: { width: number; right: number } | null = null;

  constructor() {
    // Selecting a card opens its tab; clearing it goes back to the list.
    effect(() => {
      const open = !!this.card();
      untracked(() => this.tab.set(open ? 1 : 0));
    });
    // A wide window: the popup grows to the left while the info is open, and shrinks back to where it was.
    effect(() => {
      const open = !!this.card() && !this.tabs();
      untracked(() => this.resize(open));
    });
    // The pane closes before the popup does: Escape and a click outside only close the pane while it is open.
    effect((onCleanup) => {
      const ref = this.ref;
      if (!ref || !this.card() || this.tabs()) return;
      const before = ref.disableClose;
      ref.disableClose = true;
      const subs = [ref.keydownEvents().subscribe((e) => e.key === 'Escape' && this.closed.emit()), ref.backdropClick().subscribe(() => this.closed.emit())];
      onCleanup(() => {
        subs.forEach((s) => s.unsubscribe());
        ref.disableClose = before;
      });
    });
    inject(DestroyRef).onDestroy(() => (this.grown = null));
  }

  private pane(): HTMLElement | null {
    return this.host.nativeElement.closest('.cdk-overlay-pane');
  }

  private resize(open: boolean): void {
    const ref = this.ref;
    if (!ref) return;
    if (open && !this.grown) {
      const rect = this.pane()?.getBoundingClientRect();
      const width = rect?.width ?? 0;
      const right = rect ? window.innerWidth - rect.right : 0;
      this.grown = { width, right };
      // Normally the right edge stays put and the popup grows to the left; with too little room on the left it also moves
      // right by the shortfall, so it keeps a gap from the window's edge.
      const shift = Math.max(0, INFO_WIDTH_PX - Math.max(0, (rect?.left ?? 0) - EDGE_GAP_PX));
      // Material caps the dialog's pane at 560 px with this variable: lift the cap while the info is beside the list.
      this.pane()?.style.setProperty('--mat-dialog-container-max-width', 'none');
      ref.updateSize(`${Math.min(width + INFO_WIDTH_PX, window.innerWidth * 0.96)}px`);
      ref.updatePosition({ right: `${Math.max(0, right - shift)}px` });
    } else if (!open && this.grown) {
      const { width } = this.grown;
      this.grown = null;
      this.pane()?.style.removeProperty('--mat-dialog-container-max-width');
      ref.updateSize(width > 0 ? `${width}px` : undefined);
      ref.updatePosition();
    }
  }
}
