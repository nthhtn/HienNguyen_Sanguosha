import { Component, DestroyRef, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Action, JUDGMENT_LEAD_IN_MS } from 'engine';
import { MatButtonModule } from '@angular/material/button';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';
import { Beat, BeatPlayback, playBeats, prefersReducedMotion } from './beat-player';
import { AskPanel } from './ask-panel';
import { CardArt } from './card-art';
import { DecisionCountdown } from './decision-countdown';
import { JudgmentDecisionView } from './judgment-decision';
import { JudgmentDescription } from './judgment-description';
import { PlayingCard } from './playing-card';
import { SelectionPanel } from './selection-panel';

// The fixed beats of a judgment, in ms from the popup opening (spec: Judgment sequence). The head plays
// whatever the judgment is; once the judgment has settled the tail plays: verdict, consequence, unlock.
const SOURCE_AT = 0;
const RULE_AT = 500;
const CARD_AT = 1000;
// The card turns face up this long after it is laid down.
const FLIP_DELAY = 280;
const HEAD_DONE_AT = JUDGMENT_LEAD_IN_MS.head;
const CONSEQUENCE_AFTER = 900;
const UNLOCK_AFTER = CONSEQUENCE_AFTER + 1100;
// Each lost HP pops this long after the one before.
const HEART_GAP = 260;
const PHASES = ['Draw', 'Play', 'Discard'] as const;

