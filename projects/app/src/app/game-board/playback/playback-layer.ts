import { Component, DestroyRef, Directive, ElementRef, Injectable, Injector, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import type { CardInstance, GameState, Seat, UsedCard } from 'engine';
import { generalDisplayData } from 'content';
import { I18n } from '../../i18n/i18n.service';
import { localeOf, Translator } from '../../i18n/translator';
import { generalDisplayName, seatKingdomLabel, seatName, shownCardId } from '../../labels';
import { PlaybackSpeed } from '../../playback-speed.service';
import { PlayingCard } from '../playing-card';
import type { PlannedBeat } from './beats';
import { PlaybackDirector } from './playback-director';

// A point on screen, in px from the viewport's top left.
interface Point {
  x: number;
  y: number;
}

// The card on show at the centre, for the moment it is played.
interface PlayedCard {
  id: number;
  card: CardInstance;
  // No suit or number to show.
  faceless: boolean;
  showMs: number;
}

// An arrow from a card's user to one of its targets; `d` is in the layer's px.
interface TargetLine {
  key: string;
  d: string;
  drawMs: number;
  showMs: number;
}

// How far inside the table's edge a line to a seat off the table stops, in px.
const LINE_EDGE = 12;
const CAPTION_IN: Keyframe[] = [
  { transform: 'translateY(8px)', opacity: 0 },
  { transform: 'none', opacity: 1 },
];
const BANNER_SWEEP: Keyframe[] = [
  { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
  { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.25 },
  { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.8 },
  { clipPath: 'inset(0 0 0 0)', opacity: 0 },
];
// Shown for its moment, then gone: in quickly, held, faded out by the end of the beat.
const APPEAR_AND_FADE: Keyframe[] = [
  { opacity: 0, transform: 'scale(0.92)' },
  { opacity: 1, transform: 'none', offset: 0.15 },
  { opacity: 1, transform: 'none', offset: 0.7 },
  { opacity: 0, transform: 'none' },
];

// The layer's running animations. A beat's animations never outlive it: the next beat finishes them,
// since the director may play faster than the chosen speed (a rush online).
@Injectable()
export class PlaybackAnimations {
  private readonly running = new Set<Animation>();
  private destroyed = false;

  constructor() {
    // Leaving the board: nothing keeps running.
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      for (const animation of this.running) animation.cancel();
      this.running.clear();
    });
  }

  run(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
    if (this.destroyed || typeof el.animate !== 'function') return;
    const animation = el.animate(keyframes, options);
    this.running.add(animation);
    const end = () => this.running.delete(animation);
    animation.finished?.then(end, end);
  }

  finishAll(): void {
    for (const animation of [...this.running]) {
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
    }
  }
}

// Shows its element for `ms`, then fades it out (APPEAR_AND_FADE).
@Directive({ selector: '[appShowFor]' })
export class ShowForMotion {
  readonly ms = input.required<number>({ alias: 'appShowFor' });

  constructor() {
    const el = inject<ElementRef<Element>>(ElementRef).nativeElement;
    const animations = inject(PlaybackAnimations);
    afterNextRender(() => animations.run(el, APPEAR_AND_FADE, { duration: this.ms(), easing: 'ease-out', fill: 'forwards' }));
  }
}

// Draws its path from start to end, stroke-dash style.
@Directive({ selector: '[appLineDraw]' })
export class LineDrawMotion {
  readonly drawMs = input.required<number>({ alias: 'appLineDraw' });

  constructor() {
    const el = inject<ElementRef<SVGPathElement>>(ElementRef).nativeElement;
    const animations = inject(PlaybackAnimations);
    afterNextRender(() => {
      const length = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
      if (!length) return;
      animations.run(
        el,
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: '0' },
        ],
        { duration: this.drawMs(), easing: 'ease-out', fill: 'backwards' }
      );
    });
  }
}

let layerCount = 0;

