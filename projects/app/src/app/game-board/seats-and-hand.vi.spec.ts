import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance, ContentRegistry, GameState, Seat } from 'engine';
import { I18n } from '../i18n/i18n.service';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { ActionList } from './action-list';
import { avatarSkills } from './avatar-skills';
import { CardInfoDialog } from './card-info-dialog';
import { GeneralInfoDialog } from './general-info-dialog';
import { HandView } from './hand-view';
import { PlayingCard } from './playing-card';
import { SeatAvatar } from './seat-avatar';
import { SeatTile } from './seat-tile';
import { TargetLabel } from './target-label';
import { TargetsDialog, TargetsDialogData } from './targets-dialog';

const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;
const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

const closed: (string[] | undefined)[] = [];
beforeEach(async () => {
  localStorage.clear();
  closed.length = 0;
  TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: { close: (ids?: string[]) => closed.push(ids) } }] });
  await TestBed.inject(I18n).setLocale('vi');
});
afterEach(() => {
  localStorage.clear();
  overlay()?.replaceChildren();
});

const makeSeat = (overrides: Partial<Seat> = {}): Seat => ({
  id: 'seat-1', index: 1, kingdom: 'Wei',
  generals: { main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
  combinedHp: 3, maxCombinedHp: 4,
  hand: { zoneId: 'hand-1' }, equipped: { zoneId: 'equip-1' }, judgment: { zoneId: 'judgment-1' },
  eliminated: false,
  ...overrides,
});
const crossbow: CardInstance = { instanceId: 'bow', definitionId: 'crossbow', suit: 'diamond', rank: 1 };
const capture: CardInstance = { instanceId: 'cap', definitionId: 'capture', suit: 'spade', rank: 6 };
const sha: CardInstance = { instanceId: 'c-sha', definitionId: 'sha', suit: 'spade', rank: 7 };

describe('SeatTile in Vietnamese', () => {
  const render = (seat: Seat, inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(SeatTile);
    fixture.componentRef.setInput('seat', seat);
    fixture.componentRef.setInput('name', 'Seat 1');
    fixture.componentRef.setInput('handCount', 4);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('sections, tags, stats and the four empty equipment slots', () => {
    const { el } = render(makeSeat(), { isViewer: true, isBot: true });
    expect(el.querySelector('section.general')!.getAttribute('aria-label')).toBe('Tướng');
    expect(text(el.querySelector('.you'))).toBe('(bạn)');
    expect(el.querySelector('.bot-icon')!.getAttribute('aria-label')).toBe('Người chơi máy');
    expect(text(el.querySelector('.kingdom'))).toBe('Ngụy');
    expect(text(el.querySelector('.stats'))).toContain('Sinh lực 3/4');
    expect(el.querySelector('.hand-count')!.getAttribute('title')).toBe('Bài trên tay');
    expect(el.querySelector('.hand-count')!.getAttribute('aria-label')).toBe('Bài trên tay: 4');
    expect(el.querySelector('section.equipment')!.getAttribute('aria-label')).toBe('Trang bị');
    expect(el.querySelector('section.judgment-section')!.getAttribute('aria-label')).toBe('Phán xét');
    expect(el.querySelector('.judgment')!.getAttribute('aria-label')).toBe('Khu phán xét');
    expect(['weapon', 'armor', 'defensiveMount', 'offensiveMount'].map((s) => el.querySelector(`[data-slot="${s}"]`)!.getAttribute('title'))).toEqual([
      'Vũ khí (trống)', 'Giáp (trống)', 'Tọa kỵ thủ +1 (trống)', 'Tọa kỵ công -1 (trống)',
    ]);
    expect(el.querySelector('.slot.empty[title]:not([data-slot])')!.getAttribute('title')).toBe('Khu phán xét (trống)');
  });

  it('a worn card and a judgment card, with and without "counts as"', () => {
    const worn = render(makeSeat(), { equipment: [crossbow] }).el;
    expect(worn.querySelector('[data-slot="weapon"]')!.getAttribute('title')).toBe('Vũ khí: Gia Cát Liên Nỏ');
    expect(worn.querySelector('[data-slot="weapon"] .slot-card')!.getAttribute('aria-label')).toBe('Thông tin: Gia Cát Liên Nỏ');
    const judged = render(makeSeat(), { judgment: [capture], judgmentCountsAs: { cap: 'sha' } }).el;
    expect(judged.querySelector('.judgment .slot')!.getAttribute('title')).toBe('Khu phán xét: Lạc Bất Tư Thục tính là Sát');
    expect(text(judged.querySelector('.counts-as'))).toBe('Tính là Sát');
    expect(render(makeSeat(), { judgment: [capture] }).el.querySelector('.judgment .slot')!.getAttribute('title')).toBe('Khu phán xét: Lạc Bất Tư Thục');
  });

  it('status lines, badges, the under-General piles and a chosen Form', () => {
    expect(text(render(makeSeat({ eliminated: true })).el.querySelector('.status'))).toBe('Bị loại');
    expect(text(render(makeSeat({ combinedHp: 0 })).el.querySelector('.status.dying'))).toBe('Cận kề cái chết…');
    expect(text(render(makeSeat(), { isResponding: true }).el.querySelector('.status'))).toBe('Đang phản hồi…');
    expect(text(render(makeSeat({ generals: null as never })).el.querySelector('.choosing'))).toBe('Đang chọn Tướng…');
    expect(text(render(makeSeat({ faceDown: true })).el.querySelector('.face-down-badge'))).toBe('Úp');
    expect(text(render(makeSeat({ silenced: true })).el.querySelector('.silenced-badge'))).toBe('Mất kỹ năng');
    expect(text(render(makeSeat({ chained: true })).el.querySelector('.chain-badge'))).toBe('Bị xích');
    const piles = render(makeSeat(), { pile: [sha], stash: [{ ...sha, instanceId: 'c-2' }] }).el;
    expect([...piles.querySelectorAll('.pile')].map((p) => p.getAttribute('aria-label'))).toEqual(['Lá bài Sang', 'Điền']);
    const form = { slot: 'main', held: [], chosen: { generalId: 'guan-yu', skillId: 'fighting-saint' } } as never;
    expect(text(render(makeSeat({ forms: form })).el.querySelector('.form-badge'))).toBe('Hóa thân: Quan Vũ (Võ thánh)');
  });

  it('follows a language switch without being re-created, slot titles included', async () => {
    const { fixture, el } = render(makeSeat(), { equipment: [crossbow] });
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(text(el.querySelector('.stats'))).toContain('HP 3/4');
    expect(el.querySelector('[data-slot="armor"]')!.getAttribute('title')).toBe('Armor (empty)');
    expect(el.querySelector('[data-slot="weapon"]')!.getAttribute('title')).toBe('Weapon: Crossbow');
    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(el.querySelector('[data-slot="armor"]')!.getAttribute('title')).toBe('Giáp (trống)');
  });
});

describe('SeatAvatar and the skill buttons in Vietnamese', () => {
  it('a hidden seat, an own face-down General, and a revealed one', () => {
    const render = (generals: { main: { generalDefinitionId: string; revealed: boolean }; deputy: { generalDefinitionId: string; revealed: boolean } }) => {
      const fixture = TestBed.createComponent(SeatAvatar);
      fixture.componentRef.setInput('generals', generals);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };
    const half = (el: HTMLElement, slot: string) => el.querySelector(`.half[data-slot="${slot}"]`) as HTMLButtonElement;
    const hidden = render({ main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } });
    expect(text(half(hidden, 'main').querySelector('.caption'))).toBe('Tướng ẩn');
    expect(half(hidden, 'main').getAttribute('aria-label')).toBe('Tướng ẩn');
    const mixed = render({ main: { generalDefinitionId: 'guan-yu', revealed: false }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } });
    expect(text(half(mixed, 'main').querySelector('.caption'))).toBe('Quan Vũ (ẩn)');
    expect(half(mixed, 'main').getAttribute('aria-label')).toBe('Thông tin: Quan Vũ');
    expect(text(half(mixed, 'deputy').querySelector('.caption'))).toBe('Trương Phi');
  });

  it('a hidden General’s skill button reads "Lật Tướng: …"', () => {
    const active = { canUse: () => true, start: () => [] };
    const registry: ContentRegistry = {
      cards: new Map(),
      generals: new Map([['sun-quan', { id: 'sun-quan', kingdom: 'Wu', maxHp: 4, skills: [{ id: 'reconsider', active }] }]]),
    };
    const generals = (revealed: boolean) => ({ main: { generalDefinitionId: 'sun-quan', revealed }, deputy: { generalDefinitionId: 'hidden', revealed: false } });
    const tr = makeTranslator(vi, 'vi');
    expect(avatarSkills(generals(false), registry, [], [], tr)[0].label).toBe('Lật Tướng: Chế hành');
    expect(avatarSkills(generals(false), registry, [])[0].label).toBe('Reveal: Reconsider');
    expect(avatarSkills(generals(true), registry, [], [], tr)[0].label).toBe('Chế hành');
  });
});

