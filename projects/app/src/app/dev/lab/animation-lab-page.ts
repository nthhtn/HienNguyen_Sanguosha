import { ApplicationRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { GameBoard } from '../../game-board/game-board';
import { GameOver } from '../../game-board/game-over';
import { GameService } from '../../game.service';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { cardIdDisplayName } from '../../labels';
import { GAME_OVER_CASES } from '../game-over-fixtures';
import { ANIMATIONS } from './animations';
import { LAB_GROUP_TITLES, LAB_SEATS, LabAnimation, LabParam, LabParamValue, defaultParams, labTable } from './lab-animation';

type Values = Record<string, LabParamValue>;
const PHASES = ['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End'] as const;

// /preview/animations: the real board on a clean table, and a button per animation. A Play shows the clean
// table, then the same table with the animation's events appended, so the board's playback plays what is new.
// The Victory reveal is its own view; Judgment and Compete are interactive, so they open as scenarios.
@Component({
  selector: 'app-animation-lab-page',
  imports: [GameBoard, GameOver, MatButtonModule, RouterLink, TPipe],
  template: `
    <div class="lab">
      <div class="stage">
        @if (view() === 'victory') {
          @for (run of [replay()]; track run) {
            <app-game-over [result]="victory().result" [seats]="victory().seats" youSeatId="seat-0" />
          }
        } @else {
          <app-game-board />
        }
      </div>
      <aside class="panel" [class.closed]="!open()">
        <button mat-button type="button" (click)="open.set(!open())">{{ (open() ? 'preview.hidePanel' : 'preview.showPanel') | t }}</button>
        @if (open()) {
          <button mat-flat-button type="button" (click)="newTable()">{{ 'preview.newTable' | t }}</button>
          <a mat-button routerLink="/preview">{{ 'preview.allScenarios' | t }}</a>
          @for (group of groups; track group) {
            <h2>{{ titles[group] | t }}</h2>
            @for (a of animationsOf(group); track a.id) {
              <div class="row" [attr.data-animation]="a.id">
                <strong>{{ a.title | t }}</strong>
                <span class="what">{{ a.description | t }}</span>
                @for (p of a.params ?? []; track p.key) {
                  <div class="field">
                    <span>{{ p.label | t }}</span>
                    @if (p.kind === 'number') {
                      <input type="number" min="1" max="4" [attr.aria-label]="p.label | t" [value]="value(a, p)" (input)="set(a, p, $any($event.target).valueAsNumber)" />
                    } @else {
                      <select [attr.aria-label]="p.label | t" (change)="set(a, p, $any($event.target).value)">
                        @for (o of options(p); track o.value) {
                          <option [value]="o.value" [selected]="o.value === value(a, p)">{{ o.label }}</option>
                        }
                      </select>
                    }
                  </div>
                }
                <button mat-flat-button type="button" class="play" (click)="play(a)">{{ 'preview.play' | t }}</button>
              </div>
            }
          }
          <h2>{{ 'preview.group.dialogs' | t }}</h2>
          <a mat-button routerLink="/preview/choice-judgment">{{ 'preview.choice-judgment.title' | t }}</a>
          <a mat-button routerLink="/preview/choice-compete">{{ 'preview.choice-compete.title' | t }}</a>
          <h2>{{ 'preview.group.victory' | t }}</h2>
          <button mat-button type="button" (click)="showVictory()">{{ 'preview.victoryReveal' | t }}</button>
          @if (view() === 'victory') {
            <select [attr.aria-label]="'preview.victoryCase' | t" (change)="caseKey.set($any($event.target).value)">
              @for (key of caseKeys; track key) {
                <option [value]="key" [selected]="key === caseKey()">{{ cases[key].title | t }}</option>
              }
            </select>
            <button mat-flat-button type="button" (click)="replay.set(replay() + 1)">{{ 'preview.replay' | t }}</button>
            <button mat-button type="button" (click)="view.set('board')">{{ 'preview.backToBoard' | t }}</button>
          }
        }
      </aside>
    </div>
  `,
  styles: `
    .lab { display: grid; grid-template-columns: 1fr auto; align-items: start; }
    .stage { min-width: 0; }
    .panel { box-sizing: border-box; width: 320px; max-height: 100vh; overflow: auto; padding: 8px 12px; display: grid; gap: 8px; align-content: start; background: var(--mat-sys-surface-container); }
    .panel.closed { width: auto; }
    h2 { margin: 12px 0 0; font: var(--mat-sys-title-medium); }
    .row { display: grid; gap: 4px; padding: 8px; border-radius: 8px; background: var(--mat-sys-surface); }
    .what { color: var(--mat-sys-on-surface-variant); font-size: 13px; }
    .field { display: flex; justify-content: space-between; gap: 8px; }
  `,
})
export class AnimationLabPage {
  private readonly game = inject(GameService);
  private readonly app = inject(ApplicationRef);

  private readonly i18n = inject(I18n);
  protected readonly groups: LabAnimation['group'][] = ['Beats', 'Sprite Effects'];
  protected readonly titles = LAB_GROUP_TITLES;
  protected readonly cases = GAME_OVER_CASES;
  protected readonly caseKeys = Object.keys(GAME_OVER_CASES);

  protected readonly open = signal(true);
  protected readonly view = signal<'board' | 'victory'>('board');
  protected readonly caseKey = signal(this.caseKeys[0]);
  protected readonly replay = signal(0);
  private readonly values = signal<Record<string, Values>>({});
  private base = labTable(this.game.registry);

  constructor() {
    this.newTable();
    inject(DestroyRef).onDestroy(() => this.game.stop());
  }

  // The choices a control offers, named in the viewer's language.
  protected options(p: LabParam): { value: string; label: string }[] {
    const tr = this.i18n.translator;
    switch (p.kind) {
      case 'seat':
        return LAB_SEATS.map((id) => ({ value: id, label: tr('label.seat', { n: id.slice(5) }) }));
      case 'phase':
        return PHASES.map((phase) => ({ value: phase, label: tr(`history.phase.${phase}` as const) }));
      case 'card':
        return (p.values ?? []).map((id) => ({ value: id, label: cardIdDisplayName(id, tr) }));
      default:
        return [
          { value: 'main', label: tr('choice.label.mainGeneral') },
          { value: 'deputy', label: tr('choice.label.deputyGeneral') },
        ];
    }
  }

  protected animationsOf(group: LabAnimation['group']): LabAnimation[] {
    return ANIMATIONS.filter((a) => a.group === group);
  }

  protected victory() {
    return GAME_OVER_CASES[this.caseKey()];
  }

  protected value(a: LabAnimation, p: LabParam): LabParamValue {
    return this.values()[a.id]?.[p.key] ?? p.default;
  }

  protected set(a: LabAnimation, p: LabParam, value: LabParamValue): void {
    this.values.update((all) => ({ ...all, [a.id]: { ...all[a.id], [p.key]: value } }));
  }

  // A fresh clean table. startFromState also arms the bots, so they are stopped again: no bot is due anyway.
  protected newTable(): void {
    this.base = labTable(this.game.registry);
    this.game.startFromState(this.base, 'vs-bots');
    this.game.stop();
  }

  protected showVictory(): void {
    this.view.set('victory');
    this.replay.update((n) => n + 1);
  }

  // Shows the table the animation starts from, lets the board take it in (a log that is shorter than the one on
  // show is another game to the director, so nothing old replays), then shows the table with the events added.
  protected play(a: LabAnimation): void {
    this.view.set('board');
    const params = { ...defaultParams(a), ...this.values()[a.id] };
    const before = a.before?.(this.base, params) ?? this.base;
    this.game.showState(before);
    this.app.tick();
    this.game.showState(a.play(before, params));
  }
}
