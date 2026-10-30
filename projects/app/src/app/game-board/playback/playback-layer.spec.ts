import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardZone, EngineEvent, GameState, Seat, UsedCard } from 'engine';
import { PlaybackSpeed } from '../../playback-speed.service';
import { PlannedBeat } from './beats';
import { PlaybackDirector } from './playback-director';
import { PlaybackLayer } from './playback-layer';

function seat(id: string, index: number, overrides: Partial<Seat> = {}): Seat {
  return {
    id, index, kingdom: 'hidden', eliminated: false,
    generals: { main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
    combinedHp: 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    ...overrides,
  };
}

function state(log: EngineEvent[] = [], seats: Seat[] = [0, 1, 2, 3].map((i) => seat(`seat-${i}`, i))): GameState {
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: [] },
    { id: 'discardPile', kind: 'discardPile', cards: [] },
    ...seats.map((s): CardZone => ({ id: s.hand.zoneId, kind: 'hand', ownerSeatId: s.id, cards: [] })),
  ];
  return {
    seats, players: [], zones, log,
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play', pendingResponse: null, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const arrows: UsedCard = { as: 'arrow_barrage', colour: 'red', suit: 'heart', rank: 1, physical: [{ instanceId: 'c1', definitionId: 'arrow_barrage', suit: 'heart', rank: 1 }] };

function playBeat(targets: string[]): PlannedBeat {
  const event: EngineEvent = { kind: 'CardPlayedEvent', seatId: 'seat-0', card: arrows, targets: targets.map((seatId) => ({ kind: 'seat', seatId })) } as EngineEvent;
  return { logIndex: 0, event, durationMs: 1050, visual: { kind: 'play', seatId: 'seat-0', card: arrows, targetSeatIds: targets, response: false } };
}

function setup(beat: PlannedBeat | null, opts: { line?: string | null; shown?: GameState; speed?: 'normal' | 'instant' } = {}) {
  const director = { current: signal(beat), displayedState: signal(opts.shown ?? state(beat ? [beat.event] : [])) };
  TestBed.configureTestingModule({ providers: [{ provide: PlaybackDirector, useValue: director }] });
  TestBed.inject(PlaybackSpeed).speed.set(opts.speed ?? 'normal');
  const fixture = TestBed.createComponent(PlaybackLayer);
  fixture.componentRef.setInput('state', director.displayedState());
  fixture.componentRef.setInput('viewerSeatId', 'seat-3');
  fixture.componentRef.setInput('line', opts.line ?? null);
  fixture.componentRef.setInput('centreY', 300);
  return { fixture, director, el: fixture.nativeElement as HTMLElement };
}

describe('PlaybackLayer', () => {
  let animate: jest.Mock;
  const original = Element.prototype.animate;
  const arrowsShown = (el: HTMLElement) => el.querySelectorAll('svg g.arrow').length;
  const cardsShown = (el: HTMLElement) => el.querySelectorAll('.played app-playing-card').length;
  const phaseBeat: PlannedBeat = { logIndex: 1, event: { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Discard' }, durationMs: 250, visual: { kind: 'phase', seatId: 'seat-0', phase: 'Discard' } };

  beforeEach(() => {
    animate = jest.fn(() => ({ finished: new Promise(() => undefined), finish: jest.fn(), cancel: jest.fn() }));
    Element.prototype.animate = animate as unknown as Element['animate'];
  });

  afterEach(() => {
    Element.prototype.animate = original;
  });

  it('draws an arrow per target for a fan-out play, each a white line over a dark outline', async () => {
    const { fixture, el } = setup(playBeat(['seat-1', 'seat-2', 'seat-3']));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(arrowsShown(el)).toBe(3);
    const arrow = el.querySelector('svg g.arrow')!;
    expect(arrow.querySelector('path.outline')).not.toBeNull();
    expect(arrow.querySelector('path.line')!.getAttribute('marker-end')).toMatch(/^url\(#playback-head-/);
  });

  it('shows the played card at the centre, then fades it and the arrows out within the beat', async () => {
    const { fixture, el } = setup(playBeat(['seat-1']));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cardsShown(el)).toBe(1);
    const fades = animate.mock.calls.filter(([keyframes]) => (keyframes as Keyframe[]).at(-1)?.['opacity'] === 0);
    // The card and the arrow each fade out, over the whole beat (1050 ms at Normal).
    expect(fades).toHaveLength(2);
    for (const [, options] of fades) expect(options).toMatchObject({ duration: 1050, fill: 'forwards' });
  });

  it('clears the card and the arrows when the next beat starts, and shows nothing while idle', async () => {
    const { fixture, el, director } = setup(playBeat(['seat-1']));
    fixture.detectChanges();
    await fixture.whenStable();
    director.current.set(phaseBeat);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cardsShown(el)).toBe(0);
    expect(arrowsShown(el)).toBe(0);
    director.current.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cardsShown(el)).toBe(0);
    expect(arrowsShown(el)).toBe(0);
  });

  it('shows a response on its own, for its moment', async () => {
    const dodge: UsedCard = { as: 'shan', colour: 'black', suit: 'club', rank: 2, physical: [{ instanceId: 'd1', definitionId: 'shan', suit: 'club', rank: 2 }] };
    const event = { kind: 'CardPlayedEvent', seatId: 'seat-2', card: dodge, targets: [], inResponseTo: { seatId: 'seat-0' } } as unknown as EngineEvent;
    const { fixture, el } = setup({ logIndex: 1, event, durationMs: 900, visual: { kind: 'play', seatId: 'seat-2', card: dodge, targetSeatIds: [], answersSeatId: 'seat-0', response: true } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cardsShown(el)).toBe(1);
    expect(arrowsShown(el)).toBe(0);
  });

  it('flies nothing: a draw or a move shows nothing on the overlay', async () => {
    const event: EngineEvent = { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['a', 'b'] };
    const { fixture, el } = setup({ logIndex: 0, event, durationMs: 780, visual: { kind: 'draw', seatId: 'seat-1', count: 2 } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-playing-card, img').length).toBe(0);
    expect(animate).not.toHaveBeenCalled();
  });

  it('shows the caption for the current beat', async () => {
    const { fixture, el } = setup(playBeat(['seat-1']), { line: 'Seat 0 used Arrow Barrage on Seat 1' });
    fixture.detectChanges();
    await fixture.whenStable();
    const caption = el.querySelector('.caption')!;
    expect(caption.textContent?.trim()).toBe('Seat 0 used Arrow Barrage on Seat 1');
    expect(caption.getAttribute('aria-live')).toBe('polite');
  });

  it('shows the turn banner for a TurnAdvancedEvent beat', async () => {
    const event: EngineEvent = { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 2 };
    const shown = state([event], [seat('seat-0', 0), seat('seat-1', 1, { kingdom: 'Wei', generals: { main: { generalDefinitionId: 'caocao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })]);
    const { fixture, el } = setup({ logIndex: 0, event, durationMs: 1000, visual: { kind: 'turn', seatId: 'seat-1' } }, { shown });
    fixture.componentRef.setInput('state', shown);
    fixture.detectChanges();
    await fixture.whenStable();
    const banner = el.querySelector('.banner')!;
    expect(banner.textContent).toContain("Seat 1's Turn");
    expect(banner.textContent).toContain('Wei');
  });

  it('at Instant, shows no card or arrow and animates nothing', async () => {
    const { fixture, el } = setup(playBeat(['seat-1', 'seat-2']), { line: 'Seat 0 used Arrow Barrage', speed: 'instant' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(arrowsShown(el)).toBe(0);
    expect(cardsShown(el)).toBe(0);
    expect(animate).not.toHaveBeenCalled();
  });

  it('finishes the running animations when the next beat starts', async () => {
    const { fixture, director } = setup(playBeat(['seat-1']));
    fixture.detectChanges();
    await fixture.whenStable();
    const started = animate.mock.results.map((r) => r.value as { finish: jest.Mock });
    expect(started.length).toBeGreaterThan(0);
    director.current.set(phaseBeat);
    fixture.detectChanges();
    await fixture.whenStable();
    for (const animation of started) expect(animation.finish).toHaveBeenCalled();
  });

  it('a card a skill makes with no suit shows no suit and number', async () => {
    const made: UsedCard = { as: 'sha', colour: 'none', physical: [] };
    const event = { kind: 'CardPlayedEvent', seatId: 'seat-0', card: made, targets: [] } as unknown as EngineEvent;
    const { fixture, el } = setup({ logIndex: 0, event, durationMs: 900, visual: { kind: 'play', seatId: 'seat-0', card: made, targetSeatIds: [], response: false } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cardsShown(el)).toBe(1);
    expect(el.querySelector('.played .face')).toBeNull();
  });

  it('animates under reduced motion when the player picked a speed', async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = jest.fn(() => ({ matches: true }) as MediaQueryList);
    try {
      const { fixture } = setup(playBeat(['seat-1']));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(animate).toHaveBeenCalled();
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("stops an arrow to the viewer's seat, off the table, at the table's edge", async () => {
    const box = (left: number, top: number, width: number, height: number) => () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const seatEl = (id: string, rect: () => DOMRect) => {
      const div = document.createElement('div');
      div.dataset['seatId'] = id;
      div.getBoundingClientRect = rect;
      document.body.appendChild(div);
      return div;
    };
    const tiles = [seatEl('seat-1', box(350, 20, 100, 60)), seatEl('seat-3', box(50, 500, 100, 60))];
    try {
      const play = playBeat(['seat-3']);
      const visual = { ...play.visual!, seatId: 'seat-1' } as typeof play.visual;
      const { fixture, el } = setup({ ...play, visual });
      el.getBoundingClientRect = box(0, 0, 800, 400);
      fixture.detectChanges();
      await fixture.whenStable();
      const d = el.querySelector('path.line')!.getAttribute('d')!;
      const [x, y] = d.split(' ').at(-1)!.split(',').map(Number);
      expect(y).toBe(388);
      expect(x).toBeGreaterThanOrEqual(12);
    } finally {
      tiles.forEach((t) => t.remove());
    }
  });
});
