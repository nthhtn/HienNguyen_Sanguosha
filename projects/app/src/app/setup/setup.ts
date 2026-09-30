import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../game.service';

@Component({
  selector: 'app-setup',
  template: `
    <h1>New Kingdom War game</h1>
    <label>
      Seat count (2-{{ maxSeats }}):
      <input
        type="number"
        min="2"
        [max]="maxSeats"
        [value]="seatCount()"
        (input)="seatCount.set(+$any($event.target).value)"
      />
    </label>
    <label>
      Seed (optional):
      <input type="number" (input)="seed.set($any($event.target).value ? +$any($event.target).value : undefined)" />
    </label>
    <button (click)="startGame()">Start game</button>
  `,
})
export class Setup {
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  protected readonly maxSeats = this.gameService.maxSeats;

  readonly seatCount = signal(4);
  readonly seed = signal<number | undefined>(undefined);

  startGame(): void {
    const clamped = Math.min(this.maxSeats, Math.max(2, this.seatCount() || 2));
    this.gameService.startGame(clamped, this.seed());
    this.router.navigateByUrl('/game');
  }
}
