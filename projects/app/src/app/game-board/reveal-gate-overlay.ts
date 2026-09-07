import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-reveal-gate-overlay',
  template: `
    <div class="reveal-gate">
      <p>Pass the device to {{ seatId() }}</p>
      <button (click)="revealed.emit()">Tap to reveal</button>
    </div>
  `,
})
export class RevealGateOverlay {
  readonly seatId = input.required<string>();
  readonly revealed = output<void>();
}
