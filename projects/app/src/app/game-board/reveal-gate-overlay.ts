import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reveal-gate-overlay',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="reveal-gate">
      <mat-card appearance="raised" class="gate-card">
        <mat-icon class="big-icon">phone_android</mat-icon>
        <h2>Pass the device to {{ name() }}</h2>
        <p>Everyone else, Look away — The next screen shows {{ name() }}'s private cards.</p>
        <button mat-flat-button type="button" (click)="revealed.emit()">
          <mat-icon>visibility</mat-icon> Tap to Reveal
        </button>
      </mat-card>
    </div>
  `,
  styles: `
    .reveal-gate { display: grid; place-items: center; min-height: 60vh; padding: 24px 0; }
    .gate-card { width: min(100%, 420px); padding: 32px 24px; text-align: center; align-items: center; gap: 8px; }
    .big-icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary); }
    h2 { margin: 8px 0 0; font: var(--mat-sys-headline-small); }
    p { color: var(--mat-sys-on-surface-variant); margin: 0 0 16px; }
  `,
})
export class RevealGateOverlay {
  readonly name = input.required<string>();
  readonly revealed = output<void>();
}
