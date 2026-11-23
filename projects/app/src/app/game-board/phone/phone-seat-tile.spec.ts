import { readFileSync } from 'fs';
import { join } from 'path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CardInstance, Seat } from 'engine';
import { generalFaceUrl, generalSkinUrl, HIDDEN_GENERAL_ART_URL } from 'content';
import { PhoneSeatTile } from './phone-seat-tile';
import { testSeat } from './phone.testing';

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 7 });

describe('PhoneSeatTile', () => {
  let fixture: ComponentFixture<PhoneSeatTile>;

  function render(seat: Seat, set: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(PhoneSeatTile);
    fixture.componentRef.setInput('seat', seat);
    fixture.componentRef.setInput('name', 'Seat 3');
    fixture.componentRef.setInput('handCount', 5);
    for (const [key, value] of Object.entries(set)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the name, HP, hand count, both Generals and only the Judgment and Equipment cards the seat has', () => {
    const el = render(testSeat('seat-3', 3, { combinedHp: 3, maxCombinedHp: 4 }), {
      judgment: [card('j1', 'lightning')],
      equipment: [card('e1', 'serpent-spear')],
    });
    expect(el.querySelector('.name')!.textContent).toContain('Seat 3');
    expect(el.querySelector('.hp')!.getAttribute('aria-label')).toBe('HP 3/4');
    expect(el.querySelector('.hand')!.textContent).toContain('5');
    expect(el.querySelectorAll('.general')).toHaveLength(2);
    expect(el.querySelectorAll('.judgment-box')).toHaveLength(1);
    expect(el.querySelectorAll('.equip-box')).toHaveLength(1);
    expect(el.querySelector('.equip-box[data-slot="weapon"]')!.classList).toContain('filled');
  });

  it('draws no boxes for a seat with no Judgment or Equipment cards, but keeps the Equipment row', () => {
    const el = render(testSeat('seat-3', 3));
    expect(el.querySelectorAll('.judgment-box')).toHaveLength(0);
    expect(el.querySelectorAll('.equip-box')).toHaveLength(0);
    expect(el.querySelector('.equipment')).not.toBeNull();
  });

  it('shows the chained mark only for a chained seat, with an accessible name', () => {
    expect(render(testSeat('seat-3', 3)).querySelector('.chain-mark')).toBeNull();
    const mark = render(testSeat('seat-3', 3, { chained: true })).querySelector('.chain-mark')!;
    expect(mark.getAttribute('aria-label')).toBe('Chained');
  });

  it('marks an Ambitionist', () => {
    expect(render(testSeat('seat-3', 3, { allegiance: 'ambitionist' })).querySelector('.ambitionist-mark')).not.toBeNull();
  });

  it('stamps an eliminated seat', () => {
    const el = render(testSeat('seat-3', 3, { eliminated: true }));
    expect(el.querySelector('.tile')!.classList).toContain('eliminated');
    expect(el.querySelector('.stamp')!.textContent).toContain('Eliminated');
  });

  it('shows whose turn it is and who is responding', () => {
    const tile = render(testSeat('seat-3', 3), { isTurnOwner: true, isResponding: true }).querySelector('.tile')!;
    expect(tile.classList).toContain('turn-owner');
    expect(tile.classList).toContain('responding');
  });

  it('shows a bot without the prefix and with the robot icon, on a full tile', () => {
    const el = render(testSeat('seat-3', 3), { name: '[Bot] Zhou Cang', isBot: true });
    expect(el.querySelector('.name')!.textContent!.trim()).toBe('Zhou Cang');
    expect(el.querySelector('.bot')).not.toBeNull();
    expect(el.querySelector('button.tile')!.getAttribute('aria-label')).toBe('[Bot] Zhou Cang');
  });

  it('leaves an old bot name and a human name as they are', () => {
    const old = render(testSeat('seat-3', 3), { name: 'Bot 1', isBot: true });
    expect(old.querySelector('.name')!.textContent!.trim()).toBe('Bot 1');
    expect(old.querySelector('.bot')).not.toBeNull();
    const human = render(testSeat('seat-3', 3), { name: 'Bob [Bot] x', isBot: false });
    expect(human.querySelector('.name')!.textContent!.trim()).toBe('Bob [Bot] x');
    expect(human.querySelector('.bot')).toBeNull();
  });

  it('is slim when asked, giving the name row to the name: the robot icon, only filled Judgment boxes, HP as numbers', () => {
    const el = render(testSeat('seat-3', 3, { combinedHp: 3, maxCombinedHp: 4 }), { slim: true, isBot: true, judgment: [card('j1', 'lightning')] });
    expect(el.querySelector('.tile')!.classList).toContain('slim');
    expect(el.querySelector('.bot')).not.toBeNull();
    expect(el.querySelectorAll('.judgment-box')).toHaveLength(1);
    expect(el.querySelector('.hp')!.textContent!.trim()).toBe('favorite3/4');
    expect(el.querySelector('.hp')!.getAttribute('aria-label')).toBe('HP 3/4');
  });

  it("opens on a tap on any tile, the viewer's included", () => {
    let opened = 0;
    render(testSeat('seat-3', 3));
    fixture.componentInstance.opened.subscribe(() => opened++);
    (fixture.nativeElement.querySelector('button.tile') as HTMLButtonElement).click();
    expect(opened).toBe(1);
    render(testSeat('seat-0', 0), { isViewer: true });
    fixture.componentInstance.opened.subscribe(() => opened++);
    (fixture.nativeElement.querySelector('button.tile') as HTMLButtonElement).click();
    expect(opened).toBe(2);
  });

  it('sets no text under 12 px', () => {
    const source = readFileSync(join(__dirname, 'phone-seat-tile.ts'), 'utf8');
    const sizes = [...source.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
    expect(source).not.toMatch(/font-size:\s*[\d.]+em/);
  });

  describe('text badges', () => {
    const badgesOn = (el: HTMLElement, slot: 'main' | 'deputy') =>
      [...el.querySelectorAll(`.general[data-slot="${slot}"] .badge`)].map((b) => b.textContent!.trim());
    const across = (el: HTMLElement) => [...el.querySelectorAll('.badges-across .badge')].map((b) => b.textContent!.trim());

    it('puts No Skills for one General on that General', () => {
      const el = render(testSeat('seat-3', 3, { silencedSlots: ['deputy'] }));
      expect(badgesOn(el, 'deputy')).toEqual(['No Skills']);
      expect(badgesOn(el, 'main')).toEqual([]);
    });

    it('puts Form on the General that changed', () => {
      const el = render(testSeat('seat-3', 3, { forms: { slot: 'main', held: ['g1'], chosen: { generalId: 'g1', skillId: 's1' } } }));
      expect(badgesOn(el, 'main')).toEqual(['Form']);
    });

    it('stacks Face Down and whole-seat No Skills across both Generals', () => {
      const el = render(testSeat('seat-3', 3, { faceDown: true, silenced: true }));
      expect(across(el)).toEqual(['Face Down', 'No Skills']);
      expect(badgesOn(el, 'main')).toEqual([]);
    });

    it('shows Dying as a red badge across both Generals, not a strip', () => {
      const el = render(testSeat('seat-3', 3, { combinedHp: 0 }));
      const dying = el.querySelector('.badges-across .badge.red')!;
      expect(dying.textContent).toContain('Dying');
      expect(el.querySelector('.status')).toBeNull();
    });
  });

  describe('face avatars', () => {
    const generalsOf = (main: string, deputy = 'hidden') => ({
      main: { generalDefinitionId: main, revealed: main !== 'hidden' },
      deputy: { generalDefinitionId: deputy, revealed: deputy !== 'hidden' },
    });
    const src = (el: HTMLElement, slot: 'main' | 'deputy') => (el.querySelector(`.general[data-slot="${slot}"] img`) as HTMLImageElement).getAttribute('src');

    it("shows a revealed General's face crop and the hidden art for a hidden one", () => {
      const el = render(testSeat('seat-3', 3, { generals: generalsOf('cao-cao') }));
      expect(src(el, 'main')).toBe(generalFaceUrl('cao-cao'));
      expect(src(el, 'deputy')).toBe(HIDDEN_GENERAL_ART_URL);
    });

    it('shows the portrait for a General with no face crop', () => {
      const el = render(testSeat('seat-3', 3, { generals: generalsOf('kingdomWars:nobody') }));
      expect(generalFaceUrl('kingdomWars:nobody')).toBeNull();
      expect(src(el, 'main')).toBe(generalSkinUrl('kingdomWars:nobody'));
    });

    it('falls back to the portrait when the face crop does not load', () => {
      const el = render(testSeat('seat-3', 3, { generals: generalsOf('cao-cao') }));
      el.querySelector('.general[data-slot="main"] img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(src(el, 'main')).toBe(generalSkinUrl('cao-cao'));
    });
  });

  describe('HP', () => {
    it('shows one HP icon per max HP on a full tile, lost ones dark, with the numbers as its label', () => {
      const el = render(testSeat('seat-3', 3, { combinedHp: 3, maxCombinedHp: 4 }));
      const icons = [...el.querySelectorAll('.hp .hp-icon')];
      expect(icons).toHaveLength(4);
      expect(icons.map((i) => i.classList.contains('lost'))).toEqual([false, false, false, true]);
      expect(el.querySelector('.hp')!.getAttribute('aria-label')).toBe('HP 3/4');
      expect(el.querySelector('.hp')!.textContent).not.toContain('HP');
    });

    it('caps at 8 icons and then shows the numbers too', () => {
      const el = render(testSeat('seat-3', 3, { combinedHp: 9, maxCombinedHp: 10 }));
      expect(el.querySelectorAll('.hp .hp-icon')).toHaveLength(8);
      expect(el.querySelector('.hp')!.textContent).toContain('9/10');
    });

    it("shows the icons on the viewer's tile too", () => {
      expect(render(testSeat('seat-0', 0), { isViewer: true }).querySelectorAll('.hp .hp-icon')).toHaveLength(4);
    });

    it('shows a heart and 4/4 on a slim tile, no icons', () => {
      const el = render(testSeat('seat-3', 3), { slim: true });
      expect(el.querySelectorAll('.hp .hp-icon')).toHaveLength(0);
      expect(el.querySelector('.hp')!.textContent!.trim()).toBe('favorite4/4');
    });
  });
});

