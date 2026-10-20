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
  readonly minimized: Signal<MinimizedDecision | null> = computed(() => {
    const entry = this.entry();
    return entry ? { title: entry.title, context: entry.context } : null;
  });

  minimize(ref: MatDialogRef<unknown, unknown>, title: string, context: string | null = null): void {
    ref.addPanelClass(HIDDEN_CLASS);
    this.entry.set({ ref, title, context });
    ref.beforeClosed().subscribe(() => {
      if (this.entry()?.ref === ref) this.entry.set(null);
    });
  }

  restore(): void {
    const entry = this.entry();
    if (!entry) return;
    entry.ref.removePanelClass(HIDDEN_CLASS);
    this.entry.set(null);
  }
}

const HIDDEN_CLASS = 'decision-minimized';
