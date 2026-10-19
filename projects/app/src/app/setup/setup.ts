import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { GameMode, GameService } from '../game.service';
import { TPipe } from '../i18n/t.pipe';

@Component({
  selector: 'app-setup',
  imports: [MatButtonModule, MatCheckboxModule, MatButtonToggleModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, TPipe],
  template: `
    <div class="home" style="background-image: url('/card-art/misc/landing.jpg')">
      <mat-card class="hero" appearance="raised">
        <div class="kingdoms" aria-hidden="true">
          <span class="wei"></span><span class="shu"></span><span class="wu"></span><span class="qun"></span>
        </div>
        <mat-card-header>
          <mat-card-title>{{ 'app.title' | t }}</mat-card-title>
          <mat-card-subtitle>{{ (mode() === 'vs-bots' ? 'setup.subtitle.bots' : 'setup.subtitle.pass') | t }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <ul class="how">
            <li><mat-icon>groups</mat-icon>{{ 'setup.how.groups' | t }}</li>
            @if (mode() === 'vs-bots') {
              <li><mat-icon>smart_toy</mat-icon>{{ 'setup.how.bots' | t }}</li>
            } @else {
              <li><mat-icon>swap_horiz</mat-icon>{{ 'setup.how.pass' | t }}</li>
            }
            <li><mat-icon>emoji_events</mat-icon>{{ 'setup.how.win' | t }}</li>
          </ul>

          <div class="field">
            <span class="label" id="mode-label">{{ 'setup.mode' | t }}</span>
            <mat-button-toggle-group
              class="mode"
              aria-labelledby="mode-label"
              [hideSingleSelectionIndicator]="true"
              [value]="mode()"
              (change)="mode.set($event.value)"
            >
              <mat-button-toggle value="vs-bots"><mat-icon>smart_toy</mat-icon> {{ 'setup.mode.bots' | t }}</mat-button-toggle>
              <mat-button-toggle value="pass-and-play"><mat-icon>groups</mat-icon> {{ 'setup.mode.pass' | t }}</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
          <p class="mode-hint">
            {{ (mode() === 'vs-bots' ? 'setup.hint.bots' : 'setup.hint.pass') | t }}
          </p>
          <div class="field">
            <span class="label" id="seat-label">{{ 'setup.seats' | t }}</span>
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

          @if (showFirstReveal()) {
            <div class="field">
              <mat-checkbox class="first-reveal" [checked]="firstRevealDraw()" (change)="firstRevealDraw.set($event.checked)">{{ 'setup.firstReveal' | t }}</mat-checkbox>
            </div>
            <p class="rule-hint">{{ 'setup.firstReveal.hint' | t }}</p>
          }

          <div class="names">
            @for (i of nameSlots(); track i) {
              <mat-form-field appearance="outline" class="name-field">
                <mat-label>{{ mode() === 'vs-bots' ? ('setup.name.you' | t) : ('setup.name.seat' | t: { n: i }) }}</mat-label>
                <input
                  matInput
                  class="name"
                  maxlength="24"
                  [placeholder]="'label.seat' | t: { n: i }"
                  [value]="names()[i] ?? ''"
                  (input)="setName(i, $any($event.target).value)"
                />
              </mat-form-field>
            }
          </div>

        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-flat-button type="button" class="start" (click)="startGame()">
            <mat-icon>play_arrow</mat-icon> {{ 'setup.start' | t }}
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
      background-color: var(--mat-sys-surface-container-low);
      background-size: cover;
      background-position: center;
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
    .rule-hint { margin: -12px 0 16px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
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
  readonly firstRevealDraw = signal(true);
  // The rule needs a big table, so the option only appears there.
  protected readonly showFirstReveal = computed(() => this.seatCount() >= FIRST_REVEAL_MIN_SEATS);
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
    this.gameService.startGame(clamped, undefined, this.mode(), this.nameSlots().map((i) => this.names()[i] ?? ''), clamped >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw: this.firstRevealDraw() } : undefined);
    this.router.navigateByUrl('/game');
  }
}
