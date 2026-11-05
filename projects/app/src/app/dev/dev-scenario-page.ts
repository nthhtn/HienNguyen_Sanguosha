import { NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, Type, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameBoard } from '../game-board/game-board';
import { GameService } from '../game.service';
import { Scenario } from './scenario';
import { findScenario } from './scenarios';

// /dev/:scenarioId: opens one scenario. A board scenario loads its prepared state into the real GameService and
// shows the real board; a screen scenario shows its component with fixture inputs. Reset starts it over.
@Component({
  selector: 'app-dev-scenario-page',
  imports: [GameBoard, MatButtonModule, NgComponentOutlet, RouterLink],
  template: `
    @if (scenario(); as s) {
      <nav class="bar">
        <a mat-button routerLink="/dev">All Scenarios</a>
        <strong>{{ s.title }}</strong>
        <button mat-flat-button type="button" (click)="reset()">Reset</button>
      </nav>
      @for (run of [run()]; track run) {
        @if (s.kind === 'board') {
          <app-game-board />
        } @else if (screen(); as component) {
          <ng-container *ngComponentOutlet="component; inputs: s.inputs ?? {}" />
        }
      }
    } @else {
      <main class="missing">
        <p>Scenario not found</p>
        <a mat-button routerLink="/dev">Back to Scenarios</a>
      </main>
    }
  `,
  styles: `
    .bar { display: flex; align-items: center; gap: 12px; padding: 8px 16px; }
    .bar strong { flex: 1; }
    .missing { padding: 16px; text-align: center; }
  `,
})
export class DevScenarioPage {
  private readonly game = inject(GameService);
  private readonly id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('scenarioId') ?? '')), { initialValue: '' });

  protected readonly scenario = computed<Scenario | undefined>(() => findScenario(this.id()));
  // Counts loads, so Reset gives the board a fresh component too.
  protected readonly run = signal(0);
  protected readonly screen = signal<Type<unknown> | null>(null);

  constructor() {
    effect(() => {
      const s = this.scenario();
      this.run();
      if (s) untracked(() => this.load(s));
    });
    inject(DestroyRef).onDestroy(() => this.game.stop());
  }

  protected reset(): void {
    this.run.update((n) => n + 1);
  }

  private load(s: Scenario): void {
    if (s.kind === 'board') this.game.startFromState(s.build(this.game.registry), 'vs-bots');
    else s.component().then((component) => this.screen.set(component));
  }
}
