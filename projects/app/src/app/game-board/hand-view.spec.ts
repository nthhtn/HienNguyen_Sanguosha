import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { Action, CardInstance, ContentRegistry, GameState } from 'engine';
import { HandView } from './hand-view';

const hand: CardInstance[] = [
  { instanceId: 'c-sha', definitionId: 'sha', suit: 'spade', rank: 7 },
  { instanceId: 'c-bow', definitionId: 'crossbow', suit: 'diamond', rank: 1 },
  { instanceId: 'c-peach', definitionId: 'peach', suit: 'heart', rank: 12 },
];

function state(): GameState {
  return {
    seats: [], players: [], log: [], pendingResponse: null, result: null, generalSelection: null,
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: hand }],
    rng: { seed: 1, counter: 0 },
  };
}

const registry: ContentRegistry = {
  generals: new Map(),
  cards: new Map(
    [['sha', 'Sha'], ['crossbow', 'Crossbow'], ['peach', 'Peach']].map(([id, name]) => [
      id,
      { id, name, category: 'basic' as const, play: () => [] },
    ])
  ),
};

const shaAtSeat1: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha', targets: [{ kind: 'seat', seatId: 'seat-1' }] };
const shaAtSeat2: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha', targets: [{ kind: 'seat', seatId: 'seat-2' }] };
const equipBow: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-bow', targets: [] };
const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };

describe('HandView', () => {
  let fixture: ComponentFixture<HandView>;
  let el: HTMLElement;
  let played: Action[];

  const card = (instanceId: string) => el.querySelector(`[data-card-id="${instanceId}"]`) as HTMLElement;
  const playButton = (instanceId: string) => card(instanceId).querySelector('button.play') as HTMLButtonElement;
  const infoButton = (instanceId: string) => card(instanceId).querySelector('button.info') as HTMLButtonElement;
  const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(HandView);
    fixture.componentRef.setInput('cards', hand);
    fixture.componentRef.setInput('actions', [shaAtSeat1, shaAtSeat2, equipBow, endPhase]);
    fixture.componentRef.setInput('state', state());
    fixture.componentRef.setInput('registry', registry);
    played = [];
    fixture.componentInstance.play.subscribe((a) => played.push(a));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => overlay()?.replaceChildren());


  it('renders every hand card in one row, each with Play and Info buttons', () => {
    const row = el.querySelector('.hand-row')!;
    expect(row.querySelectorAll('.hand-card')).toHaveLength(3);
    for (const c of hand) {
      expect(playButton(c.instanceId).textContent).toContain('Play');
      expect(infoButton(c.instanceId).textContent).toContain('Info');
    }
  });

  it('shows each hand card’s name and suit and number on the card itself', () => {
    const bow = el.querySelector('[data-card-id="c-bow"]')!;
    expect(bow.querySelector('.name')!.textContent).toBe('Crossbow');
    expect(bow.querySelector('.face')!.textContent).toBe('A ♦');
    expect(bow.textContent).not.toContain('attack as much as desired');
  });

  it('plays a card with a single legal action immediately', () => {
    playButton('c-bow').click();
    expect(played).toEqual([equipBow]);
  });

  it('offers a menu when a card has several legal actions, and plays the one picked', async () => {
    playButton('c-sha').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[];
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Play Sha Targeting Seat 1', 'Play Sha Targeting Seat 2']);
    expect(played).toEqual([]);
    items[1].click();
    expect(played).toEqual([shaAtSeat2]);
  });

  it('still offers a menu when a targeted card has only one possible target, so the viewer confirms it', async () => {
    fixture.componentRef.setInput('actions', [shaAtSeat1, equipBow, endPhase]);
    fixture.detectChanges();
    playButton('c-sha').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[];
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Play Sha Targeting Seat 1']);
    expect(played).toEqual([]);
    items[0].click();
    expect(played).toEqual([shaAtSeat1]);
  });

  it('picks a two-seat play (Coerce) in two steps: the first seat, then the second', async () => {
    const pair = (first: string, second: string): Action => ({
      kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-peach', targets: [{ kind: 'seat', seatId: first }, { kind: 'seat', seatId: second }],
    });
    fixture.componentRef.setInput('actions', [pair('seat-1', 'seat-0'), pair('seat-1', 'seat-2'), pair('seat-2', 'seat-1')]);
    fixture.detectChanges();
    playButton('c-peach').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const firsts = [...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[];
    expect(firsts.map((i) => i.textContent!.trim())).toEqual(['Play Peach Targeting Seat 1', 'Play Peach Targeting Seat 2']);
    firsts[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    const seconds = ([...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[]).filter((i) => i.textContent!.trim().startsWith('At '));
    expect(seconds.map((i) => i.textContent!.trim())).toEqual(['At Seat 0', 'At Seat 2']);
    seconds[1].click();
    expect(played).toEqual([pair('seat-1', 'seat-2')]);
  });

  it('disables Play for a card with no legal action', () => {
    expect(playButton('c-peach').disabled).toBe(true);
  });

  it('opens an info dialog with the card’s name, suit/rank and rules text', async () => {
    infoButton('c-bow').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-card-info-dialog')!;
    expect(dialog.textContent).toContain('Crossbow');
    expect(dialog.textContent).toContain('A ♦');
    expect(dialog.textContent).toContain('Weapon');
    expect(dialog.textContent).toContain('Range 1');
    expect(dialog.textContent).toContain('attack as much as desired');
  });

  it('says when a card has no rules text yet', async () => {
    infoButton('c-peach').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-card-info-dialog')!;
    expect(dialog.textContent).toContain('Peach');
    expect(dialog.textContent).toContain('Q ♥');
    expect(dialog.textContent).toContain('No rules text available yet');
  });

  it('leaves discards to the Discard dialog: no Discard button on the cards', () => {
    const discardSha: Action = { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha' };
    fixture.componentRef.setInput('actions', [discardSha]);
    fixture.componentRef.setInput('state', { ...state(), phase: 'Discard' });
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Discard');
    expect(playButton('c-sha').disabled).toBe(true);
  });

  it('adds no tooltip to a card that cannot be played', () => {
    expect(playButton('c-peach').disabled).toBe(true);
    expect(fixture.debugElement.queryAll(By.directive(MatTooltip))).toHaveLength(0);
  });

  it('a play with several targets opens the Choose Targets window, then plays at the seats picked', async () => {
    const template: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha', targets: [], pickTargets: { eligibleIds: ['seat-1', 'seat-2'], min: 1, max: 2 } };
    fixture.componentRef.setInput('actions', [template, endPhase]);
    fixture.detectChanges();
    playButton('c-sha').click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-targets-dialog') as HTMLElement;
    expect(dialog.textContent).toContain('Choose up to 2 targets for Sha');
    const seatButton = (text: string) => [...dialog.querySelectorAll('button')].find((b) => b.textContent!.trim() === text) as HTMLButtonElement;
    seatButton('Seat 2').click();
    seatButton('Seat 1').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(seatButton('Confirm').disabled).toBe(false);
    seatButton('Confirm').click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(played).toEqual([{ kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha', targets: [{ kind: 'seat', seatId: 'seat-1' }, { kind: 'seat', seatId: 'seat-2' }] }]);
  });
});

