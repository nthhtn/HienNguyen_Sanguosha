import { Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GameOver } from '../game-board/game-over';
import { TPipe } from '../i18n/t.pipe';
import { GAME_OVER_CASES } from './game-over-fixtures';

// One Game Over page for every ending: a switcher picks the fixture, and Replay recreates the real screen so its
// reveal plays again.
@Component({
  selector: 'app-game-over-preview',
  imports: [GameOver, MatButtonModule, MatIconModule, TPipe],
  template: `
    <div class="bar">
      <label class="pick">
        <span>{{ 'preview.victoryCase' | t }}</span>
        <select (change)="caseKey.set($any($event.target).value)">
          @for (key of keys; track key) {
            <option [value]="key" [selected]="key === caseKey()">{{ cases[key].title | t }}</option>
          }
        </select>
      </label>
      <button mat-stroked-button type="button" class="replay" (click)="replay.set(replay() + 1)"><mat-icon>replay</mat-icon><span class="text">{{ 'preview.replay' | t }}</span></button>
    </div>
    @for (run of [replay()]; track run) {
      <app-game-over [result]="current().result" [seats]="current().seats" youSeatId="seat-0" />
    }
  `,
  styles: `
    .bar { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 8px 0 0; }
    .pick { display: flex; align-items: center; gap: 8px; font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
    select { min-height: 36px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--mat-sys-outline); background: var(--mat-sys-surface); color: var(--mat-sys-on-surface); font: var(--mat-sys-body-medium); }
    select:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: 1px; }
  `,
})
export class GameOverPreview {
  protected readonly cases = GAME_OVER_CASES;
  protected readonly keys = Object.keys(GAME_OVER_CASES);
  protected readonly caseKey = signal(this.keys[0]);
  protected readonly replay = signal(0);

  protected current() {
    return GAME_OVER_CASES[this.caseKey()];
  }
}