describe('HandView in Vietnamese', () => {
  const hand: CardInstance[] = [
    { instanceId: 'c-sha', definitionId: 'sha', suit: 'spade', rank: 7 },
    { instanceId: 'c-bow', definitionId: 'crossbow', suit: 'diamond', rank: 1 },
    { instanceId: 'c-peach', definitionId: 'peach', suit: 'heart', rank: 12 },
  ];
  const state = (): GameState => ({
    seats: [], players: [], log: [], pendingResponse: null, result: null, generalSelection: null,
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: hand }], rng: { seed: 1, counter: 0 },
  });
  const registry: ContentRegistry = {
    generals: new Map(),
    cards: new Map([['sha', 'Slash'], ['crossbow', 'Crossbow'], ['peach', 'Peach']].map(([id, name]) => [id, { id, name, category: 'basic' as const, play: () => [] }])),
  };
  const at = (card: string, ...seats: string[]): Action => ({ kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: card, targets: seats.map((seatId) => ({ kind: 'seat' as const, seatId })) });

  const render = (cards: CardInstance[], actions: Action[]) => {
    const fixture = TestBed.createComponent(HandView);
    fixture.componentRef.setInput('cards', cards);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('state', state());
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };
  const card = (el: HTMLElement, id: string) => el.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
  const items = () => [...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[];

  it('Play and Info buttons, and the empty hand', () => {
    const { el } = render(hand, [at('c-sha', 'seat-1'), at('c-sha', 'seat-2')]);
    expect(text(card(el, 'c-sha').querySelector('button.play'))).toContain('Đánh bài');
    expect(text(card(el, 'c-sha').querySelector('button.info'))).toContain('Thông tin');
    expect(text(render([], []).el.querySelector('.empty'))).toBe('Không có lá bài nào trên tay');
  });

  it('a menu of targets: each entry is the label then the target', async () => {
    const { fixture, el } = render(hand, [at('c-sha', 'seat-1'), at('c-sha', 'seat-2')]);
    (card(el, 'c-sha').querySelector('button.play') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(items().map((i) => text(i))).toEqual(['Đánh Sát nhắm vào Người chơi 1', 'Đánh Sát nhắm vào Người chơi 2']);
  });

  it('a two-seat play: the first seat, then "Vào" the second', async () => {
    const { fixture, el } = render(hand, [at('c-peach', 'seat-1', 'seat-0'), at('c-peach', 'seat-1', 'seat-2')]);
    (card(el, 'c-peach').querySelector('button.play') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const firsts = items();
    expect(firsts.map((i) => text(i))).toEqual(['Đánh Đào nhắm vào Người chơi 1']);
    firsts[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(items().filter((i) => text(i).startsWith('Vào ')).map((i) => text(i))).toEqual(['Vào Người chơi 0', 'Vào Người chơi 2']);
  });

  it('the card info dialog: category, subtype, range and the missing rules text', async () => {
    const { fixture, el } = render(hand, []);
    (card(el, 'c-bow').querySelector('button.info') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-card-info-dialog') as HTMLElement;
    expect(text(dialog.querySelector('.kind'))).toBe('Trang bị · Vũ khí · Tầm 1');
    expect(text(dialog.querySelector('button'))).toBe('Đóng');
    overlay().replaceChildren();
    (card(el, 'c-sha').querySelector('button.info') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const basic = overlay().querySelector('app-card-info-dialog') as HTMLElement;
    expect(text(basic.querySelector('.kind'))).toBe('Cơ bản');
    expect(text(basic.querySelector('.text'))).toBe('Chưa có nội dung luật.');
  });
});

describe('ActionList, TargetLabel and the playing card in Vietnamese', () => {
  it('an ordinary action reads in Vietnamese, and a conversion offers its targets under "Nhắm vào"', async () => {
    const state: GameState = {
      seats: [], players: [], log: [], pendingResponse: null, result: null, generalSelection: null,
      turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase: 'Play', rng: { seed: 1, counter: 0 },
      zones: [{ id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'sp', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
    };
    const registry: ContentRegistry = {
      cards: new Map([
        ['sha', { id: 'sha', name: 'Slash', category: 'basic' as const, play: () => [] }],
        ['serpent-spear', { id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment' as const, equipSlot: 'weapon' as const, play: () => [], abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' as const }] } }],
      ]),
      generals: new Map(),
    };
    const convert: Action = {
      kind: 'UseConversionAction', seatId: 'seat-0', targets: [{ kind: 'seat', seatId: 'seat-1' }],
      via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' },
    };
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'EndPhaseAction', seatId: 'seat-0' }, convert]);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map((b) => text(b));
    expect(buttons).toEqual(['Kết thúc giai đoạn', 'Dùng 2 lá bài làm Sát']);
    ((fixture.nativeElement as HTMLElement).querySelector('button.conversion') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect([...overlay().querySelectorAll('button[mat-menu-item]')].map((i) => text(i))).toEqual(['Nhắm vào Người chơi 1']);
  });

  it('the target label names a nameless seat and its revealed Generals in Vietnamese', () => {
    const seat = (id: string, kingdom: string, main: string, deputy: string, deputyRevealed: boolean) => ({
      id, kingdom, generals: { main: { generalDefinitionId: main, revealed: true }, deputy: { generalDefinitionId: deputy, revealed: deputyRevealed } },
    });
    const state = { players: [{ seatId: 'seat-2', name: 'Bot' }], seats: [seat('seat-2', 'Wei', 'cao-cao', 'sima-yi', true), seat('seat-3', 'Shu', 'liu-bei', 'hidden', false)] } as unknown as GameState;
    const fixture = TestBed.createComponent(TargetLabel);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('prefix', 'Nhắm vào');
    fixture.componentRef.setInput('targets', [{ kind: 'seat', seatId: 'seat-2' }, { kind: 'seat', seatId: 'seat-3' }]);
    fixture.detectChanges();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Nhắm vào Bot Tào Tháo - Tư Mã Ý, Người chơi 3 Lưu Bị');
  });

  it('the playing card names a hidden card in Vietnamese', () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('card', { instanceId: 'h', definitionId: 'hidden', suit: 'spade', rank: 0 });
    fixture.detectChanges();
    expect(text((fixture.nativeElement as HTMLElement).querySelector('.name'))).toBe('Lá bài ẩn');
  });
});