// What happens in a judgment popup, for every seat at the table to see: what required it, the rule,
// the card turning up (and each card that replaces it), then a check or cross and what it does.
// Presentational: everything it shows is in the description, and it asks nothing of the player.
// Plays once from its first description; a later description (a replacement, the judgment settling) moves
// it on, and a language switch only changes the words.
@Component({
  selector: 'app-judgment-stage',
  imports: [MatButtonModule, AskPanel, CardArt, DecisionCountdown, PlayingCard, SelectionPanel, TPipe],
  template: `
    @let d = description();
    <div class="stage" [style.--verdict]="verdictColour()">
      <section class="source rise" [class.in]="sourceIn()">
        @if (d.source.kind === 'skill') {
          @if (d.source.generalId; as generalId) {
            <app-card-art [skin]="true" [id]="generalId" [label]="d.source.generalName" size="small" />
          }
          <div class="words">
            <div class="who"><strong>{{ d.source.generalName }}</strong> · {{ d.source.abilityName }}</div>
            @if (d.source.skillText; as text) {
              <p class="skill-text">{{ text }}</p>
            }
          </div>
        } @else {
          <div class="words">
            <div class="who">{{ 'judgment.source.card' | t: { card: d.source.cardName, seat: d.source.seatName } }}</div>
          </div>
        }
      </section>

      @if (d.rule; as rule) {
        <p class="rule rise" [class.in]="ruleIn()">{{ rule }}</p>
      }

      <div class="arena" [attr.aria-label]="'judgment.card' | t">
        <div class="slot">
          @for (c of cards(); track c.card.instanceId; let i = $index; let last = $last) {
            <div class="pc" [class.current]="last" [class.old]="c.age === 1" [class.older]="c.age > 1"
                 [class.in]="!last || cardIn()" [class.up]="!last || upIds().has(c.card.instanceId)" [class.final]="last && stampShown()">
              <div class="inner">
                <div class="back"></div>
                <div class="face"><app-playing-card [card]="c.card" size="normal" /></div>
              </div>
            </div>
          }
        </div>
        @if (d.verdict === 'good' || d.verdict === 'bad') {
          <div class="stamp-wrap">
            <svg class="stamp" [class.good]="d.verdict === 'good'" [class.bad]="d.verdict === 'bad'" [class.show]="stampShown()" viewBox="0 0 64 64" role="img"
                 [attr.aria-label]="(d.verdict === 'good' ? 'judgment.verdict.good' : 'judgment.verdict.bad') | t: { seat: d.judgedSeatName }">
              <circle cx="32" cy="32" r="28" pathLength="1" />
              @if (d.verdict === 'good') {
                <path d="M18 33 L28 43 L47 21" pathLength="1" />
              } @else {
                <path d="M21 21 L43 43 M43 21 L21 43" pathLength="1" />
              }
            </svg>
            <div class="verdict-label" [class.show]="stampShown()">{{ (d.verdict === 'good' ? 'judgment.verdict.good' : 'judgment.verdict.bad') | t: { seat: d.judgedSeatName } }}</div>
          </div>
        }
      </div>

      <!-- Each replacement in words, for screen readers: the cards swap too fast to be read off the table. -->
      @if (d.changes.length > 0) {
        <ul class="changes" aria-live="polite">
          @for (change of d.changes; track $index) {
            <li class="change">{{ change.text }}</li>
          }
        </ul>
      }

      <section class="cons" [class.on]="consequenceOn()">
        @if (!d.settled) {
          @if (decision(); as dec) {
            @if (decisionOpen()) {
              <div class="decide">
                @switch (dec.kind) {
                  @case ('mine') {
                    @if (dec.step.kind === 'ask') {
                      <app-ask-panel [description]="dec.step.description" (chosen)="chosen.emit($event)" />
                    } @else {
                      <app-selection-panel [description]="dec.step.description" [pickedChanged]="pickedChanged()" (chosen)="chosen.emit($event)" />
                    }
                    <app-decision-countdown />
                  }
                  @case ('watching') {
                    <p class="waiting"><span class="spin"></span>{{ 'judgment.waiting.seat' | t: { seat: dec.deciderName } }}</p>
                  }
                  @case ('gate') {
                    <p class="pass">{{ 'reveal.pass' | t: { name: dec.deciderName } }}</p>
                    <button mat-flat-button type="button" class="reveal" (click)="revealed.emit(dec.seatId)">{{ 'reveal.tap' | t }}</button>
                  }
                }
              </div>
            } @else if (d.waiting; as waiting) {
              <p class="waiting"><span class="spin"></span>{{ waiting }}</p>
            }
          } @else if (d.waiting; as waiting) {
            <p class="waiting"><span class="spin"></span>{{ waiting }}</p>
          }
        } @else {
          @switch (d.effect?.kind) {
            @case ('damage') {
              @if (hearts().length > 0) {
                <div class="hearts" role="img" [attr.aria-label]="'judgment.hp' | t: { seat: d.hp?.seatName ?? '', n: d.hp?.current ?? 0 }">
                  @for (h of hearts(); track $index) {
                    <span class="heart" [class.lost]="h.lost" aria-hidden="true">♥</span>
                  }
                  <span class="dmg">{{ 'judgment.damage' | t: { n: damageAmount() } }}</span>
                </div>
              }
            }
            @case ('skip-phase') {
              <div class="chips phases">
                @for (p of phases; track p) {
                  <span class="chip" [class.skipped]="consequenceOn() && p === phaseOf(d)">{{ phaseLabel(p) }}</span>
                }
              </div>
            }
            @case ('keep-phase') {
              <div class="chips phases">
                @for (p of phases; track p) {
                  <span class="chip" [class.kept]="consequenceOn() && p === phaseOf(d)">{{ phaseLabel(p) }}</span>
                }
              </div>
            }
            @case ('pass-on') {
              <div class="chips seats">
                <span class="chip seat">{{ d.judgedSeatName }}</span>
                <span class="arrow" aria-hidden="true">▶</span>
                <span class="chip seat">{{ 'judgment.nextSeat' | t }}</span>
              </div>
            }
          }
          @if (d.outcome; as outcome) {
            <p class="line" [class.in]="consequenceOn()">{{ outcome }}</p>
          }
        }
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .stage { display: flex; flex-direction: column; gap: 14px; --good: #1c8a4b; }
    .rise { opacity: 0; transform: translateY(8px); transition: opacity 0.35s, transform 0.35s; }
    .rise.in { opacity: 1; transform: none; }
    .source { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--force) 12%, transparent); }
    .who { font: var(--mat-sys-title-medium); color: var(--force-text); }
    .skill-text { margin: 4px 0 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .changes { position: absolute; width: 1px; height: 1px; margin: 0; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; list-style: none; }
    .rule { margin: 0; text-align: center; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }

    .arena { display: flex; justify-content: center; align-items: center; gap: 34px; min-height: 120px; padding: 6px 0; }
    .slot { position: relative; width: 70px; height: 96px; flex: none; }
    .pc { position: absolute; inset: 0; perspective: 600px; opacity: 0; transform: translateY(-14px); transition: opacity 0.3s, transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
    .pc.in { opacity: 1; transform: none; }
    .inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.2, 1); transform: rotateY(180deg); }
    .pc.up .inner { transform: none; }
    .back, .face { position: absolute; inset: 0; border-radius: 6px; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
    .back { transform: rotateY(180deg); background: repeating-linear-gradient(45deg, var(--force) 0 6px, color-mix(in srgb, var(--force) 70%, #000) 6px 12px); border: 3px solid #fff; box-shadow: 0 0 0 1px var(--mat-sys-outline-variant); }
    .face { display: grid; place-items: center; }
    .pc.old { transform: translateX(-56px) scale(0.82); opacity: 0.45; }
    .pc.older { transform: translateX(-98px) scale(0.7); opacity: 0.3; }
    .pc.old::after, .pc.older::after { content: ''; position: absolute; left: -4px; right: -4px; top: 50%; height: 3px; border-radius: 2px; background: var(--mat-sys-error); transform: rotate(-38deg); }
    .pc.final .face { box-shadow: 0 0 0 4px var(--verdict); }

    .stamp-wrap { width: 84px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .stamp { width: 60px; height: 60px; opacity: 0; transform: scale(0.6); transition: opacity 0.2s, transform 0.35s cubic-bezier(0.3, 1.6, 0.5, 1); color: var(--verdict); }
    .stamp * { fill: none; stroke: currentColor; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
    .stamp.show { opacity: 1; transform: none; }
    .stamp.show circle { animation: draw 0.45s ease-out forwards; }
    .stamp.show path { animation: draw 0.4s 0.3s ease-out forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    .verdict-label { font: var(--mat-sys-label-medium); font-weight: 600; color: var(--verdict); text-align: center; opacity: 0; transition: opacity 0.3s 0.5s; }
    .verdict-label.show { opacity: 1; }

    .cons { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 12px; min-height: 110px; border-radius: 12px; border: 1px solid var(--mat-sys-outline-variant); }
    .decide { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .pass { margin: 0; font: var(--mat-sys-title-medium); text-align: center; }
    .waiting { display: flex; align-items: center; gap: 10px; margin: 0; font: var(--mat-sys-body-large); color: var(--force-text); text-align: center; }
    .spin { width: 16px; height: 16px; flex: none; border-radius: 50%; border: 3px solid var(--mat-sys-outline-variant); border-top-color: var(--force); animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; align-items: center; }
    .chip { position: relative; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--mat-sys-outline-variant); font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); transition: color 0.3s, border-color 0.3s; }
    .chip.skipped { color: var(--mat-sys-error); border-color: var(--mat-sys-error); text-decoration: line-through; }
    .chip.kept { color: var(--good); border-color: var(--good); font-weight: 600; }
    .chip.seat { color: var(--mat-sys-on-surface); }
    .arrow { color: var(--mat-sys-on-surface-variant); opacity: 0; transform: translateX(-10px); transition: opacity 0.4s 0.2s, transform 0.4s 0.2s; }
    .cons.on .arrow { opacity: 1; transform: none; }
    .hearts { display: flex; align-items: center; gap: 4px; font-size: 26px; line-height: 1; }
    .heart { color: var(--mat-sys-error); transition: color 0.3s, transform 0.3s; }
    .heart.lost { color: var(--mat-sys-outline-variant); animation: pop 0.5s; }
    @keyframes pop { 30% { transform: scale(1.5) rotate(-8deg); } }
    .dmg { margin-left: 10px; font: var(--mat-sys-title-medium); font-weight: 700; color: var(--mat-sys-error); opacity: 0; transition: opacity 0.3s 0.3s; white-space: nowrap; }
    .cons.on .dmg { opacity: 1; }
    .line { margin: 0; font: var(--mat-sys-title-small); text-align: center; opacity: 0; transform: translateY(6px); transition: opacity 0.3s, transform 0.3s; }
    .line.in { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) {
      .rise, .pc, .inner, .stamp, .verdict-label, .arrow, .line, .chip, .heart, .dmg { transition-duration: 0s !important; transition-delay: 0s !important; }
      .stamp.show circle, .stamp.show path, .heart.lost, .spin { animation-duration: 0s !important; animation-delay: 0s !important; }
    }
  `,
})
export class JudgmentStage implements OnInit {
  readonly description = input.required<JudgmentDescription>();
  // The skill decision the judgment is waiting on, as this viewer sees it, if any.
  readonly decision = input<JudgmentDecisionView | null>(null);
  // Told the filled SelectAction whenever enough are picked, so a timeout can use it.
  readonly pickedChanged = input<((action: Action) => void) | undefined>(undefined);
  // The sequence has played out: Continue may be pressed.
  readonly unlocked = output<void>();
  // The engine's own action the viewer picked in the decision area.
  readonly chosen = output<Action>();
  // Pass and Play: the asked seat's player took the device and asks to see their view.
  readonly revealed = output<string>();

