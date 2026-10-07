import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { GameMode, GameService } from '../game.service';

@Component({
  selector: 'app-setup',
  imports: [MatButtonModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <div class="home">
      <mat-card class="hero" appearance="raised">
        <div class="kingdoms" aria-hidden="true">
          <span class="wei"></span><span class="shu"></span><span class="wu"></span><span class="qun"></span>
        </div>
        <mat-card-header>
          <mat-card-title>Kingdom War</mat-card-title>
          <mat-card-subtitle>Guozhan · {{ mode() === 'vs-bots' ? 'you against computer opponents' : 'pass-and-play on one device' }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <ul class="how">
            <li><mat-icon>groups</mat-icon>Each seat picks two hidden Generals of one kingdom.</li>
            @if (mode() === 'vs-bots') {
              <li><mat-icon>smart_toy</mat-icon>Bots play their own turns — you only ever see your own cards.</li>
            } @else {
              <li><mat-icon>swap_horiz</mat-icon>Pass the device — every seat sees only its own cards.</li>
            }
            <li><mat-icon>emoji_events</mat-icon>The last kingdom standing wins.</li>
          </ul>

          <div class="field">
            <span class="label" id="mode-label">Mode</span>
            <mat-button-toggle-group
              class="mode"
              aria-labelledby="mode-label"
              [hideSingleSelectionIndicator]="true"
              [value]="mode()"
              (change)="mode.set($event.value)"
            >
              <mat-button-toggle value="vs-bots"><mat-icon>smart_toy</mat-icon> Play vs Bots</mat-button-toggle>
              <mat-button-toggle value="pass-and-play"><mat-icon>groups</mat-icon> Pass and Play</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
          <p class="mode-hint">
            {{ mode() === 'vs-bots'
              ? 'You take the first seat; every other seat is a computer opponent.'
              : 'Everyone plays on this device, passing it between turns.' }}
          </p>
          <div class="field">
            <span class="label" id="seat-label">Seats</span>
            <mat-button-toggle-group
              class="seats"
              aria-labelledby="seat-label"
              [hideSingleSelectionIndicator]="true"
              [value]="seatCount()"
              (change)="seatCount.set($event.value)"
            >
              @for (n of seatOptions; track n) {
                <mat-button-toggle [value]="n">{{ n }}</mat-button-toggle>
              }
            </mat-button-toggle-group>
          </div>

          <div class="names">
            @for (i of nameSlots(); track i) {
              <mat-form-field appearance="outline" class="name-field">
                <mat-label>{{ mode() === 'vs-bots' ? 'Your Name' : 'Seat ' + i + ' Name' }}</mat-label>
                <input
                  matInput
                  class="name"
                  maxlength="24"
                  [placeholder]="'Seat ' + i"
                  [value]="names()[i] ?? ''"
                  (input)="setName(i, $any($event.target).value)"
                />
              </mat-form-field>
            }
          </div>

          <mat-form-field appearance="outline" class="seed-field">
            <mat-label>Seed</mat-label>
            <input
              matInput
              class="seed"
              type="number"
              (input)="seed.set($any($event.target).value ? +$any($event.target).value : undefined)"
            />
            <mat-hint>Optional. The same seed replays the same deal.</mat-hint>
          </mat-form-field>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-flat-button type="button" class="start" (click)="startGame()">
            <mat-icon>play_arrow</mat-icon> Start Game
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .home {
      /* Full-bleed: cancel the app shell's content padding. */
      margin: 0 -16px -16px;
      min-height: calc(100vh - 64px);
      display: grid;
      place-items: center;
      padding: 24px 16px;
      box-sizing: border-box;
      background:
        radial-gradient(circle at 20% 20%, rgb(59 51 44 / 8%), transparent 45%),
        radial-gradient(circle at 80% 80%, rgb(59 51 44 / 8%), transparent 45%),
        var(--mat-sys-surface-container-low);
    }
    .hero { width: min(100%, 520px); overflow: hidden; }
    .kingdoms { display: flex; height: 6px; }
    .kingdoms span { flex: 1; }
    .wei { background: #3f6fd8; }
    .shu { background: #d84a3f; }
    .wu { background: #2f9e58; }
    .qun { background: #8a7f8c; }
    mat-card-header { padding-top: 20px; }
    mat-card-title { font: var(--mat-sys-headline-medium) !important; }
    .how { list-style: none; padding: 0; margin: 16px 0 24px; }
    .how li { display: flex; align-items: center; gap: 12px; margin: 10px 0; color: var(--mat-sys-on-surface-variant); }
    .how mat-icon { color: var(--mat-sys-primary); }
    .field { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .label { font: var(--mat-sys-title-small); min-width: 48px; }
    .names { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); column-gap: 12px; }
    .seed-field { width: 100%; }
    .mode-hint { margin: -12px 0 16px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .mode mat-icon { margin-right: 4px; font-size: 18px; width: 18px; height: 18px; vertical-align: middle; }
    .start { padding: 0 24px; }
  `,
})
export class Setup {
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  protected readonly maxSeats = this.gameService.maxSeats;
  protected readonly seatOptions = Array.from({ length: this.maxSeats - 1 }, (_, i) => i + 2);

  readonly mode = signal<GameMode>('vs-bots');
  readonly seatCount = signal(4);
  readonly seed = signal<number | undefined>(undefined);
  // Typed names by seat index; blanks fall back to "Seat N".
  readonly names = signal<(string | undefined)[]>([]);
  // Vs bots asks only for the human's name (seat 0); pass-and-play asks for every seat's.
  protected readonly nameSlots = computed(() =>
    this.mode() === 'vs-bots' ? [0] : Array.from({ length: this.seatCount() }, (_, i) => i)
  );

  setName(index: number, value: string): void {
    const names = [...this.names()];
    names[index] = value;
    this.names.set(names);
  }

  startGame(): void {
    const clamped = Math.min(this.maxSeats, Math.max(2, this.seatCount() || 2));
    this.gameService.startGame(clamped, this.seed(), this.mode(), this.nameSlots().map((i) => this.names()[i] ?? ''));
    this.router.navigateByUrl('/game');
  }
}
