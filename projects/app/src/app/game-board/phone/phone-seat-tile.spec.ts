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

  it('shows the name, HP, hand count, both Generals, three Judgment boxes and four Equipment boxes', () => {
    const el = render(testSeat('seat-3', 3, { combinedHp: 3, maxCombinedHp: 4 }), {
      judgment: [card('j1', 'lightning')],
      equipment: [card('e1', 'serpent-spear')],
    });
    expect(el.querySelector('.name')!.textContent).toContain('Seat 3');
    expect(el.querySelector('.hp')!.textContent).toContain('3/4');
    expect(el.querySelector('.hand')!.textContent).toContain('5');
    expect(el.querySelectorAll('.general')).toHaveLength(2);
    const judgment = el.querySelectorAll('.judgment-box');
    expect(judgment).toHaveLength(3);
    expect([...judgment].filter((b) => b.classList.contains('filled'))).toHaveLength(1);
    const equipment = el.querySelectorAll('.equip-box');
    expect(equipment).toHaveLength(4);
    expect(el.querySelector('.equip-box[data-slot="weapon"]')!.classList).toContain('filled');
    expect(el.querySelector('.equip-box[data-slot="armor"]')!.classList).not.toContain('filled');
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

  it('is slim when asked, giving the name row to the name: no bot icon, only filled Judgment boxes, HP as numbers', () => {
    const el = render(testSeat('seat-3', 3, { combinedHp: 3, maxCombinedHp: 4 }), { slim: true, isBot: true, judgment: [card('j1', 'lightning')] });
    expect(el.querySelector('.tile')!.classList).toContain('slim');
    expect(el.querySelector('.bot')).toBeNull();
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
});