  private readonly i18n = inject(I18n);
  private readonly playbacks: BeatPlayback[] = [];

  protected readonly phases = PHASES;
  protected readonly sourceIn = signal(false);
  protected readonly ruleIn = signal(false);
  protected readonly cardIn = signal(false);
  // The ids of the cards that have been turned face up.
  protected readonly upIds = signal<ReadonlySet<string>>(new Set());
  private readonly headDone = signal(false);
  protected readonly stampShown = signal(false);
  protected readonly consequenceOn = signal(false);
  private readonly lostCount = signal(0);
  // The decision area is open once the head has played, and again after each replacement's swap.
  protected readonly decisionOpen = signal(false);

  private seenChanges = 0;
  private lastChangeAt = 0;
  private tailStarted = false;
  private reducedMotion = false;

  // The card turned up now, after the ones it replaced: `age` counts back from the current one.
  protected readonly cards = computed(() => {
    const d = this.description();
    const all = [...d.replaced, d.card];
    return all.map((card, i) => ({ card, age: all.length - 1 - i }));
  });

  protected readonly verdictColour = computed(() => (this.description().verdict === 'good' ? 'var(--good)' : 'var(--mat-sys-error)'));

  protected readonly damageAmount = computed(() => {
    const effect = this.description().effect;
    return effect?.kind === 'damage' ? effect.amount : 0;
  });

