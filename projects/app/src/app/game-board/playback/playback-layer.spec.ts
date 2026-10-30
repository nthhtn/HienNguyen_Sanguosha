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
});