describe('the Choose Targets and General info dialogs in Vietnamese', () => {
  it('Choose Targets: title, both prompts, seat names and buttons', () => {
    const open = (min: number, max: number) => {
      const data: TargetsDialogData = { title: 'Slash', pick: { eligibleIds: ['seat-0', 'seat-2'], min, max }, state: { players: [{ id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' }] } as unknown as GameState };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: () => undefined } }] });
      return TestBed.inject(I18n).setLocale('vi').then(() => {
        const fixture = TestBed.createComponent(TargetsDialog);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
      });
    };
    return open(1, 2).then(async (el) => {
      expect(text(el.querySelector('h2'))).toBe('Chọn mục tiêu');
      expect(text(el.querySelector('p'))).toBe('Chọn tối đa 2 mục tiêu cho Slash');
      expect([...el.querySelectorAll('.seats button')].map((b) => text(b))).toEqual(['Hing', 'Người chơi 2']);
      expect([...el.querySelectorAll('mat-dialog-actions button')].map((b) => text(b))).toEqual(['Hủy', 'Xác nhận']);
      const exact = await open(2, 2);
      expect(text(exact.querySelector('p'))).toBe('Chọn 2 mục tiêu cho Slash');
    });
  });

  it('General info: an unknown General reads as an empty state, with Đóng', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { generalDefinitionId: 'hidden' } }] });
    return TestBed.inject(I18n).setLocale('vi').then(() => {
      const fixture = TestBed.createComponent(GeneralInfoDialog);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(text(el.querySelector('h2'))).toBe('Tướng ẩn');
      expect(text(el.querySelector('.empty'))).toBe('Không có kỹ năng nào.');
      expect(text(el.querySelector('button'))).toBe('Đóng');
    });
  });
});

describe('CardInfoDialog.nameFor', () => {
  it('names a hidden card in the translator’s language, and keeps English without one', () => {
    expect(CardInfoDialog.nameFor('hidden', undefined)).toBe('Hidden Card');
    expect(CardInfoDialog.nameFor('hidden', undefined, makeTranslator(vi, 'vi'))).toBe('Lá bài ẩn');
    expect(CardInfoDialog.nameFor('sha', undefined, makeTranslator(vi, 'vi'))).toBe('Sát');
  });
});
