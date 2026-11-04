import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { GameResult } from 'engine';
import { FinalSeatView } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { generalDisplayName, kingdomDisplayName } from '../labels';
import { CardArt } from './card-art';
import { VictoryColumn, VictoryMember, cardsPerRow, victoryColumns } from './victory-columns';

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
      <div class="cols" role="group" [attr.aria-label]="'over.standings' | t" [attr.data-k]="perRow()">
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
                    <span class="state">
                      @if (m.survived) {
                        <span aria-hidden="true">✓</span> {{ 'over.survived' | t }}
                      } @else {
                        <span aria-hidden="true">✕</span> {{ 'over.fallen' | t }}
                      }
                    </span>
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
      max-width: 1080px;
      margin: 0 auto;
      text-align: center;
      color: var(--mat-sys-on-surface);
    }

    .head { opacity: 0; transform: translateY(8px); transition: opacity 400ms ease, transform 400ms ease; }
    .head.shown { opacity: 1; transform: none; }
    .eyebrow { margin: 0; font: var(--mat-sys-label-large); letter-spacing: 0.08em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); }
    .headline { margin: 6px 0 4px; font-size: 44px; line-height: 1.15; font-weight: 700; color: var(--mat-sys-on-surface); }
    .headline[data-force] { color: var(--force-text); }
    .sub { margin: 0 0 24px; font-size: 18px; color: var(--mat-sys-on-surface-variant); }

    /* Two rows of equal-width cards (spec "Layout"): k cards on the top row, the shorter bottom row centred. */
    .cols { --k: 1; --gap: 20px; --cap: 354px; display: flex; flex-wrap: wrap; justify-content: center; gap: var(--gap); padding-top: 12px; }
    .cols[data-k='2'] { --k: 2; }
    .cols[data-k='3'] { --k: 3; --cap: 320px; }
    .col {
      position: relative;
      flex: 0 0 min(calc((100% - (var(--k) - 1) * var(--gap)) / var(--k)), var(--cap));
      min-width: 0;
      box-sizing: border-box;
      padding: 18px 16px;
      border-radius: 16px;
      border-top: 6px solid var(--force);
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
    .col.lose { filter: grayscale(1); opacity: 0.78; }
    .tag {
      position: absolute;
      top: -15px;
      left: 50%;
      transform: translateX(-50%);
      padding: 3px 14px;
      border-radius: 999px;
      background: var(--force);
      color: white;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .col-head { display: flex; flex-direction: column; align-items: flex-start; margin: 0 0 14px; }
    .title { font-size: 22px; line-height: 1.25; font-weight: 700; color: var(--force-text); }
    .count { font-size: 15px; color: var(--mat-sys-on-surface-variant); }

    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .m { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 12px; background: color-mix(in srgb, var(--force) 8%, transparent); }
    .avatar {
      flex: none;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2px solid var(--force);
      overflow: hidden;
      background: var(--mat-sys-surface-container-highest);
    }
    .avatar app-card-art { display: contents; }
    .avatar ::ng-deep .card-art { width: 100%; height: 100%; border: 0; border-radius: 0; object-fit: cover; object-position: top; }
    .initial { font-weight: 700; font-size: 18px; color: var(--force-text); }
    .m.fallen .avatar { border-style: dashed; opacity: 0.55; filter: grayscale(0.7); }

    .info { display: flex; flex-direction: column; min-width: 0; }
    .who { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
    .name { font-size: 18px; line-height: 1.3; font-weight: 700; overflow-wrap: anywhere; }
    .you {
      flex: none;
      padding: 0 8px;
      border-radius: 999px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .generals { font-size: 15px; line-height: 1.35; color: var(--mat-sys-on-surface-variant); overflow-wrap: anywhere; }
    .state { font-size: 14px; font-weight: 500; color: var(--mat-sys-on-surface-variant); }
    .m.fallen .name { color: var(--mat-sys-on-surface-variant); }

    @container (max-width: 700px) {
      .headline { font-size: 32px; }
      .sub { font-size: 16px; }
      .cols[data-k] { --gap: 14px; --k: 2; }
      .col[data-winning] { order: -1; }
    }
    @container (max-width: 460px) {
      .cols[data-k] { --k: 1; }
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
  protected readonly perRow = computed(() => cardsPerRow(this.view().columns.length));
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

  // The reveal is scheduled once, from the initial inputs: a later input change re-renders the
  // columns but does not re-animate them.
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
