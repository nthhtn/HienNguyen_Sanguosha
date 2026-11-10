import { TestBed } from '@angular/core/testing';
import { SeatGenerals } from 'engine';
import { HIDDEN_GENERAL_ART_URL, generalSkinUrl } from 'content';
import { SeatPortrait } from './seat-portrait';

function render(generals: SeatGenerals | null): HTMLElement {
  const fixture = TestBed.createComponent(SeatPortrait);
  fixture.componentRef.setInput('generals', generals);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const srcs = (el: HTMLElement) => [...el.querySelectorAll('img')].map((i) => i.getAttribute('src'));

describe('SeatPortrait', () => {
  it('shows the Main General on the left and a face-down Deputy as the card back', () => {
    const el = render({ main: { generalDefinitionId: 'cao-cao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } });
    expect(srcs(el)).toEqual([generalSkinUrl('cao-cao'), HIDDEN_GENERAL_ART_URL]);
  });

  it('shows two card backs when the seat is not known', () => {
    expect(srcs(render(null))).toEqual([HIDDEN_GENERAL_ART_URL, HIDDEN_GENERAL_ART_URL]);
  });

  it('is not interactive', () => {
    expect(render({ main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } }).querySelector('button')).toBeNull();
  });

  it('falls back to the card back when art does not load', () => {
    const fixture = TestBed.createComponent(SeatPortrait);
    fixture.componentRef.setInput('generals', { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(srcs(el)[0]).toBe(HIDDEN_GENERAL_ART_URL);
  });
});