  // The HP shown: every heart the seat has, the last ones in line to be lost greyed as the consequence plays.
  protected readonly hearts = computed(() => {
    const d = this.description();
    if (d.effect?.kind !== 'damage' || !d.hp) return [];
    const total = d.hp.max ?? d.hp.current;
    const lost = Math.min(this.lostCount(), d.effect.amount, d.hp.current);
    return Array.from({ length: Math.max(total, d.hp.current) }, (_, i) => ({ lost: i >= d.hp!.current - lost && i < d.hp!.current }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.playbacks.forEach((p) => p.stop()));
    // A replacement: the new card is laid down face down, turns up, and the verdict waits for it.
    effect(() => {
      const changes = this.description().changes.length;
      const id = this.description().card.instanceId;
      untracked(() => {
        if (changes <= this.seenChanges) return;
        this.seenChanges = changes;
        this.lastChangeAt = Date.now();
        this.decisionOpen.set(false);
        this.play([{ at: FLIP_DELAY, run: () => this.turnUp(id) }, { at: JUDGMENT_LEAD_IN_MS.replace, run: () => this.decisionOpen.set(true) }]);
      });
    });
    // The judgment settles after the head has played (the head's last beat covers the other order).
    effect(() => {
      const d = this.description();
      untracked(() => this.startTailIfReady(d));
    });
  }

  ngOnInit(): void {
    this.reducedMotion = prefersReducedMotion();
    this.seenChanges = this.description().changes.length;
    this.play([
      { at: SOURCE_AT, run: () => this.sourceIn.set(true) },
      { at: RULE_AT, run: () => this.ruleIn.set(true) },
      { at: CARD_AT, run: () => this.cardIn.set(true) },
      { at: CARD_AT + FLIP_DELAY, run: () => this.turnUp(this.description().card.instanceId) },
      { at: HEAD_DONE_AT, run: () => { this.headDone.set(true); this.decisionOpen.set(true); this.startTailIfReady(this.description()); } },
    ]);
  }

  private play(beats: Beat[]): void {
    this.playbacks.push(playBeats(beats, { reducedMotion: this.reducedMotion }));
  }

  private turnUp(id: string): void {
    this.upIds.update((ids) => new Set(ids).add(id));
  }

  // Once the head has played and the judgment has settled, the tail: verdict, consequence, unlock.
  private startTailIfReady(d: JudgmentDescription): void {
    if (this.tailStarted || !d.settled || !this.headDone()) return;
    this.tailStarted = true;
    // A replacement just made needs its animation first.
    const wait = this.reducedMotion ? 0 : Math.max(0, this.lastChangeAt + JUDGMENT_LEAD_IN_MS.replace - Date.now());
    const amount = d.effect?.kind === 'damage' ? d.effect.amount : 0;
    const beats: Beat[] = [
      { at: wait, run: () => this.stampShown.set(true) },
      { at: wait + CONSEQUENCE_AFTER, run: () => this.consequenceOn.set(true) },
      ...Array.from({ length: amount }, (_, n) => ({ at: wait + CONSEQUENCE_AFTER + n * HEART_GAP, run: () => this.lostCount.set(n + 1) })),
      { at: wait + UNLOCK_AFTER, run: () => this.unlocked.emit() },
    ];
    // The verdict beat of a judgment that needs no wait runs now, in the beat that finished the head.
    for (const beat of beats.filter((b) => b.at <= 0)) beat.run();
    this.play(beats.filter((b) => b.at > 0));
  }

  protected phaseOf(d: JudgmentDescription): string | null {
    return d.effect?.kind === 'skip-phase' || d.effect?.kind === 'keep-phase' ? d.effect.phase : null;
  }

  protected phaseLabel(phase: string): string {
    return this.i18n.t('phase.indicator', { phase: this.i18n.t(`history.phase.${phase}` as MessageKey) });
  }
}
