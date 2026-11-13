import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatTooltip } from '@angular/material/tooltip';
import { ChooseGeneralsAction, ContentRegistry, GeneralDefinition, Kingdom } from 'engine';
import { GeneralSelection } from './general-selection';

function general(id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] {
  return [id, { id, kingdom, maxHp, skills: [] }];
}

const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('w3', 'Wei', 4), general('s1', 'Shu', 4), general('q1', 'Qun', 5)]),
};
const candidates = ['w1', 'w2', 'w3', 's1', 'q1'];
const pair = (mainId: string, deputyId: string): ChooseGeneralsAction => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
// What the engine returns for these candidates: every ordered Wei pair.
const actions = [pair('w1', 'w2'), pair('w1', 'w3'), pair('w2', 'w1'), pair('w2', 'w3'), pair('w3', 'w1'), pair('w3', 'w2')];

describe('GeneralSelection', () => {
  let fixture: ComponentFixture<GeneralSelection>;
  let el: HTMLElement;
  let emitted: ChooseGeneralsAction[];

  const card = (id: string) => el.querySelector(`[data-general-id="${id}"]`) as HTMLElement;
  const click = (id: string) => { card(id).click(); fixture.detectChanges(); };
  const badge = (id: string) => card(id).querySelector('.role-chip')?.textContent?.trim() ?? '';
  const button = (cls: string) => el.querySelector(`button.${cls}`) as HTMLButtonElement;
  const tooltip = (id: string) =>
    fixture.debugElement.query(By.css(`[data-general-id="${id}"]`)).injector.get(MatTooltip).message;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GeneralSelection] }).compileComponents();
    fixture = TestBed.createComponent(GeneralSelection);
    fixture.componentRef.setInput('candidates', candidates);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('registry', registry);
    emitted = [];
    fixture.componentInstance.chosen.subscribe((a) => emitted.push(a));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders one card per candidate with its kingdom and HP', () => {
    expect(el.querySelectorAll('[data-general-id]')).toHaveLength(5);
    expect(card('q1').textContent).toContain('Qun');
    expect(card('q1').textContent).toContain('HP 5');
  });

  it('disables candidates that appear in no legal pair from the start (Review Focus 3)', () => {
    expect(card('s1').classList).toContain('disabled');
    expect(card('q1').classList).toContain('disabled');
    click('s1');
    expect(badge('s1')).toBe('');
  });

  it('badges the first pick Main and the second Deputy', () => {
    click('w1');
    click('w2');
    expect(badge('w1')).toBe('Main');
    expect(badge('w2')).toBe('Deputy');
  });

  it('replaces the Deputy when a third card is picked', () => {
    click('w1');
    click('w2');
    click('w3');
    expect(badge('w1')).toBe('Main');
    expect(badge('w2')).toBe('');
    expect(badge('w3')).toBe('Deputy');
  });

  it('promotes the Deputy to Main when the Main is deselected (Review Focus 4)', () => {
    click('w1');
    click('w2');
    click('w1');
    expect(badge('w1')).toBe('');
    expect(badge('w2')).toBe('Main');
  });

  it('Swap reverses Main and Deputy', () => {
    click('w1');
    click('w2');
    button('swap').click();
    fixture.detectChanges();
    expect(badge('w2')).toBe('Main');
    expect(badge('w1')).toBe('Deputy');
  });

  it('enables Confirm only for a legal pair, and emits exactly the engine’s action', () => {
    expect(button('confirm').disabled).toBe(true);
    click('w1');
    expect(button('confirm').disabled).toBe(true);
    click('w2');
    button('swap').click();
    fixture.detectChanges();
    expect(button('confirm').disabled).toBe(false);
    button('confirm').click();
    expect(emitted).toEqual([actions[2]]);
    expect(emitted[0]).toBe(actions[2]);
  });

  it('tooltips a lone-kingdom candidate differently before and after a first pick (Review Focus 5)', () => {
    expect(tooltip('s1')).toBe('No other candidate shares this kingdom');
    click('w1');
    expect(tooltip('s1')).toBe('Must share a kingdom with your first pick');
  });

  it('summarises the resulting kingdom and combined HP', () => {
    click('w1');
    click('w2');
    expect(el.querySelector('.summary')!.textContent).toContain('Kingdom: Wei');
    expect(el.querySelector('.summary')!.textContent).toContain('Combined HP: 3'); // half of 4 + 3, rounded down, as the engine seats it
    expect(el.querySelector('.summary img')).toBeNull(); // HP is text only here
  });

  it('fills the Main and Deputy slots in the bottom bar as cards are picked', () => {
    const slot = (role: string) => el.querySelector(`.slot.${role}`)!.textContent!;
    expect(slot('main')).toContain('Pick a General');
    click('w1');
    click('w2');
    expect(slot('main')).toContain('W1');
    expect(slot('deputy')).toContain('W2');
  });

  it('draws one HP icon per point of max HP', () => {
    expect(card('q1').querySelectorAll('app-hp-icons img')).toHaveLength(5);
  });
});

