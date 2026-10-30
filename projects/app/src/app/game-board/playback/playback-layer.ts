import { Component, Directive, ElementRef, Injectable, Injector, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import type { CardInstance, GameState, Seat, UsedCard } from 'engine';
import { CARD_BACK_ART_URL, generalDisplayData } from 'content';
import { I18n } from '../../i18n/i18n.service';
import { localeOf, Translator } from '../../i18n/translator';
import { generalDisplayName, seatKingdomLabel, seatName, shownCardId } from '../../labels';
import { PlaybackSpeed } from '../../playback-speed.service';
import { prefersReducedMotion } from '../beat-player';
import { PlayingCard } from '../playing-card';
import type { BeatVisual, PlannedBeat } from './beats';
import { PlaybackDirector } from './playback-director';
import { NO_CENTRE, nextCentre, ResolutionCentre } from './seat-cues';

// A point on screen, in px from the viewport's top left.
interface Point {
  x: number;
  y: number;
}

// A card in the air, drawn face up or (with no card) as a card back.
interface Flight {
  id: number;
  card: CardInstance | null;
  from: Point;
  to: Point;
  scale: [number, number];
  durationMs: number;
  delayMs: number;
}

// A card played into the resolution, and where it flies in from (null: it is simply there).
interface StackEntry {
  id: number;
  used: UsedCard;
  card: CardInstance;
  landing: { from: Point; durationMs: number } | null;
}

// A curved arrow from a card's user to one of its targets; `d` is in the layer's px.
interface TargetLine {
  key: string;
  from: string;
  to: string;
  d: string;
  answered: boolean;
  drawMs: number;
  delayMs: number;
}

// The prototype's flight easing.
const FLIGHT_EASING = 'cubic-bezier(.2,.8,.2,1)';
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

// The layer's running animations. A beat's animations never outlive it: the next beat finishes them,
// since the director may play faster than the chosen speed (a rush online).
@Injectable()
export class PlaybackAnimations {
  private readonly running = new Set<Animation>();

  // `done` runs once the animation ends, finished or cut; at once where the element cannot animate.
  run(el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions, done?: () => void): void {
    if (typeof el.animate !== 'function') {
      done?.();
      return;
    }
    const animation = el.animate(keyframes, options);
    this.running.add(animation);
    const end = () => {
      this.running.delete(animation);
      done?.();
    };
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

// Flies its element from one point to another. The element sits at its containing block's top left,
// so it moves by transform alone.
@Directive({ selector: '[appFlight]' })
export class FlightMotion {
  readonly flight = input.required<Flight>({ alias: 'appFlight' });
  readonly landed = output<void>();

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const animations = inject(PlaybackAnimations);
    afterNextRender(() => {
      const { from, to, scale, durationMs, delayMs } = this.flight();
      const origin = el.getBoundingClientRect();
      const at = (p: Point, s: number) => `translate(${p.x - origin.left - origin.width / 2}px, ${p.y - origin.top - origin.height / 2}px) scale(${s})`;
      animations.run(
        el,
        [
          { transform: at(from, scale[0]), opacity: 0.4 },
          { transform: at(to, scale[1]), opacity: 1 },
        ],
        { duration: durationMs, delay: delayMs, easing: FLIGHT_EASING, fill: 'both' },
        () => this.landed.emit()
      );
    });
  }
}

// A card landing on the centre stack: it flies in from its user to where it lies.
@Directive({ selector: '[appLandFrom]' })
export class LandingMotion {
  readonly landing = input<StackEntry['landing']>(null, { alias: 'appLandFrom' });

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const animations = inject(PlaybackAnimations);
    afterNextRender(() => {
      const landing = this.landing();
      if (!landing) return;
      const at = centreOf(el);
      const shift = `translate(${landing.from.x - at.x}px, ${landing.from.y - at.y}px) scale(0.55)`;
      animations.run(
        el,
        [
          { transform: shift, opacity: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: landing.durationMs, easing: FLIGHT_EASING, fill: 'backwards' }
      );
    });
  }
}

// Draws its path from start to end, stroke-dash style.
@Directive({ selector: '[appLineDraw]' })
export class LineDrawMotion {
  readonly line = input.required<TargetLine>({ alias: 'appLineDraw' });

  constructor() {
    const el = inject<ElementRef<SVGPathElement>>(ElementRef).nativeElement;
    const animations = inject(PlaybackAnimations);
    afterNextRender(() => {
      const { drawMs, delayMs } = this.line();
      const length = drawMs > 0 && typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
      if (!length) return;
      animations.run(
        el,
        [
          { strokeDasharray: `${length}`, strokeDashoffset: `${length}` },
          { strokeDasharray: `${length}`, strokeDashoffset: '0' },
        ],
        { duration: drawMs, delay: delayMs, easing: 'ease-out', fill: 'both' }
      );
    });
  }
}

let layerCount = 0;

// Over the battlefield while a battle plays: cards flying between seats, the centre and the piles,
// arrows to a card's targets, a one-line caption for the beat on show and a banner when a turn starts.
// Presentation only: it replays what the director shows. At Instant, or for a viewer who prefers
// reduced motion, nothing moves and each beat's end state shows at once.
@Component({
  selector: 'app-playback-layer',
  imports: [PlayingCard, FlightMotion, LandingMotion, LineDrawMotion],
  providers: [PlaybackAnimations],
  template: `
    <svg class="lines" aria-hidden="true">
      <defs>
        <marker [attr.id]="headId" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="head" d="M0,0 L10,5 L0,10 z" /></marker>
        <marker [attr.id]="headId + '-grey'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path class="head grey" d="M0,0 L10,5 L0,10 z" /></marker>
      </defs>
      @for (line of lines(); track line.key) {
        <svg:path class="line" [class.answered]="line.answered" [attr.d]="line.d" [attr.marker-end]="'url(#' + headId + (line.answered ? '-grey' : '') + ')'" [appLineDraw]="line" />
      }
    </svg>
    <div class="caption" #captionBox aria-live="polite" [style.top.px]="centreY() - centreHeight() / 2">{{ caption() }}</div>
    <div class="stack" [style.top.px]="centreY()">
      @for (entry of stack(); track entry.id) {
        <app-playing-card [card]="entry.card" [appLandFrom]="entry.landing" [attr.data-stack-id]="entry.id" />
      }
    </div>
    @if (banner(); as b) {
      <div class="banner" #bannerBox [style.top.px]="centreY()">
        {{ b.title }}
        @if (b.detail) {
          <small>{{ b.detail }}</small>
        }
      </div>
    }
    @for (flight of flights(); track flight.id) {
      <div class="flight" [appFlight]="flight" (landed)="land(flight.id)">
        @if (flight.card; as card) {
          <app-playing-card [card]="card" />
        } @else {
          <img class="back" [src]="cardBack" alt="" />
        }
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
    .lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .line { fill: none; stroke: #ffcc80; stroke-width: 3; stroke-linecap: round; }
    .line.answered { stroke: #cfc6b8; stroke-dasharray: 6 6; }
    .head { fill: #ffcc80; }
    .head.grey { fill: #cfc6b8; }
    .caption {
      position: absolute; left: 8%; right: 8%; min-height: 1.2em; text-align: center;
      color: #f4ecdc; font-weight: 600; font-size: 1.3em; line-height: 1.2; text-shadow: 0 2px 4px rgb(0 0 0 / 60%);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .stack { position: absolute; left: 50%; transform: translate(-50%, -50%); display: flex; gap: 8px; filter: drop-shadow(0 4px 8px rgb(0 0 0 / 45%)); }
    .banner {
      position: absolute; left: 0; right: 0; transform: translateY(-50%); padding: 12px 0; text-align: center;
      color: #fff; font-weight: 700; font-size: 1.9em; text-shadow: 0 2px 4px rgb(0 0 0 / 60%);
      background: linear-gradient(90deg, transparent, rgb(0 0 0 / 60%) 20%, rgb(0 0 0 / 60%) 80%, transparent);
    }
    .banner small { display: block; font-weight: 500; font-size: 0.45em; opacity: 0.85; }
    /* In the air: fixed, so a flight to the viewer's hand or the Discard Pile is not cut at the table's edge. */
    .flight { position: fixed; left: 0; top: 0; width: 70px; height: 96px; z-index: 1000; }
    .back { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 6px; box-shadow: 0 2px 6px rgb(0 0 0 / 45%); }
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
  protected readonly cardBack = CARD_BACK_ART_URL;
  protected readonly stack = signal<StackEntry[]>([]);
  protected readonly lines = signal<TargetLine[]>([]);
  protected readonly flights = signal<Flight[]>([]);

  private readonly current = computed(() => this.director?.current() ?? null);
  protected readonly caption = computed(() => {
    const visual = this.current()?.visual;
    return this.current() && visual?.kind !== 'turn' ? this.line() : null;
  });
  protected readonly banner = computed(() => {
    const visual = this.current()?.visual;
    return visual?.kind === 'turn' ? turnBanner(this.state(), visual.seatId, this.i18n.translator) : null;
  });

  // The resolution the lines belong to (seat-cues' nextCentre).
  private centre: ResolutionCentre = NO_CENTRE;
  private nextId = 0;

  constructor() {
    effect(() => {
      const beat = this.current();
      const stack = this.director?.centreStack() ?? [];
      untracked(() => this.show(beat, stack));
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

  protected land(id: number): void {
    this.flights.update((flights) => flights.filter((f) => f.id !== id));
  }

  private animated(): boolean {
    return Number.isFinite(this.speed.factor()) && !prefersReducedMotion();
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

  private show(beat: PlannedBeat | null, stack: UsedCard[]): void {
    this.animations.finishAll();
    const animated = this.animated();
    const visual = beat?.visual ?? null;
    const beatMs = beat ? this.ms(beat.durationMs) : 0;
    const flights: Omit<Flight, 'id'>[] = [];

    // Cards that left the centre sweep to the Discard Pile; a newly played one flies in from its user.
    const before = this.stack();
    if (animated) {
      before
        .filter((entry) => !stack.includes(entry.used))
        .forEach((entry, i) => {
          const el = this.host.querySelector(`[data-stack-id="${entry.id}"]`);
          if (el) flights.push({ card: entry.card, from: centreOf(el), to: this.discardPoint(), scale: [1, 0.6], durationMs: this.ms(320), delayMs: this.ms(80 * i) });
        });
    }
    this.stack.set(
      stack.map((used) => {
        const kept = before.find((entry) => entry.used === used);
        if (kept) return kept;
        const id = this.nextId++;
        const fromUser = animated && visual?.kind === 'play' && visual.card === used;
        return { id, used, card: stackCard(used, id), landing: fromUser ? { from: this.seatPoint(visual.seatId, true), durationMs: 0.55 * beatMs } : null };
      })
    );

    this.updateLines(beat, stack.length, animated ? beatMs : 0);

    if (animated && visual?.kind === 'draw') {
      const to = this.seatPoint(visual.seatId, true);
      for (let k = 0; k < visual.count; k++) {
        flights.push({ card: null, from: this.drawPoint(), to, scale: [1, 0.6], durationMs: this.ms(480), delayMs: this.ms(140 * k) });
      }
    }
    // A played card's own move to the Discard Pile is the stack's sweep.
    if (animated && visual?.kind === 'move' && beat!.durationMs > 0 && !stack.some((used) => used.physical.some((c) => c.instanceId === visual.cardInstanceId))) {
      const from = this.zonePoint(visual.fromZoneId);
      const to = this.zonePoint(visual.toZoneId);
      if (from && to) flights.push({ card: this.moveFace(visual), from, to, scale: [0.8, 0.8], durationMs: 0.9 * beatMs, delayMs: 0 });
    }
    if (flights.length > 0) this.flights.update((all) => [...all, ...flights.map((f) => ({ ...f, id: this.nextId++ }))]);
  }

  // A new resolution draws a line from its user to each target; a response greys the line from the
  // seat it answers to its user, and draws its own to its targets. They clear with the centre.
  private updateLines(beat: PlannedBeat | null, stackSize: number, beatMs: number): void {
    const centre = nextCentre(this.centre, beat, stackSize);
    if (centre !== this.centre) {
      this.centre = centre;
      const source = centre.sourceSeatId;
      this.lines.set(source ? centre.targetSeatIds.map((to) => this.targetLine(source, to, 0.4 * beatMs, 0.45 * beatMs)) : []);
    }
    const visual = beat?.visual;
    if (visual?.kind !== 'play' || !visual.response || stackSize === 0) return;
    this.lines.update((lines) => [
      ...lines.map((l) => (l.from === visual.answersSeatId && l.to === visual.seatId ? { ...l, answered: true } : l)),
      ...visual.targetSeatIds.filter((to) => !lines.some((l) => l.from === visual.seatId && l.to === to)).map((to) => this.targetLine(visual.seatId, to, 0.3 * beatMs, 0.45 * beatMs)),
    ]);
  }

  private targetLine(from: string, to: string, delayMs: number, drawMs: number): TargetLine {
    const origin = this.host.getBoundingClientRect();
    const a = this.seatElement(from, false);
    const b = this.seatElement(to, false);
    const local = (el: Element | null): Point => {
      const p = el ? centreOf(el) : { x: origin.left + origin.width / 2, y: origin.top + this.centreY() };
      return { x: p.x - origin.left, y: p.y - origin.top };
    };
    return { key: `${this.nextId++}:${from}>${to}`, from, to, d: curve(local(a), local(b), radiusOf(a), radiusOf(b)), answered: false, drawMs, delayMs };
  }

  // The face a moving card shows: what the shown state shows of it. A card to or from a hand shows
  // nothing more; a card between open zones shows the face the event carries.
  private moveFace(visual: Extract<BeatVisual, { kind: 'move' }>): CardInstance | null {
    const zones = this.director?.displayedState()?.zones ?? this.state().zones;
    const shown = zones.flatMap((z) => z.cards).find((c) => c.instanceId === visual.cardInstanceId);
    if (shown && shown.definitionId !== 'hidden') return shown;
    const kindOf = (zoneId: string) => zones.find((z) => z.id === zoneId)?.kind;
    if (kindOf(visual.fromZoneId) === 'hand' || kindOf(visual.toZoneId) === 'hand') return null;
    return visual.card ?? null;
  }

  // A seat on screen: its tile, or for the viewer's hand, the hand.
  private seatElement(seatId: string, hand: boolean): Element | null {
    const doc = this.host.ownerDocument;
    const handEl = hand && seatId === this.viewerSeatId() ? doc.querySelector('[data-playback-anchor="hand"]') : null;
    return handEl ?? doc.querySelector(`[data-seat-id=${JSON.stringify(seatId)}]`);
  }

  private seatPoint(seatId: string, hand: boolean): Point {
    const el = this.seatElement(seatId, hand);
    return el ? centreOf(el) : this.tablePoint(0.5);
  }

  private zonePoint(zoneId: string): Point | null {
    const zone = this.state().zones.find((z) => z.id === zoneId);
    if (!zone) return null;
    if (zone.kind === 'drawPile') return this.drawPoint();
    if (zone.kind === 'discardPile') return this.discardPoint();
    if (zone.kind === 'processing') return this.tablePoint(0.5);
    return zone.ownerSeatId ? this.seatPoint(zone.ownerSeatId, zone.kind === 'hand') : null;
  }

  // The Draw Pile has no place on the board: cards come from the left of the centre.
  private drawPoint(): Point {
    return this.tablePoint(0.3);
  }

  private discardPoint(): Point {
    const el = this.host.ownerDocument.querySelector('[data-playback-anchor="discard"]');
    return el ? centreOf(el) : this.tablePoint(0.7);
  }

  // A point across the table at the centre's height, `across` of the way from the left.
  private tablePoint(across: number): Point {
    const table = this.host.getBoundingClientRect();
    return { x: table.left + table.width * across, y: table.top + this.centreY() };
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

// The card a used card shows on the stack: the card itself, or the card it is used as.
function stackCard(used: UsedCard, id: number): CardInstance {
  const shownId = shownCardId(used);
  const one = used.physical.length === 1 ? used.physical[0] : null;
  if (one && one.definitionId === shownId) return one;
  return { instanceId: `used-${id}`, definitionId: shownId, suit: used.suit ?? one?.suit ?? 'spade', rank: used.rank ?? one?.rank ?? 0 };
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
