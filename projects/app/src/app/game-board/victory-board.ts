import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { GameResult } from 'engine';
import { FinalSeatView } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { generalDisplayName, kingdomDisplayName } from '../labels';
import { CardArt } from './card-art';
import { VictoryColumn, VictoryMember, victoryColumns } from './victory-columns';

// Reveal beats (spec "Reveal sequence"), in ms from the board appearing.
const HEADLINE_AT = 50;
const COLUMNS_AT = 500;
const COLUMN_GAP = 130;
const LIGHT_AFTER_LAST = 500;

// The Victory window's body: a headline and one column per allegiance. Presentation only: who belongs
// where and who won comes from victoryColumns; this component only names and reveals it.
@Component({
  selector: 'app-victory-board',
  imports: [CardArt, TPipe],
  template: `
    <div class="victory" [class.lit]="lit()">
      <header class="head" [class.shown]="headShown()">
        <p class="eyebrow">{{ 'over.title' | t }}</p>
        <h2 class="headline" [attr.data-force]="winningForce()">{{ headline() }}</h2>
        <p class="sub">{{ subline() }}</p>
      </header>
      <div class="cols" [attr.aria-label]="'over.standings' | t">
        @for (col of view().columns; track col.group; let i = $index) {
          <section
            class="col"
            [attr.data-f]="col.force"
            [attr.data-force]="col.force"
            [attr.data-winning]="col.winning ? '' : null"
            [class.shown]="i < shownCount()"
            [class.win]="lit() && col.winning"
            [class.lose]="lit() && !col.winning && view().winningGroup !== null"
          >
            @if (lit() && col.winning) {
              <span class="tag">{{ 'over.winnersTag' | t }}</span>
            }
            <h3 class="col-head">
              <span class="title">{{ title(col) }}</span>
              <span class="count">{{ count(col) }}</span>
            </h3>
            <ul>
              @for (m of col.members; track m.seatId) {
                <li class="m" [class.fallen]="!m.survived" [class.alive]="m.survived">
                  <span class="avatar">
                    @if (m.mainGeneralId; as main) {
                      <app-card-art [skin]="true" [id]="main" [label]="general(main)" size="tiny" />
                    } @else {
                      <span class="initial">{{ initial(m) }}</span>
                    }
                  </span>
                  <span class="info">
                    <span class="who">
                      <span class="name">{{ nameOf()(m.seatId) }}</span>
                      @if (m.you) {
                        <span class="you">{{ 'over.you' | t }}</span>
                      }
                    </span>
                    @if (generals(m); as pair) {
                      <span class="generals">{{ pair }}</span>
                    }
                    <span class="state">{{ m.survived ? '✓ ' + ('over.survived' | t) : '✕ ' + ('over.fallen' | t) }}</span>
                  </span>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .victory {
      container-type: inline-size;
      max-width: 980px;
      margin: 0 auto;
      text-align: center;
      color: var(--mat-sys-on-surface);
    }

    .head { opacity: 0; transform: translateY(8px); transition: opacity 400ms ease, transform 400ms ease; }
    .head.shown { opacity: 1; transform: none; }
    .eyebrow { margin: 0; font: var(--mat-sys-label-large); letter-spacing: 0.08em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); }
    .headline { margin: 4px 0 2px; font-size: 30px; line-height: 1.2; font-weight: 700; color: var(--mat-sys-on-surface); }
    .headline[data-force] { color: var(--force-text); }
    .sub { margin: 0 0 20px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }

    .cols { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; padding-top: 12px; }
    .col {
      position: relative;
      flex: 1 1 150px;
      min-width: 150px;
      max-width: 190px;
      box-sizing: border-box;
      padding: 12px 10px;
      border-radius: 10px;
      border-top: 5px solid var(--force);
      background: var(--mat-sys-surface-container);
      text-align: left;
      opacity: 0;
      transform: translateY(14px);
      transition: opacity 400ms ease, transform 400ms ease, filter 400ms ease, box-shadow 400ms ease, background 400ms ease;
    }
    .col.shown { opacity: 1; transform: none; }
    .col.win {
      background: color-mix(in srgb, var(--force) 13%, var(--mat-sys-surface-container));
      box-shadow: 0 0 0 2px var(--force), 0 6px 22px color-mix(in srgb, var(--force) 45%, transparent);
      transform: translateY(-4px);
    }
    .col.lose { filter: grayscale(1); opacity: 0.72; }
    .tag {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--force);
      color: white;
      font: var(--mat-sys-label-small);
      font-weight: 700;
      white-space: nowrap;
    }

    .col-head { display: flex; flex-direction: column; align-items: center; margin: 0 0 8px; }
    .title { font: var(--mat-sys-title-medium); font-weight: 700; color: var(--force-text); }
    .count { font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }

    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .m { display: flex; align-items: center; gap: 8px; }
    .avatar {
      flex: none;
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2px solid var(--force);
      overflow: hidden;
      background: var(--mat-sys-surface-container-highest);
    }
    .avatar app-card-art { display: contents; }
    .avatar ::ng-deep .card-art { width: 100%; height: 100%; border: 0; border-radius: 0; object-fit: cover; object-position: top; }
    .initial { font-weight: 700; font-size: 14px; color: var(--force-text); }
    .m.fallen .avatar { border-style: dashed; opacity: 0.55; filter: grayscale(0.7); }

    .info { display: flex; flex-direction: column; min-width: 0; }
    .who { display: flex; align-items: center; gap: 4px; min-width: 0; }
    .name { font: var(--mat-sys-body-medium); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .you {
      flex: none;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font: var(--mat-sys-label-small);
    }
    .generals, .state { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .m.fallen .name { color: var(--mat-sys-on-surface-variant); }

    @container (max-width: 700px) {
      .headline { font-size: 24px; }
      .cols { gap: 12px; }
      .col { flex: 0 1 calc(50% - 6px); min-width: 0; max-width: calc(50% - 6px); }
      .col[data-winning] { order: -1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .head, .col { transition: none; }
    }
  `,
})
export class VictoryBoard implements OnInit {
  readonly result = input.required<GameResult>();
  readonly seats = input.required<FinalSeatView[]>();
  readonly youSeatId = input<string | null>(null);
  readonly nameOf = input<(seatId: string) => string>((seatId) => seatId);

