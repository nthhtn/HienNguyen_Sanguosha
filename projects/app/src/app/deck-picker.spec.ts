import { TestBed } from '@angular/core/testing';
import { DeckPicker } from './deck-picker';

describe('DeckPicker', () => {
  const create = async () => {
    await TestBed.configureTestingModule({ imports: [DeckPicker] }).compileComponents();
    const fixture = TestBed.createComponent(DeckPicker);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };
  const radios = (el: HTMLElement) => [...el.querySelectorAll('mat-radio-button')];
  const input = (radio: Element) => radio.querySelector('input') as HTMLInputElement;

  it('offers Kingdom Wars and Dynasty Wars, with Kingdom Wars chosen', async () => {
    const { el } = await create();
    expect(el.querySelector('.label')!.textContent).toContain('Deck');
    expect(radios(el).map((r) => r.textContent!.trim())).toEqual(['Kingdom Wars', 'Dynasty Wars']);
    expect(radios(el).map((r) => input(r).checked)).toEqual([true, false]);
  });

  it('disables Dynasty Wars for now (deferred): it stays listed but cannot be chosen', async () => {
    const { fixture, el } = await create();
    expect(radios(el).map((r) => input(r).disabled)).toEqual([false, true]);
    input(radios(el)[1]).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value()).toBe('alternate');
    expect(radios(el).map((r) => input(r).checked)).toEqual([true, false]);
  });

  it('shows the hint, and can be disabled', async () => {
    const { fixture, el } = await create();
    expect(el.querySelector('.hint')!.textContent).toContain('Which card distribution the game is dealt from.');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(radios(el).map((r) => input(r).disabled)).toEqual([true, true]);
  });
});
