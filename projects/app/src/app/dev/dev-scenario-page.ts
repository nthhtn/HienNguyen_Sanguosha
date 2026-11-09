import { NgComponentOutlet } from '@angular/common';
import { Component, DestroyRef, Type, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameBoard } from '../game-board/game-board';
import { GameService } from '../game.service';
import { TPipe } from '../i18n/t.pipe';
import { Scenario } from './scenario';
import { findScenario } from './scenarios';

// /preview/:scenarioId: opens one scenario. A board scenario loads its prepared state into the real GameService and
// shows the real board; a screen scenario shows its component with fixture inputs. Reset starts it over.
@Component({
  selector: 'app-dev-scenario-page',
  imports: [GameBoard, MatButtonModule, MatIconModule, NgComponentOutlet, RouterLink, TPipe],
  template: `
    @if (scenario(); as s) {
      <nav class="bar">
        <a mat-button class="back" routerLink="/preview"><mat-icon>arrow_back</mat-icon><span class="text">{{ 'preview.allScenarios' | t }}</span></a>
        <strong class="name">{{ s.title | t }}</strong>
        <button mat-stroked-button type="button" class="reset" (click)="reset()"><mat-icon>replay</mat-icon><span class="text">{{ 'preview.reset' | t }}</span></button>
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
        <mat-icon aria-hidden="true">search_off</mat-icon>
        <p>{{ 'preview.notFound' | t }}</p>
        <a mat-flat-button routerLink="/preview"><mat-icon>arrow_back</mat-icon><span class="text">{{ 'preview.backToScenarios' | t }}</span></a>
      </main>
    }
  `,
  styles: `
    .bar { display: flex; align-items: center; gap: 12px; padding: 8px 0; }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--mat-sys-title-medium); }
    .missing { display: grid; justify-items: center; gap: 12px; padding: 64px 16px; text-align: center; color: var(--mat-sys-on-surface-variant); }
    .missing mat-icon { width: 48px; height: 48px; font-size: 48px; }
    .missing p { margin: 0; font: var(--mat-sys-title-large); color: var(--mat-sys-on-surface); }
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
