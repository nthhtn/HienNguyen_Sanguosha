import { TestBed } from '@angular/core/testing';
import type { WikiAlternateGeneral, WikiCard, WikiGeneral } from 'content';
import { MUSIC_PLAYER_FACTORY, SoundEffects } from '../music.service';
import { WikiCardEntry } from './wiki-card-entry';
import { WikiGeneralEntry } from './wiki-general-entry';
import { WikiAlternateGeneralEntry } from './wiki-alternate-general-entry';
import { I18n } from '../i18n/i18n.service';

const caoCao: WikiGeneral = {
  id: 'cao-cao', name: 'Cao Cao', nameZh: '曹操', title: 'Martial Emperor of Wei', titleZh: '魏武帝',
  kingdom: 'Wei', maxHp: 4, skillsInGame: false, expansion: 'Base', gender: 'male',
  skills: [{ name: 'Evil Hero', nameZh: '奸雄', text: 'When Cao Cao is damaged by a card, he can put it into his hand.', lord: false, status: 'working' }],
};
const duel: WikiCard = {
  id: 'duel', name: 'Duel', nameZh: '决斗', category: 'tool', subtype: null, text: 'A player can target anyone with this card.',
  range: null, count: 3, printings: [{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }],
  mount: null, delayed: false, expansion: 'Base', inGame: true, deck: 'default',
};
const redHare: WikiCard = {
  id: 'red-hare', name: 'Red Hare', nameZh: '赤兔', category: 'equipment', subtype: 'horse', text: null,
  range: null, count: null, printings: [], mount: 'offensive', delayed: false, expansion: 'Base', inGame: false, deck: 'default',
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
  it('has a Voice button that plays the General’s voice, even with sound effects off', () => {
    localStorage.clear();
    const urls: string[] = [];
    TestBed.configureTestingModule({
      providers: [{ provide: MUSIC_PLAYER_FACTORY, useValue: (url: string) => (urls.push(url), { loop: false, volume: 1, play: async () => undefined, pause: () => undefined }) }],
    });
    TestBed.inject(SoundEffects).toggle();
    const el = renderGeneral(caoCao);
    expect(el.querySelector('.voices-label')!.textContent).toBe('Voice:');
    const button = el.querySelector('button.voice') as HTMLButtonElement;
    expect(button.querySelector('mat-icon')!.textContent).toBe('graphic_eq');
    button.click();
    expect(urls).toEqual(['/audio/death/caocao.ogg']);
    expect(renderGeneral({ ...caoCao, id: 'zuo-ci' }).querySelector('button.voice')).toBeNull();
    localStorage.clear();
  });

  it('shows names, title, kingdom, HP and skills', () => {
    const el = renderGeneral(caoCao);
    const text = el.textContent!;
    expect(el.querySelector('article.entry')!.getAttribute('data-id')).toBe('cao-cao');
    expect(el.querySelector('h4 .name')!.textContent).toBe('Cao Cao');
    for (const part of ['曹操', 'Martial Emperor of Wei', '魏武帝', 'Wei', 'Evil Hero', '奸雄', 'he can put it into his hand']) {
      expect(text).toContain(part);
    }
    expect(el.querySelectorAll('.hearts mat-icon')).toHaveLength(4);
    expect(el.querySelector('app-card-art img')!.getAttribute('src')).toBe('/card-art/generals/skins/wei/caocao.png');
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

  it('shows the gender and notes a Lord skill as not used in Kingdom War', () => {
    const liuBei: WikiGeneral = {
      ...caoCao, id: 'liu-bei', name: 'Liu Bei', kingdom: 'Shu',
      skills: [
        { name: 'Kindness', nameZh: null, text: 'Give cards away.', lord: false, status: 'working' },
        { name: 'Fierce General', nameZh: null, text: 'King Ability.', lord: true, status: 'lord' },
      ],
    };
    const el = renderGeneral(liuBei);
    expect(el.querySelector('.gender-tag')!.textContent!.trim()).toBe('Male');
    expect(el.querySelector('.lord-note')).toBeNull();
    const lord = el.querySelectorAll('.skill-status[data-status="lord"]');
    expect(lord).toHaveLength(1);
    expect(lord[0].textContent!.trim()).toBe('Not used in Kingdom War');
  });

  it('labels only the skills that do not work: Not used in Kingdom War, or Not in the game yet; a working skill has no label', () => {
    const general: WikiGeneral = {
      ...caoCao,
      skills: [
        { name: 'Evil Hero', nameZh: null, text: 'a', lord: false, status: 'working' },
        { name: 'Escort', nameZh: null, text: 'b', lord: true, status: 'lord' },
        { name: 'Ghost Skill', nameZh: null, text: 'c', lord: false, status: 'missing' },
      ],
    };
    const states = [...renderGeneral(general).querySelectorAll('.skill-status')].map((s) => [s.getAttribute('data-status'), s.textContent!.trim()]);
    expect(states).toEqual([['lord', 'Not used in Kingdom War'], ['missing', 'Not in the game yet']]);
  });
});

describe('WikiCardEntry', () => {
  it('has a button per gender that plays the card’s voice, and none for a card without one', () => {
    localStorage.clear();
    const urls: string[] = [];
    TestBed.configureTestingModule({
      providers: [{ provide: MUSIC_PLAYER_FACTORY, useValue: (url: string) => (urls.push(url), { loop: false, volume: 1, play: async () => undefined, pause: () => undefined }) }],
    });
    const el = renderCard(duel);
    const buttons = [...el.querySelectorAll('button.voice')] as HTMLButtonElement[];
    expect(el.querySelector('.voices-label')!.textContent).toBe('Voices:');
    expect(buttons.map((b) => b.querySelector('mat-icon')!.textContent)).toEqual(['man', 'woman']);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Play Male Voice', 'Play Female Voice']);
    buttons.forEach((b) => b.click());
    expect(urls).toEqual(['/audio/male/duel.ogg', '/audio/female/duel.ogg']);
    TestBed.inject(SoundEffects).toggle();
    buttons[0].click();
    expect(urls).toHaveLength(3);
    expect(renderCard(redHare).querySelector('button.voice')).toBeNull();
    localStorage.clear();
  });

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

  it('shows a mount’s distance: -1 for an offensive Mount, +1 for a defensive one', () => {
    expect(renderCard({ ...redHare, mount: 'offensive' }).querySelector('.distance')!.textContent).toContain('Distance -1');
    expect(renderCard({ ...redHare, mount: 'defensive' }).querySelector('.distance')!.textContent).toContain('Distance +1');
    expect(renderCard({ ...redHare, id: 'axe', subtype: 'weapon', mount: null, range: 3 }).querySelector('.distance')).toBeNull();
  });

  it('shows a weapon’s range', () => {
    const el = renderCard({ ...redHare, id: 'axe', name: 'Axe', subtype: 'weapon', range: 3, text: 'Hit anyway.' });
    expect(el.querySelector('.range')!.textContent).toContain('Range 3');
  });
});

describe('WikiCardEntry in the Alternate deck', () => {
  const pommel: WikiCard = {
    id: 'black-pommel', name: 'Black Pommel', nameZh: '青釭剑', category: 'equipment', subtype: 'weapon', text: 'English rules of Default.',
    range: 2, count: 1, printings: [{ suit: 'spade', rank: 6 }], mount: null, delayed: false, expansion: null, inGame: true,
    deck: 'alternate',
  };

  it('shows the card’s text with no label and no pack tag', () => {
    const el = renderCard(pommel);
    expect(el.querySelector('.text')!.textContent!.trim()).toBe('English rules of Default.');
    expect(el.querySelector('.label')).toBeNull();
    expect(el.querySelector('.expansion-tag')).toBeNull();
    expect(el.textContent).toContain('1 copies');
  });

  it('says the rules text is not available, never a blank, when there is none', () => {
    const el = renderCard({ ...pommel, id: 'sha', name: 'Slash', text: null });
    expect(el.querySelector('.gap')!.textContent!.trim()).toBe('Rules text not available');
  });

  it('renders a card Default lacks: not in the game, and no art', () => {
    const el = renderCard({ ...pommel, id: 'wuxie-guo', name: 'Wuxie Kingdom', inGame: false });
    expect(el.querySelector('.badge')!.textContent!.trim()).toBe('Not in the game yet');
  });

  it('leaves a Default card as it was: pack tag present', () => {
    const el = renderCard(duel);
    expect(el.querySelector('.expansion-tag')).not.toBeNull();
  });
});


describe('WikiAlternateGeneralEntry', () => {
  const alternateCaoCao: WikiAlternateGeneral = {
    id: 'cao-cao', name: 'Cao Cao', nameZh: '曹操', title: 'The Militant Emperor of Wei',
    kingdom: 'Wei', maxHp: 4, gender: 'male', skillsRunAsDefault: true,
    skills: [{ name: 'Villainous Hero', nameZh: '奸雄', text: 'Every instance after you suffer damage, you can acquire the card.', status: 'worksAsDefault' }],
    partners: ['Dian Wei 典韦 (Bodyguard)'],
    differenceNote: 'The Ruler Ability is removed.',
  };

  function render(general: WikiAlternateGeneral): HTMLElement {
    const fixture = TestBed.createComponent(WikiAlternateGeneralEntry);
    fixture.componentRef.setInput('general', general);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows names, title, kingdom, HP and gender, and nothing from a pack or a voice', () => {
    const el = render(alternateCaoCao);
    expect(el.querySelector('article.entry')!.getAttribute('data-id')).toBe('cao-cao');
    expect(el.querySelector('h4 .name')!.textContent).toBe('Cao Cao');
    for (const part of ['曹操', 'The Militant Emperor of Wei', 'Wei', 'Villainous Hero', '奸雄']) expect(el.textContent).toContain(part);
    expect(el.querySelectorAll('.hearts mat-icon')).toHaveLength(4);
    expect(el.querySelector('.gender-tag')!.textContent!.trim()).toBe('Male');
    expect(el.querySelector('.expansion-tag')).toBeNull();
    expect(el.querySelector('button.voice')).toBeNull();
    expect(el.querySelector('.badge')).toBeNull();
  });

  it('tags each skill Works as Default or Not in the game yet, never Working', () => {
    const general: WikiAlternateGeneral = {
      ...alternateCaoCao,
      skills: [
        { name: 'A', nameZh: null, text: 'a', status: 'worksAsDefault' },
        { name: 'B', nameZh: null, text: 'b', status: 'missing' },
      ],
    };
    const tags = [...render(general).querySelectorAll('.skill-status')].map((s) => [s.getAttribute('data-status'), s.textContent!.trim()]);
    expect(tags).toEqual([['worksAsDefault', 'Works as Default'], ['missing', 'Not in the game yet']]);
    expect(render(general).textContent).not.toContain('Working');
  });

  it('shows the Synergistic Partners and the Difference note, and hides them when empty', () => {
    const el = render(alternateCaoCao);
    expect(text(el.querySelector('.partners'))).toContain('Synergistic Partners');
    expect(text(el.querySelector('.partners'))).toContain('Dian Wei 典韦 (Bodyguard)');
    expect(text(el.querySelector('.difference'))).toContain('The Ruler Ability is removed.');
    const bare = render({ ...alternateCaoCao, partners: [], differenceNote: null });
    expect(bare.querySelector('.partners')).toBeNull();
    expect(bare.querySelector('.difference')).toBeNull();
  });

  it('shows the placeholder, not a broken image, for a General with no art', () => {
    const el = render({ ...alternateCaoCao, id: 'ding-feng', name: 'Ding Feng' });
    expect(el.querySelector('app-card-art img')).toBeNull();
    expect(el.querySelector('.card-art-placeholder')!.textContent).toContain('Ding Feng');
  });

  it('shows the Vietnamese draft in Vietnamese', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    await TestBed.inject(I18n).setLocale('vi');
    const el = render(alternateCaoCao);
    expect(el.querySelector('h4 .name')!.textContent).toBe('Tào Tháo');
    expect(text(el)).toContain('Gian hùng');
    expect(text(el.querySelector('.skills'))).toContain('Mỗi khi bạn bị sát thương');
    expect(text(el.querySelector('.partners'))).toContain('Điển Vi (Hộ vệ)');
    localStorage.clear();
  });
});

function text(el: Element | null): string {
  return el!.textContent!.replace(/\s+/g, ' ').trim();
}