// Over the battlefield while a battle plays: the card being played, shown at the centre for its moment;
// arrows from its user to its targets, which fade once drawn; a one-line caption for the beat on show
// and a banner when a turn starts. Nothing flies. Presentation only: it replays what the director shows.
// At Instant nothing is shown but the caption.
@Component({
  selector: 'app-playback-layer',
  imports: [PlayingCard, ShowForMotion, LineDrawMotion],
  providers: [PlaybackAnimations],
  template: `
    <svg class="lines" aria-hidden="true">
      <defs>
        <marker [attr.id]="headId" viewBox="0 0 12 12" refX="7" refY="6" markerWidth="16" markerHeight="16" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path class="head" d="M1,1 L11,6 L1,11 z" />
        </marker>
      </defs>
      @for (line of lines(); track line.key) {
        <svg:g class="arrow" [appShowFor]="line.showMs">
          <svg:path class="outline" [attr.d]="line.d" [appLineDraw]="line.drawMs" />
          <svg:path class="line" [attr.d]="line.d" [attr.marker-end]="'url(#' + headId + ')'" [appLineDraw]="line.drawMs" />
        </svg:g>
      }
    </svg>
    <div class="caption" #captionBox aria-live="polite" [style.top.px]="centreY() - centreHeight() / 2">{{ caption() }}</div>
    @if (played(); as p) {
      <div class="played" [style.top.px]="centreY()">
        @for (one of [p]; track one.id) {
          <app-playing-card [card]="one.card" [showFace]="!one.faceless" [appShowFor]="one.showMs" />
        }
      </div>
    }
    @if (banner(); as b) {
      <div class="banner" #bannerBox [style.top.px]="centreY()">
        {{ b.title }}
        @if (b.detail) {
          <small>{{ b.detail }}</small>
        }
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
    .lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    /* A white arrow with a dark border: the border is a wider dark path under the white one. */
    .outline { fill: none; stroke: #1b1b1b; stroke-width: 6; stroke-linecap: round; }
    .line { fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; }
    .head { fill: #fff; stroke: #1b1b1b; stroke-width: 1.5; stroke-linejoin: round; }
    .caption {
      position: absolute; left: 8%; right: 8%; min-height: 1.2em; text-align: center;
      color: #f4ecdc; font-weight: 600; font-size: 1.3em; line-height: 1.2; text-shadow: 0 2px 4px rgb(0 0 0 / 60%);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .played { position: absolute; left: 50%; transform: translate(-50%, -50%); filter: drop-shadow(0 4px 8px rgb(0 0 0 / 45%)); }
    .played app-playing-card { opacity: 0; }
    .banner {
      position: absolute; left: 0; right: 0; transform: translateY(-50%); padding: 12px 0; text-align: center;
      color: #fff; font-weight: 700; font-size: 1.9em; text-shadow: 0 2px 4px rgb(0 0 0 / 60%);
      background: linear-gradient(90deg, transparent, rgb(0 0 0 / 60%) 20%, rgb(0 0 0 / 60%) 80%, transparent);
    }
    .banner small { display: block; font-weight: 500; font-size: 0.45em; opacity: 0.85; }
  `,
})
export class PlaybackLayer {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input.required<string>();
  // The newest Action History line of the shown state: the caption while a beat plays.
  readonly line = input<string | null>(null);
  // The centre's room on the table (fitTable): its middle and height, in px from the table's top.
  readonly centreY = input(0);
  readonly centreHeight = input(0);

  private readonly director = inject(PlaybackDirector, { optional: true });
  private readonly speed = inject(PlaybackSpeed);
  private readonly i18n = inject(I18n);
  private readonly animations = inject(PlaybackAnimations);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly captionEl = viewChild<ElementRef<HTMLElement>>('captionBox');
  private readonly bannerEl = viewChild<ElementRef<HTMLElement>>('bannerBox');

  protected readonly headId = `playback-head-${layerCount++}`;
  protected readonly played = signal<PlayedCard | null>(null);
  protected readonly lines = signal<TargetLine[]>([]);

  private readonly current = computed(() => this.director?.current() ?? null);
  protected readonly caption = computed(() => {
    const visual = this.current()?.visual;
    return this.current() && visual?.kind !== 'turn' ? this.line() : null;
  });
  protected readonly banner = computed(() => {
    const visual = this.current()?.visual;
    return visual?.kind === 'turn' ? turnBanner(this.state(), visual.seatId, this.i18n.translator) : null;
  });

  private nextId = 0;

  constructor() {
    effect(() => {
      const beat = this.current();
      untracked(() => this.show(beat));
    });
    effect(() => {
      const caption = this.caption();
      untracked(() => caption && this.enter(this.captionEl, CAPTION_IN, 300, 'ease-out'));
    });
    effect(() => {
      const banner = this.banner();
      untracked(() => banner && this.enter(this.bannerEl, BANNER_SWEEP, this.current()?.durationMs ?? 0, 'linear'));
    });
  }

  private animated(): boolean {
    // Reduced motion only picks the default speed (Instant); a speed the player chose still animates.
    return Number.isFinite(this.speed.factor());
  }

  // A duration at the chosen speed.
  private ms(normal: number): number {
    return normal / this.speed.factor();
  }

  private enter(ref: () => ElementRef<HTMLElement> | undefined, keyframes: Keyframe[], normalMs: number, easing: string): void {
    if (!this.animated() || normalMs <= 0) return;
    const duration = this.ms(normalMs);
    afterNextRender(
      () => {
        const el = ref()?.nativeElement;
        if (el) this.animations.run(el, keyframes, { duration, easing, fill: 'forwards' });
      },
      { injector: this.injector }
    );
  }

