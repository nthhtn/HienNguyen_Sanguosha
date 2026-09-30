import { TestBed, ComponentFixture } from '@angular/core/testing';
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
  const badge = (id: string) => card(id).querySelector('.mat-badge-content')?.textContent?.trim() ?? '';
  const button = (cls: string) => el.querySelector(`button.${cls}`) as HTMLButtonElement;

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

  it('summarises the resulting kingdom and combined HP', () => {
    click('w1');
    click('w2');
    expect(el.querySelector('.summary')!.textContent).toContain('Kingdom: Wei');
    expect(el.querySelector('.summary')!.textContent).toContain('Combined HP: 7');
  });
});
