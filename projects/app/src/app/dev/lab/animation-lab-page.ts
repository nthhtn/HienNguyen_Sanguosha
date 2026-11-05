import { ApplicationRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [GameBoard, GameOver, MatButtonModule, MatIconModule, RouterLink, TPipe],
  template: `
    <div class="lab" [class.closed]="!open()">
      <div class="stage">
        @if (view() === 'victory') {
          @for (run of [replay()]; track run) {
            <app-game-over [result]="victory().result" [seats]="victory().seats" youSeatId="seat-0" />
          }
        } @else {
          <app-game-board />
        }
      </div>
      <aside class="panel">
        <header class="head">
          @if (open()) {
            <h1>{{ 'preview.lab.title' | t }}</h1>
          }
          <button mat-icon-button type="button" class="toggle" (click)="open.set(!open())" [attr.aria-label]="(open() ? 'preview.hidePanel' : 'preview.showPanel') | t" [attr.title]="(open() ? 'preview.hidePanel' : 'preview.showPanel') | t">
            <mat-icon>{{ open() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
          </button>
        </header>
        @if (open()) {
          <div class="body">
            <div class="actions">
              <button mat-flat-button type="button" class="new-table" (click)="newTable()"><mat-icon>refresh</mat-icon><span class="text">{{ 'preview.newTable' | t }}</span></button>
              <a mat-button routerLink="/preview"><mat-icon>arrow_back</mat-icon><span class="text">{{ 'preview.allScenarios' | t }}</span></a>
            </div>
            @for (group of groups; track group) {
              <section class="section">
                <h2>{{ titles[group] | t }}</h2>
                @for (a of animationsOf(group); track a.id) {
                  <div class="row" [attr.data-animation]="a.id">
                    <div class="top">
                      <strong class="name">{{ a.title | t }}</strong>
                      <button mat-flat-button type="button" class="play" (click)="play(a)"><mat-icon>play_arrow</mat-icon><span class="text">{{ 'preview.play' | t }}</span></button>
                    </div>
                    <span class="what">{{ a.description | t }}</span>
                    @if (a.params?.length) {
                      <div class="fields">
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
                      </div>
                    }
                  </div>
                }
              </section>
            }
            <section class="section">
              <h2>{{ 'preview.group.dialogs' | t }}</h2>
              <a class="link" routerLink="/preview/choice-judgment"><mat-icon>gavel</mat-icon><span class="text">{{ 'preview.choice-judgment.title' | t }}</span><mat-icon class="go">chevron_right</mat-icon></a>
              <a class="link" routerLink="/preview/choice-compete"><mat-icon>compare_arrows</mat-icon><span class="text">{{ 'preview.choice-compete.title' | t }}</span><mat-icon class="go">chevron_right</mat-icon></a>
            </section>
            <section class="section">
              <h2>{{ 'preview.group.victory' | t }}</h2>
              <div class="row">
                <div class="top">
                  <strong class="name">{{ 'preview.victoryReveal' | t }}</strong>
                  <button mat-flat-button type="button" class="reveal" (click)="showVictory()"><mat-icon>emoji_events</mat-icon><span class="text">{{ 'preview.play' | t }}</span></button>
                </div>
                @if (view() === 'victory') {
                  <div class="fields">
                    <div class="field wide">
                      <span>{{ 'preview.victoryCase' | t }}</span>
                      <select [attr.aria-label]="'preview.victoryCase' | t" (change)="caseKey.set($any($event.target).value)">
                        @for (key of caseKeys; track key) {
                          <option [value]="key" [selected]="key === caseKey()">{{ cases[key].title | t }}</option>
                        }
                      </select>
                    </div>
                  </div>
                  <div class="top">
                    <button mat-stroked-button type="button" class="replay" (click)="replay.set(replay() + 1)"><mat-icon>replay</mat-icon><span class="text">{{ 'preview.replay' | t }}</span></button>
                    <button mat-button type="button" class="back-to-board" (click)="view.set('board')"><span class="text">{{ 'preview.backToBoard' | t }}</span></button>
                  </div>
                }
              </div>
            </section>
          </div>
        }
      </aside>
    </div>
  `,
  styles: `
    :host { display: block; }
    /* The board takes what the panel leaves; the panel scrolls on its own under the app bar. */
    .lab { display: grid; grid-template-columns: minmax(0, 1fr) 336px; gap: 12px; align-items: start; }
    .lab.closed { grid-template-columns: minmax(0, 1fr) 48px; }
    .stage { min-width: 0; }
    .panel {
      position: sticky;
      top: 76px;
      box-sizing: border-box;
      max-height: calc(100vh - 88px);
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low);
      overflow: hidden;
    }
    .head { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .closed .head { padding: 4px; justify-content: center; border-bottom: 0; }
    .head h1 { margin: 0; font: var(--mat-sys-title-medium); }
    .body { overflow: auto; padding: 12px; display: grid; gap: 16px; align-content: start; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .section { display: grid; gap: 8px; }
    h2 { margin: 0; padding: 0 4px; font: var(--mat-sys-label-large); letter-spacing: 0.04em; text-transform: uppercase; color: var(--mat-sys-primary); }
    .row { display: grid; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .name { font: var(--mat-sys-title-small); }
    .what { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .field { display: grid; gap: 2px; font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    .field.wide { grid-column: 1 / -1; }
    select, input {
      box-sizing: border-box;
      width: 100%;
      min-height: 32px;
      padding: 4px 8px;
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline);
      background: var(--mat-sys-surface-container-lowest, var(--mat-sys-surface));
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
    select:focus-visible, input:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: 1px; }
    .link { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--mat-sys-outline-variant); background: var(--mat-sys-surface); color: var(--mat-sys-on-surface); text-decoration: none; }
    .link:hover { border-color: var(--mat-sys-primary); background: var(--mat-sys-surface-container); }
    .link .text { flex: 1; font: var(--mat-sys-title-small); }
    .link .go { color: var(--mat-sys-on-surface-variant); }
    @media (max-width: 1000px) {
      .lab, .lab.closed { grid-template-columns: minmax(0, 1fr); }
      .panel { position: static; max-height: none; }
    }
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
