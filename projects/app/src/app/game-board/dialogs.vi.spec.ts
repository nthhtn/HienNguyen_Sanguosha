import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { Action, CardInstance, ChooseGeneralsAction, ContentRegistry, EngineEvent, GeneralDefinition, GeneralOwner, Kingdom, Seat } from 'engine';
import { I18n } from '../i18n/i18n.service';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { ArrangeDialog } from './arrange-dialog';
import { AskDialog } from './ask-dialog';
import { AUTO_CLOSE_SECONDS, CompeteDialog } from './compete-dialog';
import { CompeteResult, competeResults } from './compete-result';
import { DiscardDialog } from './discard-dialog';
import { GeneralSelection } from './general-selection';
import { ResponseDialog, ResponseDialogData } from './response-dialog';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

// A fresh testing module with Vietnamese on, the dialog data provided, and the component inputs set.
async function mount<T>(component: Type<T>, data?: unknown, inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
  await TestBed.inject(I18n).setLocale('vi');
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const shan: CardInstance = { instanceId: 'shan-1', definitionId: 'shan', suit: 'heart', rank: 2 };
const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'w1', cardInstanceId: 'shan-1' };
const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'w1' };
const description = {
  source: 'Seat 1 played Sha against Hing', latest: null, prompt: 'Your turn to respond to Sha', outcome: 'You lose 1 HP (1 damage from Seat 1)', outcomeForce: 'Shu' as const,
};

describe('ResponseDialog in Vietnamese', () => {
  const data = (cards: ResponseDialogData['cards'], skills: ResponseDialogData['skills'] = []): ResponseDialogData => ({ description, cards, skills, noResponse: pass });

  it('the title, the section headings, the options and the confirm button', async () => {
    const { fixture, el } = await mount(ResponseDialog, data([{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }]));
    expect(text(el.querySelector('h2'))).toBe('Cần phản hồi');
    expect([...el.querySelectorAll('.options h3')].map(text)).toEqual(['Kỹ năng', 'Bài']);
    expect(el.querySelector('.options')!.getAttribute('aria-label')).toBe('Chọn cách phản hồi');
    expect(text(el.querySelector('.empty'))).toBe('Không có kỹ năng nào có thể phản hồi');
    expect(text(el.querySelector('.no-response'))).toContain('Không phản hồi');
    expect(text(el.querySelector('.no-response'))).toContain('— You lose 1 HP (1 damage from Seat 1)');
    expect(text(el.querySelector('button.confirm'))).toBe('Phản hồi bằng Shan');
    (el.querySelector('.no-response input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(text(el.querySelector('button.confirm'))).toBe('Không phản hồi');
  });

  it('with nothing to answer with, both lists are empty and the button says No Response', async () => {
    const { el } = await mount(ResponseDialog, data([]));
    expect([...el.querySelectorAll('.empty')].map(text)).toEqual(['Không có kỹ năng nào có thể phản hồi', 'Không có lá bài nào có thể phản hồi']);
    expect(text(el.querySelector('button.confirm'))).toBe('Không phản hồi');
  });

  it('a skill answer confirms with its own label', async () => {
    const convert: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' }, targets: [] };
    const { el } = await mount(ResponseDialog, data([], [{ id: 'convert-0', action: convert, label: 'Dùng 2 lá bài làm Sha' }]));
    expect(text(el.querySelector('button.confirm'))).toBe('Dùng 2 lá bài làm Sha');
  });

  it('cardLabel names a card, and a hidden card in the translator’s language', () => {
    expect(ResponseDialog.cardLabel(shan)).toBe('Shan (2 ♥)');
    const hidden: CardInstance = { instanceId: 'h', definitionId: 'hidden', suit: 'spade', rank: 1 };
    expect(ResponseDialog.cardLabel(hidden)).toBe('Hidden Card (A ♠)');
    expect(ResponseDialog.cardLabel(hidden, makeTranslator(vi, 'vi'))).toBe('Lá bài ẩn (A ♠)');
  });
});

describe('AskDialog, ArrangeDialog and DiscardDialog in Vietnamese', () => {
  it('Ask: the decline button', async () => {
    const use: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'use' };
    const decline: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'decline' };
    const { el } = await mount(AskDialog, { description: { title: 'Axe', prompt: 'Dùng Axe?', hint: null, card: null, generalId: null, useLabel: 'Dùng', use, decline } });
    expect(text(el.querySelector('button.decline'))).toBe('Không');
    expect(text(el.querySelector('button.use'))).toBe('Dùng');
  });

  it('Arrange: the place buttons, the aria labels and Confirm', async () => {
    const cards: CardInstance[] = [{ instanceId: 't1', definitionId: 'peach', suit: 'heart', rank: 3 }, { instanceId: 't2', definitionId: 'duel', suit: 'spade', rank: 1 }];
    const template: Extract<Action, { kind: 'ArrangeCardsAction' }> = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const { el } = await mount(ArrangeDialog, { description: { title: 'Astrology', prompt: 'Đặt…', cards, template } });
    const first = el.querySelector('[data-card-id="t1"]') as HTMLElement;
    expect(first.querySelector('.place')!.getAttribute('aria-label')).toBe('Đặt 3 ♥ ở đâu');
    expect(text(first.querySelector('button.top'))).toBe('Đầu chồng');
    expect(text(first.querySelector('button.bottom'))).toBe('Đáy chồng');
    expect(first.querySelector('button.right')!.getAttribute('aria-label')).toBe('Dời 3 ♥ sang phải');
    expect((el.querySelector('[data-card-id="t2"] button.left') as HTMLElement).getAttribute('aria-label')).toBe('Dời A ♠ sang trái');
    expect(text(el.querySelector('button.confirm'))).toBe('Xác nhận');
  });

  it('Discard: the title for one and several, the hint and the button', async () => {
    const hand: CardInstance[] = [{ instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 }, { instanceId: 'c2', definitionId: 'shan', suit: 'heart', rank: 2 }];
    const two = await mount(DiscardDialog, { cards: hand, count: 2 });
    expect(text(two.el.querySelector('h2'))).toBe('Bỏ 2 lá bài');
    expect(text(two.el.querySelector('.hint'))).toBe('Bài trên tay của bạn vượt giới hạn. Chọn 2 lá để bỏ · đã chọn 0/2');
    expect(text(two.el.querySelector('button.discard'))).toContain('Bỏ bài');
    const one = await mount(DiscardDialog, { cards: hand, count: 1 });
    expect(text(one.el.querySelector('h2'))).toBe('Bỏ 1 lá bài');
  });
});

