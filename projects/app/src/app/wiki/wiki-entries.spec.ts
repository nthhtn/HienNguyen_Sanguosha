import { TestBed } from '@angular/core/testing';
import type { WikiCard, WikiGeneral } from 'content';
import { WikiCardEntry } from './wiki-card-entry';
import { WikiGeneralEntry } from './wiki-general-entry';

const caoCao: WikiGeneral = {
  id: 'cao-cao', name: 'Cao Cao', nameZh: '曹操', title: 'Martial Emperor of Wei', titleZh: '魏武帝',
  kingdom: 'Wei', maxHp: 4, skillsInGame: false, expansion: 'Base',
  skills: [{ name: 'Evil Hero', nameZh: '奸雄', text: 'When Cao Cao is damaged by a card, he can put it into his hand.' }],
};
const duel: WikiCard = {
  id: 'duel', name: 'Duel', nameZh: '决斗', category: 'tool', subtype: null, text: 'A player can target anyone with this card.',
  range: null, count: 3, printings: [{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }], inGame: true,
};
const redHare: WikiCard = {
  id: 'red-hare', name: 'Red Hare', nameZh: '赤兔', category: 'equipment', subtype: 'horse', text: null,
  range: null, count: null, printings: [], inGame: false,
};

function renderGeneral(general: WikiGeneral): HTMLElement {
  const fixture = TestBed.createComponent(WikiGeneralEntry);
  fixture.componentRef.setInput('general', general);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function renderCard(card: WikiCard): HTMLElement {
  const fixture = TestBed.createComponent(WikiCardEntry);
  fixture.componentRef.setInput('card', card);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('WikiGeneralEntry', () => {
  it('shows names, title, kingdom, HP and skills', () => {
    const el = renderGeneral(caoCao);
    const text = el.textContent!;
    expect(el.querySelector('article.entry')!.getAttribute('data-id')).toBe('cao-cao');
    expect(el.querySelector('h4 .name')!.textContent).toBe('Cao Cao');
    for (const part of ['曹操', 'Martial Emperor of Wei', '魏武帝', 'Wei', 'Evil Hero', '奸雄', 'he can put it into his hand']) {
      expect(text).toContain(part);
    }
    expect(el.querySelectorAll('.hearts mat-icon')).toHaveLength(4);
    expect(el.querySelector('app-card-art')).not.toBeNull();
    expect(el.querySelector('.expansion-tag')!.textContent!.trim()).toBe('Base');
  });

  it('shows an expansion general’s expansion', () => {
    expect(renderGeneral({ ...caoCao, id: 'cao-pi', expansion: 'Forest' }).querySelector('.expansion-tag')!.textContent!.trim()).toBe('Forest');
  });

  it('badges whether the general’s skills are in the game', () => {
    expect(renderGeneral(caoCao).querySelector('.badge')!.textContent!.trim()).toBe('Skills not in game yet');
    const coded = renderGeneral({ ...caoCao, skillsInGame: true }).querySelector('.badge')!;
    expect(coded.textContent!.trim()).toBe('Skills in game');
    expect(coded.classList).toContain('on');
  });

  it('leaves out a missing Chinese name and title (Review Focus 2)', () => {
    const el = renderGeneral({ ...caoCao, nameZh: null, title: null, titleZh: null });
    expect(el.querySelector('h4 .zh')).toBeNull();
    expect(el.querySelector('.title')).toBeNull();
  });
});

describe('WikiCardEntry', () => {
  it('shows names, rules text, copies and printings', () => {
    const el = renderCard(duel);
    const text = el.textContent!;
    expect(el.querySelector('h4 .name')!.textContent).toBe('Duel');
    for (const part of ['决斗', 'A player can target anyone with this card.', '3 copies', '♠A ♣A ♦A']) {
      expect(text).toContain(part);
    }
    expect(el.querySelector('.badge')!.textContent!.trim()).toBe('In the game');
    expect(el.querySelector('.badge')!.classList).toContain('on');
  });

  it('shows gap texts instead of blanks (Review Focus 2)', () => {
    const el = renderCard(redHare);
    expect(el.textContent).toContain('Rules text not available');
    expect(el.textContent).toContain('Printings not recorded');
    expect(el.querySelector('.badge')!.textContent!.trim()).toBe('Not in the game yet');
  });

  it('shows a weapon’s range', () => {
    const el = renderCard({ ...redHare, id: 'axe', name: 'Axe', subtype: 'weapon', range: 3, text: 'Hit anyway.' });
    expect(el.querySelector('.range')!.textContent).toContain('Range 3');
  });
});
