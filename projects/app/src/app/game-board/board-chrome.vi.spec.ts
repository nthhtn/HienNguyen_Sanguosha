import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CardInstance, CardZone, EngineEvent, GameResult, GameState, Seat } from 'engine';
import { I18n } from '../i18n/i18n.service';
import { ActionHistoryEntry } from './action-history';
import { ActionHistoryPanel } from './action-history-panel';
import { DiscardPile } from './discard-pile';
import { DiscardHistoryEntry } from './discard-history';
import { GameBoard } from './game-board';
import { GameOver } from './game-over';
import { PhaseIndicator } from './phase-indicator';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { RoundTable } from './round-table';

const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;
const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ').trim();

beforeEach(async () => {
  localStorage.clear();
  await TestBed.configureTestingModule({ imports: [GameBoard], providers: [provideRouter([{ path: 'setup', children: [] }])] }).compileComponents();
  await TestBed.inject(I18n).setLocale('vi');
});
afterEach(() => {
  localStorage.clear();
  overlay()?.replaceChildren();
});

const seat = (id: string, index: number, eliminated = false): Seat => ({
  id, index, kingdom: 'Wei', eliminated,
  generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
  combinedHp: 4, maxCombinedHp: 4,
  hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
});
const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 }));
function state(phase: GameState['phase'], handSize = 0, log: EngineEvent[] = []): GameState {
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: cards(9) },
    { id: 'discardPile', kind: 'discardPile', cards: [] },
    ...[0, 1, 2].flatMap((i) => [{ id: `seat-${i}:hand`, kind: 'hand' as const, ownerSeatId: `seat-${i}`, cards: i === 0 ? cards(handSize) : [] }]),
  ];
  return {
    seats: [seat('seat-0', 0), seat('seat-1', 1), seat('seat-2', 2, true)],
    players: [], turn: { turnNumber: 2, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase,
    zones, pendingResponse: null, log, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('GameBoard in Vietnamese', () => {
  it('the empty board offers a new game', () => {
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Chưa có ván nào đang chơi.');
    expect(text(el.querySelector('a[href="/setup"]') as HTMLElement)).toBe('Bắt đầu ván mới');
  });
});

describe('PhaseIndicator in Vietnamese', () => {
  const render = (s: GameState, viewerSeatId: string | null) => {
    const fixture = TestBed.createComponent(PhaseIndicator);
    fixture.componentRef.setInput('state', s);
    fixture.componentRef.setInput('viewerSeatId', viewerSeatId);
    fixture.detectChanges();
    return { fixture, bar: text(fixture.nativeElement as HTMLElement) };
  };

  it('names the turn, the owner (a nameless seat in Vietnamese), you, the phase and the draw pile', () => {
    expect(render(state('Play'), 'seat-0').bar).toBe('Lượt 2 Người chơi 0 (bạn) – Giai đoạn ra bài Chồng bài rút 9');
    expect(render(state('Judgment'), 'seat-1').bar).toBe('Lượt 2 Người chơi 0 – Giai đoạn phán xét Chồng bài rút 9');
  });

  it('says how many cards are left to discard', () => {
    expect(render(state('Discard', 6), 'seat-0').bar).toContain('– bỏ thêm 2 lá bài');
  });

  it('follows a language switch without being re-created', async () => {
    const { fixture } = render(state('Play'), 'seat-0');
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Turn 2 Seat 0 (you) – Play Phase Draw Pile 9');
    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Lượt 2 Người chơi 0 (bạn) – Giai đoạn ra bài Chồng bài rút 9');
  });
});

describe('GameOver in Vietnamese', () => {
  const render = (result: GameResult, players: { id: string; seatId: string; kind: 'human' | 'bot'; name: string }[] = []) => {
    const fixture = TestBed.createComponent(GameOver);
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('players', players);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('a winning kingdom, with the winners and losers and the New Game button', () => {
    const el = render({ endedAt: 12, winningKingdom: 'Wei', winningSeatIds: ['seat-0', 'seat-2'], losingSeatIds: ['seat-1'] });
    expect(text(el.querySelector('h2') as HTMLElement)).toBe('Hết ván');
    expect(text(el.querySelector('.headline') as HTMLElement)).toBe('Ngụy thắng!');
    expect(text(el)).toContain('Người thắng: Người chơi 0, Người chơi 2');
    expect(text(el)).toContain('Người thua: Người chơi 1');
    expect(text(el.querySelector('button') as HTMLElement)).toContain('Ván mới');
  });

  it('winners by seat, a draw, and an empty list', () => {
    expect(text(render({ endedAt: 1, winningSeatIds: ['seat-3'], losingSeatIds: [] }, [{ id: 'p', seatId: 'seat-3', kind: 'human', name: 'Hing' }]).querySelector('.headline') as HTMLElement)).toBe('Hing thắng!');
    const draw = render({ endedAt: 1, winningSeatIds: [], losingSeatIds: [] });
    expect(text(draw.querySelector('.headline') as HTMLElement)).toBe('Hòa — không còn ai sống sót.');
    expect(text(draw)).toContain('Người thắng: Không có');
    expect(text(draw)).toContain('Người thua: Không có');
  });
});

describe('RoundTable in Vietnamese', () => {
  const render = (s: GameState, thinkingSeatId: string | null = null) => {
    const fixture = TestBed.createComponent(RoundTable);
    fixture.componentRef.setInput('state', s);
    fixture.componentRef.setInput('viewerSeatId', 'seat-1');
    fixture.componentRef.setInput('thinkingSeatId', thinkingSeatId);
    fixture.componentRef.setInput('botSeatIds', []);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('the latest steps, the thinking line and the aria labels are Vietnamese', () => {
    const log: EngineEvent[] = [
      { kind: 'GeneralsChosenEvent', seatId: 'seat-0' },
      { kind: 'SeatEliminatedEvent', seatId: 'seat-2' },
    ];
    const el = render(state('Play', 0, log), 'seat-1');
    const steps = [...el.querySelectorAll('.sequence .text')].map((e) => text(e as HTMLElement));
    expect(steps).toContain('Người chơi 2 bị loại');
    expect(steps).toContain('Người chơi 0 đã chọn Tướng của mình');
    expect(el.querySelector('.sequence')!.getAttribute('aria-label')).toBe('Chuỗi hành động');
    expect(text(el.querySelector('.centre .thinking') as HTMLElement)).toBe('Người chơi 1 đang suy nghĩ…');
  });
});

describe('the action history and discard pile in Vietnamese', () => {
  const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };

  it('the panel label, its empty state, and the dialog with a turn marker', async () => {
    const history: ActionHistoryEntry[] = [
      { kind: 'action', text: 'Người chơi 1 rút 2 lá bài', card: null },
      { kind: 'turn', turnNumber: 2, seatName: 'Người chơi 0' },
    ];
    const fixture = TestBed.createComponent(ActionHistoryPanel);
    fixture.componentRef.setInput('history', history);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('.label') as HTMLElement)).toBe('Lịch sử hành động');
    expect(el.querySelector('button.latest')!.getAttribute('aria-label')).toBe('Xem lịch sử hành động');
    (el.querySelector('button.latest') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-action-history-dialog') as HTMLElement;
    expect(text(dialog.querySelector('h2') as HTMLElement)).toBe('Lịch sử hành động');
    expect(text(dialog.querySelector('.turn') as HTMLElement)).toContain('Lượt 2 · Người chơi 0');
    expect(text(dialog.querySelector('button') as HTMLElement)).toBe('Đóng');

    const empty = TestBed.createComponent(ActionHistoryPanel);
    empty.componentRef.setInput('history', []);
    empty.detectChanges();
    expect(text(empty.nativeElement as HTMLElement)).toContain('Chưa có gì');
  });

  it('the discard pile: label, count aria, empty states and the history dialog', async () => {
    const full = TestBed.createComponent(DiscardPile);
    full.componentRef.setInput('cards', [sha, { ...sha, instanceId: 'sha-2' }]);
    full.componentRef.setInput('history', [{ kind: 'card', card: sha, inPile: true }, { kind: 'reshuffle', cardCount: 1 }, { kind: 'reshuffle', cardCount: 3 }] as DiscardHistoryEntry[]);
    full.detectChanges();
    const el = full.nativeElement as HTMLElement;
    expect(text(el.querySelector('.label') as HTMLElement)).toBe('Chồng bài bỏ');
    expect(el.querySelector('button.pile')!.getAttribute('aria-label')).toBe('Chồng bài bỏ, 2 lá. Xem lịch sử bỏ bài');
    (el.querySelector('button.pile') as HTMLButtonElement).click();
    full.detectChanges();
    await full.whenStable();
    const dialog = overlay().querySelector('app-discard-history-dialog') as HTMLElement;
    expect(text(dialog.querySelector('h2') as HTMLElement)).toBe('Lịch sử bỏ bài');
    expect(text(dialog.querySelector('.summary') as HTMLElement)).toBe('1 lá trong chồng · 1 lá đã bỏ trong ván này');
    expect([...dialog.querySelectorAll('.reshuffle')].map((e) => text(e as HTMLElement))).toEqual([
      expect.stringContaining('1 lá bài được xáo vào chồng bài rút'),
      expect.stringContaining('3 lá bài được xáo vào chồng bài rút'),
    ]);

    const none = TestBed.createComponent(DiscardPile);
    none.componentRef.setInput('cards', []);
    none.componentRef.setInput('history', []);
    none.detectChanges();
    const noneEl = none.nativeElement as HTMLElement;
    expect(text(noneEl.querySelector('.top-name') as HTMLElement)).toBe('Trống');
    expect(noneEl.querySelector('.pile')!.getAttribute('aria-label')).toBe('Chồng bài bỏ, trống');

    const reshuffled = TestBed.createComponent(DiscardPile);
    reshuffled.componentRef.setInput('cards', []);
    reshuffled.componentRef.setInput('history', [{ kind: 'reshuffle', cardCount: 2 }] as DiscardHistoryEntry[]);
    reshuffled.detectChanges();
    expect((reshuffled.nativeElement as HTMLElement).querySelector('button.pile')!.getAttribute('aria-label')).toBe('Chồng bài bỏ, trống. Xem lịch sử bỏ bài');
  });
});

describe('RevealGateOverlay in Vietnamese', () => {
  it('asks to pass the device and shows the tap button', () => {
    const fixture = TestBed.createComponent(RevealGateOverlay);
    fixture.componentRef.setInput('name', 'Hing');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('h2') as HTMLElement)).toBe('Chuyển thiết bị cho Hing');
    expect(text(el.querySelector('p') as HTMLElement)).toBe('Mọi người khác hãy quay đi — màn hình tiếp theo hiện bài riêng của Hing.');
    expect(text(el.querySelector('button') as HTMLElement)).toContain('Chạm để lật');
  });
});
