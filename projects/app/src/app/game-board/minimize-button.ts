import { Component, ElementRef, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { TPipe } from '../i18n/t.pipe';
import { DecisionDock } from './decision-dock';

// "View Board" in a decision dialog's title row: hides the dialog (see DecisionDock) so the
// player can look at the board; the banner brings it back. The banner's title is the dialog's own.
@Component({
  selector: 'app-minimize-button',
  imports: [MatButtonModule, TPipe],
  template: `<button mat-button type="button" class="minimize" (click)="minimize()">{{ 'decision.viewBoard' | t }}</button>`,
})
export class MinimizeButton {
  readonly context = input<string | null>(null);
  private readonly dock = inject(DecisionDock);
  private readonly ref = inject<MatDialogRef<unknown, unknown>>(MatDialogRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected minimize(): void {
    const container = this.host.nativeElement.closest('.mat-mdc-dialog-container');
    const title = container?.querySelector('[mat-dialog-title]')?.textContent?.trim() ?? '';
    this.dock.minimize(this.ref, title, this.context());
  }
}
