import { Injectable, Signal, computed, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

export interface MinimizedDecision {
  readonly title: string;
  readonly context: string | null;
}

interface Entry extends MinimizedDecision {
  readonly ref: MatDialogRef<unknown, unknown>;
}

// The decision dialog the player has hidden to look at the board. Presentation state
// only: the dialog stays open (hidden by a panel class, see styles.scss), so what the
// player picked survives, and it closes through the usual paths when the decision settles
// (the banner goes as soon as it starts closing, not after the close animation).
@Injectable({ providedIn: 'root' })
export class DecisionDock {
  private readonly entry = signal<Entry | null>(null);
  // What MatDialog hid from assistive technology (everything outside its overlay container) that
  // we exposed again while the dialog is hidden, so the board and the banner can be read.
  private exposed: Element[] = [];
  readonly minimized: Signal<MinimizedDecision | null> = computed(() => {
    const entry = this.entry();
    return entry ? { title: entry.title, context: entry.context } : null;
  });

  minimize(ref: MatDialogRef<unknown, unknown>, title: string, context: string | null = null): void {
    ref.addPanelClass(HIDDEN_CLASS);
    this.entry.set({ ref, title, context });
    this.expose();
    ref.beforeClosed().subscribe(() => {
      if (this.entry()?.ref === ref) this.clear();
    });
  }

  restore(): void {
    const entry = this.entry();
    if (!entry) return;
    entry.ref.removePanelClass(HIDDEN_CLASS);
    for (const element of this.exposed) element.setAttribute('aria-hidden', 'true');
    this.clear();
  }

  // Closes the minimized dialog without an answer (the board is going away, or the dialog is
  // being rebuilt); returns it, or null when nothing was minimized.
  dismiss(): MatDialogRef<unknown, unknown> | null {
    const entry = this.entry();
    if (!entry) return null;
    this.clear();
    entry.ref.close();
    return entry.ref;
  }

  private clear(): void {
    this.entry.set(null);
    this.exposed = [];
  }

  private expose(): void {
    this.exposed = Array.from(document.body.children).filter((el) => el.getAttribute('aria-hidden') === 'true' && !el.classList.contains('cdk-overlay-container'));
    for (const element of this.exposed) element.removeAttribute('aria-hidden');
  }
}

const HIDDEN_CLASS = 'decision-minimized';