  // Only a play shows anything here, and only for its own beat: the card at the centre, and arrows to its
  // targets that are drawn and then fade. The next beat clears both.
  private show(beat: PlannedBeat | null): void {
    this.animations.finishAll();
    const visual = beat?.visual;
    const beatMs = beat ? this.ms(beat.durationMs) : 0;
    if (!this.animated() || visual?.kind !== 'play' || beatMs <= 0) {
      this.played.set(null);
      this.lines.set([]);
      return;
    }
    const id = this.nextId++;
    this.played.set({ id, ...playedCard(visual.card, id), showMs: beatMs });
    this.lines.set(visual.targetSeatIds.map((to) => this.targetLine(visual.seatId, to, 0.35 * beatMs, beatMs)));
  }

  private targetLine(from: string, to: string, drawMs: number, showMs: number): TargetLine {
    const origin = this.host.getBoundingClientRect();
    const local = (el: Element | null): Point => {
      const p = el ? centreOf(el) : { x: origin.left + origin.width / 2, y: origin.top + this.centreY() };
      return { x: p.x - origin.left, y: p.y - origin.top };
    };
    // The viewer's own seat is below the table: its end stops at the table's edge, pointing at it.
    const end = (el: Element | null) => {
      const p = local(el);
      const inside = (v: number, size: number) => Math.min(Math.max(v, LINE_EDGE), Math.max(LINE_EDGE, size - LINE_EDGE));
      const clamped = { x: inside(p.x, origin.width), y: inside(p.y, origin.height) };
      const out = clamped.x !== p.x || clamped.y !== p.y;
      return { point: clamped, radius: out ? 0 : radiusOf(el) };
    };
    const start = end(this.seatElement(from));
    const finish = end(this.seatElement(to));
    return { key: `${this.nextId++}:${from}>${to}`, d: curve(start.point, finish.point, start.radius, finish.radius), drawMs, showMs };
  }

  private seatElement(seatId: string): Element | null {
    return this.host.ownerDocument.querySelector(`[data-seat-id=${JSON.stringify(seatId)}]`);
  }
}

function centreOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// How far short of a tile's centre a line stops.
function radiusOf(el: Element | null): number {
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return Math.min(r.width, r.height) * 0.45;
}

// The prototype's arrow: a quadratic curve bowed to one side, cut short of both tiles.
function curve(a: Point, b: Point, ra: number, rb: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const c = { x: (a.x + b.x) / 2 - dy * 0.15, y: (a.y + b.y) / 2 + dx * 0.15 };
  const cut = (p: Point, r: number): Point => {
    const l = Math.hypot(p.x - c.x, p.y - c.y);
    const by = l > 0 ? Math.min(r, length * 0.4) / l : 0;
    return { x: p.x - (p.x - c.x) * by, y: p.y - (p.y - c.y) * by };
  };
  const start = cut(a, ra);
  const end = cut(b, rb);
  const n = (v: number) => Math.round(v * 10) / 10;
  return `M${n(start.x)},${n(start.y)} Q${n(c.x)},${n(c.y)} ${n(end.x)},${n(end.y)}`;
}

// The card a used card shows at the centre: the card itself, or the card it is used as, with the suit
// and number it has. A card a skill makes from nothing has none, and shows its name only.
function playedCard(used: UsedCard, id: number): { card: CardInstance; faceless: boolean } {
  const shownId = shownCardId(used);
  const one = used.physical.length === 1 ? used.physical[0] : null;
  if (one && one.definitionId === shownId) return { card: one, faceless: false };
  const suit = used.suit ?? one?.suit;
  const rank = used.rank ?? one?.rank;
  const faceless = suit === undefined || rank === undefined;
  // A faceless card's suit and rank are never shown.
  return { card: { instanceId: `used-${id}`, definitionId: shownId, suit: suit ?? 'spade', rank: rank ?? 0 }, faceless };
}

// "Seat 1's Turn", over its General and force once they are known.
function turnBanner(state: GameState, seatId: string, tr: Translator): { title: string; detail: string | null } {
  const seat = state.seats.find((s) => s.id === seatId);
  const general = seat ? knownGeneral(seat, tr) : null;
  const force = seat && (seat.kingdom !== 'hidden' || seat.allegiance === 'ambitionist') ? seatKingdomLabel(seat, tr) : null;
  return {
    title: tr('banner.turn', { seat: seatName(state.players, seatId, tr) }),
    detail: general && force ? tr('banner.turnDetail', { general, force }) : general,
  };
}

function knownGeneral(seat: Seat, tr: Translator): string | null {
  const id = [seat.generals?.main, seat.generals?.deputy].map((g) => g?.generalDefinitionId).find((g) => g && g !== 'hidden');
  return id ? (generalDisplayData(id, localeOf(tr))?.name ?? generalDisplayName(id, tr)) : null;
}