  private readonly i18n = inject(I18n);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly view = computed(() => victoryColumns(this.seats(), this.result(), this.youSeatId()));
  protected readonly winningForce = computed(() => this.view().columns.find((c) => c.winning)?.force ?? null);

  protected readonly headShown = signal(false);
  protected readonly shownCount = signal(0);
  protected readonly lit = signal(false);

  protected readonly headline = computed(() => {
    const v = this.view();
    const t = this.i18n.translator;
    switch (v.headlineKind) {
      case 'kingdom':
        return t('over.kingdomWins', { kingdom: v.winningKingdom ? kingdomDisplayName(v.winningKingdom, t) : '' });
      case 'ambitionist':
        return t('over.ambitionistWins', { name: this.winnerName() });
      case 'lone-survivor':
        return t('over.namesWin', { names: this.winnerName() });
      case 'draw':
        return t('over.draw');
    }
  });

  protected readonly subline = computed(() => {
    const v = this.view();
    const t = this.i18n.translator;
    switch (v.headlineKind) {
      case 'kingdom':
        return t('over.sub.kingdom', { kingdom: v.winningKingdom ? kingdomDisplayName(v.winningKingdom, t) : '' });
      case 'ambitionist':
        return t('over.sub.ambitionist');
      case 'lone-survivor':
        return t('over.sub.lone');
      case 'draw':
        return t('over.sub.draw');
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach((id) => clearTimeout(id)));
  }

  ngOnInit(): void {
    const columns = this.view().columns.length;
    if (this.reducedMotion()) {
      this.headShown.set(true);
      this.shownCount.set(columns);
      this.lit.set(true);
      return;
    }
    this.at(HEADLINE_AT, () => this.headShown.set(true));
    for (let i = 0; i < columns; i++) this.at(COLUMNS_AT + i * COLUMN_GAP, () => this.shownCount.set(i + 1));
    this.at(COLUMNS_AT + Math.max(columns - 1, 0) * COLUMN_GAP + LIGHT_AFTER_LAST, () => this.lit.set(true));
  }

  protected title(col: VictoryColumn): string {
    const t = this.i18n.translator;
    switch (col.group) {
      case 'WinningAmbitionist':
        return t('over.group.WinningAmbitionist');
      case 'LosingAmbitionist':
        return t(col.members.length >= 2 ? 'over.group.LosingAmbitionists' : 'over.group.LosingAmbitionist');
      default:
        return kingdomDisplayName(col.group, t);
    }
  }

  protected count(col: VictoryColumn): string {
    const n = col.members.length;
    return n === 1 ? this.i18n.t('over.player') : this.i18n.t('over.players', { n });
  }

  protected general(id: string): string {
    return generalDisplayName(id, this.i18n.translator);
  }

  protected generals(m: VictoryMember): string {
    return [m.mainGeneralId, m.deputyGeneralId]
      .filter((id): id is string => id !== null)
      .map((id) => this.general(id))
      .join(' · ');
  }

  protected initial(m: VictoryMember): string {
    return Array.from(this.nameOf()(m.seatId).trim())[0]?.toUpperCase() ?? '?';
  }

  private winnerName(): string {
    const id = this.view().winnerSeatId;
    return id ? this.nameOf()(id) : '';
  }

  private reducedMotion(): boolean {
    return typeof this.window?.matchMedia === 'function' && this.window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private at(ms: number, run: () => void): void {
    this.timers.push(setTimeout(run, ms));
  }
}
