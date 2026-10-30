import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardZone, EngineEvent, GameState, Seat, UsedCard } from 'engine';
import { PlaybackSpeed } from '../../playback-speed.service';
import { PlannedBeat } from './beats';
import { foldEvent } from './displayed-state';
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

function setup(beat: PlannedBeat | null, stack: UsedCard[] = [], opts: { line?: string | null; shown?: GameState; speed?: 'normal' | 'instant' } = {}) {
  const director = { current: signal(beat), centreStack: signal(stack), displayedState: signal(opts.shown ?? state(beat ? [beat.event] : [])) };
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

  beforeEach(() => {
    animate = jest.fn(() => ({ finished: new Promise(() => undefined), finish: jest.fn(), cancel: jest.fn() }));
    Element.prototype.animate = animate as unknown as Element['animate'];
  });

  afterEach(() => {
    Element.prototype.animate = original;
  });

  it('renders a target path per target for a fan-out play', async () => {
    const { fixture, el } = setup(playBeat(['seat-1', 'seat-2', 'seat-3']), [arrows]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('svg path.line').length).toBe(3);
  });

  it('greys the line a response answers', async () => {
    const { fixture, el, director } = setup(playBeat(['seat-1', 'seat-2']), [arrows]);
    fixture.detectChanges();
    await fixture.whenStable();
    const dodge: UsedCard = { as: 'shan', colour: 'black', physical: [] };
    const event = { kind: 'CardPlayedEvent', seatId: 'seat-2', card: dodge, targets: [], inResponseTo: { seatId: 'seat-0' } } as unknown as EngineEvent;
    director.current.set({ logIndex: 1, event, durationMs: 900, visual: { kind: 'play', seatId: 'seat-2', card: dodge, targetSeatIds: [], answersSeatId: 'seat-0', response: true } });
    director.centreStack.set([arrows, dodge]);
    fixture.detectChanges();
    await fixture.whenStable();
    const answered = [...el.querySelectorAll('svg path.line')].map((p) => p.classList.contains('answered'));
    expect(answered).toEqual([false, true]);
  });

  it('keeps the stack and its lines while idle, and sweeps them when the stack clears', async () => {
    const { fixture, el, director } = setup(playBeat(['seat-1']), [arrows]);
    fixture.detectChanges();
    await fixture.whenStable();
    director.current.set(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('svg path.line').length).toBe(1);
    expect(el.querySelectorAll('.stack app-playing-card').length).toBe(1);
    const event: EngineEvent = { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Discard' };
    director.current.set({ logIndex: 1, event, durationMs: 250, visual: { kind: 'phase', seatId: 'seat-0', phase: 'Discard' } });
    director.centreStack.set([]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('svg path.line').length).toBe(0);
    expect(el.querySelectorAll('.stack app-playing-card').length).toBe(0);
    expect(el.querySelectorAll('.flight app-playing-card').length).toBe(1);
  });

  it('shows the caption for the current beat', async () => {
    const { fixture, el } = setup(playBeat(['seat-1']), [arrows], { line: 'Seat 0 used Arrow Barrage on Seat 1' });
    fixture.detectChanges();
    await fixture.whenStable();
    const caption = el.querySelector('.caption')!;
    expect(caption.textContent?.trim()).toBe('Seat 0 used Arrow Barrage on Seat 1');
    expect(caption.getAttribute('aria-live')).toBe('polite');
  });

  it('shows the turn banner for a TurnAdvancedEvent beat', async () => {
    const event: EngineEvent = { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 2 };
    const shown = state([event], [seat('seat-0', 0), seat('seat-1', 1, { kingdom: 'Wei', generals: { main: { generalDefinitionId: 'caocao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })]);
    const { fixture, el } = setup({ logIndex: 0, event, durationMs: 1000, visual: { kind: 'turn', seatId: 'seat-1' } }, [], { shown });
    fixture.componentRef.setInput('state', shown);
    fixture.detectChanges();
    await fixture.whenStable();
    const banner = el.querySelector('.banner')!;
    expect(banner.textContent).toContain("Seat 1's Turn");
    expect(banner.textContent).toContain('Wei');
  });

  it('at Instant, no element is animated', async () => {
    const { fixture, el } = setup(playBeat(['seat-1', 'seat-2']), [arrows], { line: 'Seat 0 used Arrow Barrage', speed: 'instant' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('svg path.line').length).toBe(2);
    expect(el.querySelectorAll('.stack app-playing-card').length).toBe(1);
    expect(animate).not.toHaveBeenCalled();
  });

  it('animates the play at Normal', async () => {
    const { fixture } = setup(playBeat(['seat-1']), [arrows]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(animate).toHaveBeenCalled();
  });
  it('finishes the running animations when the next beat starts', async () => {
    const { fixture, director } = setup(playBeat(['seat-1']), [arrows]);
    fixture.detectChanges();
    await fixture.whenStable();
    const started = animate.mock.results.map((r) => r.value as { finish: jest.Mock });
    expect(started.length).toBeGreaterThan(0);
    const event: EngineEvent = { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Discard' };
    director.current.set({ logIndex: 1, event, durationMs: 250, visual: { kind: 'phase', seatId: 'seat-0', phase: 'Discard' } });
    fixture.detectChanges();
    await fixture.whenStable();
    for (const animation of started) expect(animation.finish).toHaveBeenCalled();
  });

  it('draws fly as card backs', async () => {
    const event: EngineEvent = { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['a', 'b'] };
    const { fixture, el } = setup({ logIndex: 0, event, durationMs: 780, visual: { kind: 'draw', seatId: 'seat-1', count: 2 } });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flight img.back').length).toBe(2);
    expect(el.querySelectorAll('.flight app-playing-card').length).toBe(0);
  });

  function moveSetup(toZoneId: string, shownCard: { definitionId?: string }) {
    const card = { instanceId: 'm1', definitionId: 'zhuge_crossbow', suit: 'club' as const, rank: 1 };
    const shown = state();
    shown.zones.push({ id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [] });
    shown.zones.find((z) => z.id === toZoneId)!.cards.push({ ...card, ...shownCard });
    const event: EngineEvent = { kind: 'CardMovedEvent', cardInstanceId: 'm1', fromZoneId: 'seat-0:equip', toZoneId, card };
    return setup({ logIndex: 0, event, durationMs: 500, visual: { kind: 'move', cardInstanceId: 'm1', fromZoneId: 'seat-0:equip', toZoneId, card } }, [], { shown });
  }

  it('a move into a hand flies as a back when the shown state hides the card', async () => {
    const { fixture, el } = moveSetup('seat-1:hand', { definitionId: 'hidden' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flight img.back').length).toBe(1);
    expect(el.querySelectorAll('.flight app-playing-card').length).toBe(0);
  });

  it('a hand-to-hand move the viewer cannot see flies as a back, though the card is public by the end of the queue', async () => {
    // Viewer seat-3: seat-0 hands a card to seat-1, which then discards it; the latest state has it in the Discard Pile.
    const peach = { instanceId: 'p1', definitionId: 'peach', suit: 'heart' as const, rank: 9 };
    const before = state();
    before.zones.find((z) => z.id === 'seat-0:hand')!.cards.push({ instanceId: 'p1', definitionId: 'hidden', suit: 'spade', rank: 0 });
    const handed: EngineEvent = { kind: 'CardMovedEvent', cardInstanceId: 'p1', fromZoneId: 'seat-0:hand', toZoneId: 'seat-1:hand' };
    const discarded: EngineEvent = { kind: 'CardMovedEvent', cardInstanceId: 'p1', fromZoneId: 'seat-1:hand', toZoneId: 'discardPile', card: peach };
    const target = state([handed, discarded]);
    target.zones.find((z) => z.id === 'discardPile')!.cards.push(peach);
    const shown = { ...foldEvent(before, handed, target), log: [handed] };
    expect(shown.zones.find((z) => z.id === 'seat-1:hand')!.cards[0].definitionId).toBe('hidden');
    const { fixture, el } = setup({ logIndex: 0, event: handed, durationMs: 500, visual: { kind: 'move', cardInstanceId: 'p1', fromZoneId: 'seat-0:hand', toZoneId: 'seat-1:hand' } }, [], { shown });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flight img.back').length).toBe(1);
    expect(el.querySelectorAll('.flight app-playing-card').length).toBe(0);
  });

  it('a move into a hidden zone flies as a back even if the shown state has the card face up elsewhere', async () => {
    const { fixture, el } = moveSetup('seat-1:hand', { definitionId: 'hidden' });
    // A stale face-up copy elsewhere must not leak into the flight.
    const shown = fixture.componentInstance as unknown as { director: { displayedState: ReturnType<typeof signal<GameState>> } };
    const current = shown.director.displayedState();
    shown.director.displayedState.set({ ...current, zones: current.zones.map((z) => (z.id === 'discardPile' ? { ...z, cards: [{ instanceId: 'm1', definitionId: 'zhuge_crossbow', suit: 'club', rank: 1 }] } : z)) });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flight img.back').length).toBe(1);
    expect(el.querySelectorAll('.flight app-playing-card').length).toBe(0);
  });

  it('a move between face-up zones shows its face', async () => {
    const { fixture, el } = moveSetup('discardPile', {});
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('.flight app-playing-card').length).toBe(1);
  });

  it('a card a skill makes with no suit shows no suit and number', async () => {
    const made: UsedCard = { as: 'sha', colour: 'none', physical: [] };
    const event = { kind: 'CardPlayedEvent', seatId: 'seat-0', card: made, targets: [] } as unknown as EngineEvent;
    const { fixture, el } = setup({ logIndex: 0, event, durationMs: 900, visual: { kind: 'play', seatId: 'seat-0', card: made, targetSeatIds: [], response: false } }, [made], { speed: 'instant' });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelectorAll('.stack app-playing-card').length).toBe(1);
    expect(el.querySelector('.stack .face')).toBeNull();
  });

  it('animates under reduced motion when the player picked a speed', async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = jest.fn(() => ({ matches: true }) as MediaQueryList);
    try {
      const { fixture } = setup(playBeat(['seat-1']), [arrows]);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(animate).toHaveBeenCalled();
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it('draws a line without holding its dashes, so an answered line turns dashed', async () => {
    const proto = SVGElement.prototype as unknown as { getTotalLength?: () => number };
    proto.getTotalLength = () => 100;
    try {
      const { fixture, el } = setup(playBeat(['seat-1']), [arrows]);
      fixture.detectChanges();
      await fixture.whenStable();
      const call = animate.mock.calls.find((_, i) => animate.mock.contexts[i] === el.querySelector('path.line'));
      expect(call?.[1]).toMatchObject({ fill: 'backwards' });
    } finally {
      delete proto.getTotalLength;
    }
  });

  it("stops a line to the viewer's seat, off the table, at the table's edge", async () => {
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
      const { fixture, el } = setup({ ...play, visual }, [arrows]);
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
