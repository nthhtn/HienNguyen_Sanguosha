import { Component, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CARD_BACK_ART_URL, CHAIN_ICON_URL, HIDDEN_GENERAL_ART_URL, cardArtUrl, hpIconUrls } from 'content';
import { DAMAGE_IMAGE_URLS } from '../../../game-board/damage-effects';
import { I18n } from '../../../i18n/i18n.service';
import type { MessageKey } from '../../../i18n/messages';
import { SceneCard } from './scene-card';
import { SceneFrame } from './scene-frame';
import { SceneGeneral } from './scene-general';
import { SceneHp } from './scene-hp';
import { SceneSeat } from './scene-seat';

afterEach(() => localStorage.clear());

function render(component: Type<unknown>, inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

describe('SceneCard', () => {
  it('shows a card by name with its art', async () => {
    const { fixture, el } = render(SceneCard, { id: 'sha' });
    const img = el.querySelector('img.scene-card')!;
    expect(img.getAttribute('src')).toBe(cardArtUrl('sha'));
    expect(img.getAttribute('alt')).toBe('Slash');
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(img.getAttribute('alt')).toBe('Sát');
  });

  it('shows the card back', () => {
    const { el } = render(SceneCard, { id: 'back' });
    const img = el.querySelector('img.scene-card')!;
    expect(img.getAttribute('src')).toBe(CARD_BACK_ART_URL);
    expect(img.getAttribute('alt')).toBe('Card Back');
  });

  it('dims a card to discard', () => {
    const { el } = render(SceneCard, { id: 'steal', dim: true });
    expect(el.querySelector('img.scene-card')!.classList.contains('dim')).toBe(true);
  });
});

describe('SceneGeneral', () => {
  it('shows a General and the face-down card', async () => {
    const general = render(SceneGeneral, { id: 'cao-cao' });
    const img = general.el.querySelector('img.scene-card')!;
    expect(img.getAttribute('src')).toBe(cardArtUrl('cao-cao'));
    expect(img.getAttribute('alt')).toBe('Cao Cao');
    await TestBed.inject(I18n).setLocale('vi');
    general.fixture.detectChanges();
    expect(img.getAttribute('alt')).toBe('Tào Tháo');

    const hidden = render(SceneGeneral, { id: 'hidden' });
    expect(hidden.el.querySelector('img.scene-card')!.getAttribute('src')).toBe(HIDDEN_GENERAL_ART_URL);
  });
});

describe('SceneSeat', () => {
  it('names the seat, never an id', async () => {
    const { fixture, el } = render(SceneSeat, { general: 'cao-cao', n: 2, force: 'Wei' });
    expect(text(el)).toContain('Seat 2');
    expect(text(el)).toContain('Wei');
    expect(text(el)).not.toMatch(/seat-|cao-cao/);
    expect(el.querySelector('img.scene-avatar')!.getAttribute('src')).toMatch(/^\/card-art\//);
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(text(el)).toContain('Người chơi 2');
    expect(text(el)).toContain('Ngụy');
  });

  it('marks a seat that is out', () => {
    const { el } = render(SceneSeat, { general: 'liu-bei', n: 2, out: true });
    expect(el.querySelector('.seat')!.classList.contains('out')).toBe(true);
  });

  it('takes a label in place of the seat name', () => {
    const { el } = render(SceneSeat, { general: 'cao-cao', n: 1, label: 'Killer' });
    expect(text(el)).toContain('Killer');
    expect(text(el)).not.toContain('Seat 1');
  });
});

describe('SceneSeat marks', () => {
  it('shows a chained badge with its art and name', async () => {
    const { fixture, el } = render(SceneSeat, { general: 'cao-cao', n: 2, chained: true });
    const badge = el.querySelector('img.scene-chain')!;
    expect(badge.getAttribute('src')).toBe(CHAIN_ICON_URL);
    expect(badge.getAttribute('alt')).toBe('Chained');
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(badge.getAttribute('alt')).toBe('Bị xích');
    expect(render(SceneSeat, { general: 'cao-cao', n: 2 }).el.querySelector('img.scene-chain')).toBeNull();
  });

  it('shows a damage mark over the portrait', () => {
    const { el } = render(SceneSeat, { general: 'cao-cao', n: 2, mark: 'fire' });
    expect(el.querySelector('img.scene-mark')!.getAttribute('src')).toBe(DAMAGE_IMAGE_URLS.fire);
    expect(render(SceneSeat, { general: 'cao-cao', n: 2 }).el.querySelector('img.scene-mark')).toBeNull();
  });

  it('shows its note', () => {
    const { el } = render(SceneSeat, { general: 'cao-cao', n: 2, note: '4 HP' });
    expect(text(el)).toContain('4 HP');
  });
});

describe('SceneHp', () => {
  it('dims lost HP, and says "3 of 4 HP" once for a reader instead of naming each icon', async () => {
    const { fixture, el } = render(SceneHp, { hp: 3, max: 4 });
    const icons = [...el.querySelectorAll('img')];
    expect(icons.map((i) => i.classList.contains('lost'))).toEqual([false, false, false, true]);
    expect(icons.map((i) => i.getAttribute('src'))).toEqual(hpIconUrls(4));
    expect(icons.map((i) => i.getAttribute('alt'))).toEqual(['', '', '', '']);
    expect(el.getAttribute('aria-label')).toBe('3 of 4 HP');
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(el.getAttribute('aria-label')).toBe('3 trên 4 Sinh lực');
  });

  it('shows no lost HP at full HP', () => {
    const { el } = render(SceneHp, { hp: 4 });
    expect(el.querySelectorAll('img').length).toBe(4);
    expect(el.querySelectorAll('img.lost').length).toBe(0);
    expect(el.getAttribute('aria-label')).toBe('4 HP');
  });
});

describe('SceneFrame', () => {
  @Component({ imports: [SceneFrame], template: `<app-scene [caption]="caption"><p>inside</p></app-scene>` })
  class Host {
    caption: MessageKey = 'nav.rules.setup';
  }

  it('shows a translated caption around its content', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('.cap')!)).toBe('Setup');
    expect(text(el)).toContain('inside');
  });
});

describe('scene art', () => {
  it.each(['sha', 'shan', 'peach', 'wine', 'wuxie', 'capture', 'cao-cao', 'guo-jia', 'zhang-jiao'])('%s resolves to a real asset path', (id) => {
    const card = render(id.includes('-') ? SceneGeneral : SceneCard, { id });
    expect(card.el.querySelector('img.scene-card')!.getAttribute('src')).toMatch(/^\/card-art\/.+\.jpg$/);
  });
});
