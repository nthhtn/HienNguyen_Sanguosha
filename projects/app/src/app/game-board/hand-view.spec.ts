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

  const tooltipFor = (instanceId: string) =>
    fixture.debugElement.query(By.css(`[data-card-id="${instanceId}"] .play-wrap`)).injector.get(MatTooltip);

  it('renders every hand card in one row, each with Play and Info buttons', () => {
    const row = el.querySelector('.hand-row')!;
    expect(row.querySelectorAll('.hand-card')).toHaveLength(3);
    for (const c of hand) {
      expect(playButton(c.instanceId).textContent).toContain('Play');
      expect(infoButton(c.instanceId).textContent).toContain('Info');
    }
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
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Play Sha targeting seat-1', 'Play Sha targeting seat-2']);
    expect(played).toEqual([]);
    items[1].click();
    expect(played).toEqual([shaAtSeat2]);
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

  it('shows Discard, and emits the discard, for cards the engine says to discard', () => {
    const discardSha: Action = { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'c-sha' };
    fixture.componentRef.setInput('actions', [discardSha]);
    fixture.componentRef.setInput('state', { ...state(), phase: 'Discard' });
    fixture.detectChanges();
    expect(playButton('c-sha').textContent).toContain('Discard');
    expect(playButton('c-sha').classList).toContain('discard');
    playButton('c-sha').click();
    expect(played).toEqual([discardSha]);
  });

  it('explains a disabled Play button', () => {
    expect(playButton('c-peach').disabled).toBe(true);
    expect(tooltipFor('c-peach').message).toBe("Can't be played now");
    expect(tooltipFor('c-peach').disabled).toBe(false);
    expect(tooltipFor('c-bow').disabled).toBe(true);

    fixture.componentRef.setInput('actions', []);
    fixture.componentRef.setInput('state', { ...state(), phase: 'Discard' });
    fixture.detectChanges();
    expect(tooltipFor('c-sha').message).toBe('Only in your Play phase');
  });
});