describe('CompeteDialog and competeResults in Vietnamese', () => {
  const nine: CardInstance = { instanceId: 'c9', definitionId: 'sha', suit: 'spade', rank: 9 };
  const seven: CardInstance = { instanceId: 'c7', definitionId: 'shan', suit: 'heart', rank: 7 };
  const result = (over: Partial<CompeteResult> = {}): CompeteResult => ({
    id: 'compete-3', abilityId: 'heavens-justice', abilityName: "Heaven's Justice", skillText: null,
    generalId: 'taishi-ci', generalName: 'Taishi Ci', force: 'Wu',
    user: { seatId: 'seat-0', name: 'Hing', generalId: 'taishi-ci', card: nine },
    target: { seatId: 'seat-1', name: 'Seat 1', generalId: null, card: seven },
    won: true, tie: false, winnerName: 'Hing', outcome: 'Hing thắng',
    ...over,
  });

  it('the title, the winner badge, the versus mark, the result and the outcome label', async () => {
    const { el } = await mount(CompeteDialog, result());
    expect(text(el.querySelector('h2'))).toBe('Đấu điểm');
    expect(el.querySelector('.versus')!.getAttribute('aria-label')).toBe('Các người chơi đấu điểm');
    expect(text(el.querySelector('.badge'))).toContain('Thắng');
    expect(text(el.querySelector('.vs'))).toBe('vs');
    expect(text(el.querySelector('.result'))).toBe('9 ♠ so với 7 ♥, Hing thắng');
    expect(text(el.querySelector('.outcome .label'))).toBe('Kết quả');
    expect(text(el.querySelector('button.continue'))).toBe('Tiếp tục');
    expect(el.querySelector('.timer')!.getAttribute('aria-label')).toBe(`Còn ${AUTO_CLOSE_SECONDS} giây`);
  });

  it('a tie counts as a loss for the challenger', async () => {
    const { el } = await mount(CompeteDialog, result({ won: false, tie: true, winnerName: 'Seat 1' }));
    expect(text(el.querySelector('.result'))).toBe('Hòa: 9 ♠ so với 7 ♥. Seat 1 thắng, vì hòa tính là thua đối với Hing');
  });

  const seat = (id: string, index: number, kingdom: Seat['kingdom'], main: string): Seat => ({
    id, index, kingdom, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: main, revealed: true }, deputy: { generalDefinitionId: 'cao-cao', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const owner: GeneralOwner = { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'heavens-justice' };
  const log: EngineEvent[] = [
    { kind: 'CardShownEvent', seatId: 'seat-0', card: nine, abilityId: 'heavens-justice' },
    { kind: 'CardShownEvent', seatId: 'seat-1', card: seven, abilityId: 'heavens-justice' },
    { kind: 'AbilityUsedEvent', owner, abilityId: 'heavens-justice', outcome: 'compete-won', targetSeatId: 'seat-1' },
  ];

  it('competeResults names a nameless seat, a hidden source General and the outcome in Vietnamese', () => {
    const tr = makeTranslator(vi, 'vi');
    const [shown] = competeResults(log, 0, [seat('seat-0', 0, 'Wu', 'taishi-ci'), seat('seat-1', 1, 'Shu', 'guan-yu')], [], tr);
    expect(shown).toMatchObject({
      winnerName: 'Người chơi 0',
      generalName: 'Taishi Ci',
      user: { name: 'Người chơi 0' },
      target: { name: 'Người chơi 1' },
      outcome: 'Người chơi 0 có thể đánh thêm một Sát trong lượt này, ở mọi khoảng cách, thêm một mục tiêu',
    });
    const [hidden] = competeResults(log, 0, [seat('seat-0', 0, 'Wu', 'hidden'), seat('seat-1', 1, 'Shu', 'guan-yu')], [], tr);
    expect(hidden.generalName).toBe('Tướng ẩn');
    const [english] = competeResults(log, 0, [seat('seat-0', 0, 'Wu', 'hidden'), seat('seat-1', 1, 'Shu', 'guan-yu')], []);
    expect(english).toMatchObject({ generalName: 'Hidden General', winnerName: 'Seat 0', outcome: 'Seat 0 can play one more Sha this turn, at any distance, with one more target' });
  });
});

describe('GeneralSelection in Vietnamese', () => {
  const general = (id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] => [id, { id, kingdom, maxHp, skills: [] }];
  const registry: ContentRegistry = { cards: new Map(), generals: new Map([general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('s1', 'Shu', 4)]) };
  const pair = (mainId: string, deputyId: string): ChooseGeneralsAction => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
  const inputs = (seatName = '') => ({ candidates: ['w1', 'w2', 's1'], actions: [pair('w1', 'w2'), pair('w2', 'w1')], registry, seatName });
  const card = (el: HTMLElement, id: string) => el.querySelector(`[data-general-id="${id}"]`) as HTMLElement;

  it('the title with and without a name, the hint, the kingdom tag and the HP', async () => {
    const named = await mount(GeneralSelection, undefined, inputs('Hing'));
    expect(text(named.el.querySelector('h2'))).toBe('Hing, hãy chọn Tướng của bạn');
    expect(text(named.el.querySelector('.hint'))).toBe('Chọn hai Tướng cùng thế lực. Lựa chọn đầu tiên là Chủ tướng của bạn.');
    expect(text(card(named.el, 'w1').querySelector('.kingdom-tag'))).toBe('Ngụy');
    expect(text(card(named.el, 'w1').querySelector('.hp-label'))).toBe('Sinh lực 4');
    expect(card(named.el, 'w1').querySelector('.hearts')!.getAttribute('aria-label')).toBe('Sinh lực 4');
    const anonymous = await mount(GeneralSelection, undefined, inputs());
    expect(text(anonymous.el.querySelector('h2'))).toBe('Hãy chọn Tướng của bạn');
  });

  it('the role chips, the slot labels, the empty slot, the swap button, the summary and Confirm', async () => {
    const { fixture, el } = await mount(GeneralSelection, undefined, inputs());
    expect(text(el.querySelector('.slot.main .slot-name'))).toBe('Chọn một Tướng');
    card(el, 'w1').click();
    fixture.detectChanges();
    card(el, 'w2').click();
    fixture.detectChanges();
    expect(text(card(el, 'w1').querySelector('.role-chip'))).toBe('Chủ tướng');
    expect(text(card(el, 'w2').querySelector('.role-chip'))).toBe('Phó tướng');
    expect(card(el, 'w2').querySelector('.role-chip')!.classList).toContain('deputy');
    expect(text(el.querySelector('.slot.main .slot-label'))).toBe('Chủ tướng');
    expect(text(el.querySelector('.slot.deputy .slot-label'))).toBe('Phó tướng');
    expect(el.querySelector('button.swap')!.getAttribute('aria-label')).toBe('Đổi Chủ tướng và Phó tướng');
    expect(text(el.querySelector('.summary'))).toContain('Thế lực: Ngụy · Tổng Sinh lực: ');
    expect(text(el.querySelector('button.confirm'))).toContain('Xác nhận');
  });

  it('the tooltip reasons, and a language switch that updates computed text', async () => {
    const { fixture, el } = await mount(GeneralSelection, undefined, inputs());
    const tooltip = (id: string) => fixture.debugElement.query(By.css(`[data-general-id="${id}"]`)).injector.get(MatTooltip).message;
    expect(tooltip('s1')).toBe('Không có ứng viên nào khác cùng thế lực');
    card(el, 'w1').click();
    fixture.detectChanges();
    expect(tooltip('s1')).toBe('Phải cùng thế lực với lựa chọn đầu tiên');
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(tooltip('s1')).toBe('Must share a kingdom with your first pick');
    expect(text(el.querySelector('.slot.deputy .slot-name'))).toBe('Pick a General');
    expect(text(card(el, 'w1').querySelector('.role-chip'))).toBe('Main');
  });
});
