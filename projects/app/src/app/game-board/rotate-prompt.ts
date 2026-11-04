import { Component } from '@angular/core';
import { TPipe } from '../i18n/t.pipe';

// Shown over the board while a phone is held upright: the board needs width. It starts below the app bar, so
// the menu stays reachable, and below every dialog. The game goes on underneath; nothing is paused or hidden.
@Component({
  selector: 'app-rotate-prompt',
  imports: [TPipe],
  template: `
    <div class="prompt" role="status">
      <div class="phone" aria-hidden="true"></div>
      <strong>{{ 'board.rotate.title' | t }}</strong>
      <span>{{ 'board.rotate.hint' | t }}</span>
    </div>
  `,
  styles: `
    .prompt {
      position: fixed; inset: var(--mat-toolbar-standard-height, 44px) 0 0 0; z-index: 15;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      padding: 24px; text-align: center;
      background: var(--mat-sys-surface); color: var(--mat-sys-on-surface);
    }
    strong { font: var(--mat-sys-title-large); }
    span { max-width: 280px; font: var(--mat-sys-body-large); color: var(--mat-sys-on-surface-variant); }
    .phone { width: 54px; height: 90px; border: 3px solid var(--mat-sys-primary); border-radius: 10px; animation: turn 2.6s ease-in-out infinite; }
    @keyframes turn { 0%, 25% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }
    @media (prefers-reduced-motion: reduce) { .phone { animation: none; } }
  `,
})
export class RotatePrompt {}