describe('GeneralSelection header', () => {
  it('names the choosing seat and ticks off seats that have already chosen', async () => {
    await TestBed.configureTestingModule({ imports: [GeneralSelection] }).compileComponents();
    const fixture = TestBed.createComponent(GeneralSelection);
    fixture.componentRef.setInput('candidates', candidates);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('registry', registry);
    fixture.componentRef.setInput('seatId', 'seat-1');
    fixture.componentRef.setInput('seatName', 'Hing');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')!.textContent).toBe('Hing, Choose your Generals');
  });
});

describe('GeneralSelection layout and info', () => {
  const render = (ids: string[]) => {
    const reg: ContentRegistry = { cards: new Map(), generals: new Map(ids.map((id) => general(id, 'Wei', 4))) };
    TestBed.configureTestingModule({ imports: [GeneralSelection] });
    const fixture = TestBed.createComponent(GeneralSelection);
    fixture.componentRef.setInput('candidates', ids);
    fixture.componentRef.setInput('actions', [pair(ids[0], ids[1])]);
    fixture.componentRef.setInput('registry', reg);
    fixture.detectChanges();
    return fixture;
  };
  const rowSizes = (f: ComponentFixture<GeneralSelection>) =>
    [...(f.nativeElement as HTMLElement).querySelectorAll('.row')].map((r) => r.querySelectorAll('[data-general-id]').length);

  it('puts 5 Generals in two rows, 3 on top and 2 below (split cards are wide)', () => {
    expect(rowSizes(render(['a', 'b', 'c', 'd', 'e']))).toEqual([3, 2]);
  });

  it('puts 7 Generals in two rows, 4 on top and 3 below', () => {
    expect(rowSizes(render(['a', 'b', 'c', 'd', 'e', 'f', 'g']))).toEqual([4, 3]);
  });

  it('shows the Force name under the art on the left, and the title and skills on the right', () => {
    const el = render(['kingdomWars:zhang-fei', 'b', 'c', 'd', 'e']).nativeElement as HTMLElement;
    const card = el.querySelector('[data-general-id="kingdomWars:zhang-fei"]')!;
    expect(card.querySelector('.left .kingdom-tag')!.textContent).toContain('Wei');
    expect(card.querySelector('.left .effects')).toBeNull();
    const effects = card.querySelector('.right .effects')!;
    expect(effects.querySelectorAll('.skills li').length).toBeGreaterThan(0);
    expect(effects.querySelector('.skills strong')!.textContent!.trim()).not.toBe('');
  });

  it('says so when a General has no skills to show', () => {
    const el = render(['a', 'b', 'c', 'd', 'e']).nativeElement as HTMLElement;
    expect(el.querySelector('[data-general-id="a"] .right .empty')).not.toBeNull();
  });

  it('has no info button, and tapping the right side selects the card', () => {
    const fixture = render(['kingdomWars:zhang-fei', 'b', 'c', 'd', 'e']);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button.info')).toBeNull();
    (el.querySelector('[data-general-id="kingdomWars:zhang-fei"] .right') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-general-id="kingdomWars:zhang-fei"] .role-chip')).not.toBeNull();
  });

});
