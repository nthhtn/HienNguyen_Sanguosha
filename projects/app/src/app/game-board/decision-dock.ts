import { Injectable, Signal, computed, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Force } from '../labels';

export interface MinimizedDecision {
  readonly title: string;
  readonly context: string | null;
  // The force the dialog was themed in (the banner wears the same colours); null when unknown.
  readonly force: Force | null;
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
  // Every hidden dialog, oldest first: a skill owner's Response can open over the judgment popup,
  // and both may be hidden. The banner stands for the latest; restoring it brings the next one up.
  private readonly entries = signal<readonly Entry[]>([]);
  // What MatDialog hid from assistive technology (everything outside its overlay container) that
  // we exposed again while a dialog is hidden, so the board and the banner can be read.
  private exposed: Element[] = [];
  readonly minimized: Signal<MinimizedDecision | null> = computed(() => {
    const entry = this.entries().at(-1);
    return entry ? { title: entry.title, context: entry.context, force: entry.force } : null;
  });

  minimize(ref: MatDialogRef<unknown, unknown>, title: string, context: string | null = null, force: Force | null = null): void {
    ref.addPanelClass(HIDDEN_CLASS);
    this.entries.update((all) => [...all.filter((e) => e.ref !== ref), { ref, title, context, force }]);
    this.expose();
    ref.beforeClosed().subscribe(() => this.remove(ref));
  }

  restore(): void {
    const entry = this.entries().at(-1);
    if (!entry) return;
    entry.ref.removePanelClass(HIDDEN_CLASS);
    this.remove(entry.ref);
  }

  // Closes every minimized dialog without an answer (the board is going away, or the dialogs are
  // being rebuilt); returns the latest, or null when nothing was minimized.
  dismiss(): MatDialogRef<unknown, unknown> | null {
    const all = this.entries();
    if (all.length === 0) return null;
    this.entries.set([]);
    this.hideAgain();
    for (const entry of all) entry.ref.close();
    return all[all.length - 1].ref;
  }

  private remove(ref: MatDialogRef<unknown, unknown>): void {
    this.entries.update((all) => all.filter((e) => e.ref !== ref));
    if (this.entries().length === 0) this.hideAgain();
  }

  private hideAgain(): void {
    for (const element of this.exposed) element.setAttribute('aria-hidden', 'true');
    this.exposed = [];
  }

  private expose(): void {
    this.exposed = Array.from(document.body.children).filter((el) => el.getAttribute('aria-hidden') === 'true' && !el.classList.contains('cdk-overlay-container'));
    for (const element of this.exposed) element.removeAttribute('aria-hidden');
  }
}

const HIDDEN_CLASS = 'decision-minimized';
