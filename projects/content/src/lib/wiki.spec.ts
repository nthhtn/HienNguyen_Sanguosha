import { cardDisplayData } from './display';
import { GENERAL_SKILLS } from './generals';
import { equipmentTabs, generalSkillsInGame, skillIdFromName, skillStatus, wikiCardTabs, wikiCards, wikiGeneralTabs, wikiGenerals, WikiCard } from './wiki';

describe('wikiGenerals', () => {
  const generals = wikiGenerals();

  it('lists every general with data, grouped by kingdom, its Lords first, then by pack, then by name', () => {
    expect(generals).toHaveLength(57);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(generals.filter((g) => g.kingdom === 'Wei').map((g) => g.name)).toEqual([
      'Cao Cao', 'Cao Pi', 'Guo Jia', 'Sima Yi', 'Xiahou Dun', 'Xu Chu', 'Zhang Liao', 'Zhen Ji',
      'Cao Ren', 'Xiahou Yuan', 'Dian Wei', 'Xun Yu', 'Xu Huang', 'Deng Ai', 'Zhang He',
    ]);
  });

  it('puts each kingdom’s Lords first, by pack, even from a later pack', () => {
    const first = (kingdom: string) => generals.find((g) => g.kingdom === kingdom)!.name;
    expect(['Wei', 'Shu', 'Wu'].map(first)).toEqual(['Cao Cao', 'Liu Bei', 'Sun Quan']);
    expect(generals.filter((g) => g.kingdom === 'Shu').slice(0, 2).map((g) => g.name)).toEqual(['Liu Bei', 'Liu Shan']);
    expect(generals.filter((g) => g.kingdom === 'Wu').map((g) => g.expansion)).toEqual([
      'Base', 'Mountain', ...Array(7).fill('Base'), 'Wind', 'Wind', 'Fire', 'Forest', 'Forest', 'Mountain',
    ]);
  });

  it('puts Qun’s Lords first, by pack, then its other Generals by pack', () => {
    expect(generals.filter((g) => g.kingdom === 'Qun').map((g) => g.name)).toEqual([
      'Zhang Jiao', 'Yuan Shao', 'Dong Zhuo', 'Diao Chan', 'Hua Tuo', 'Lu Bu', 'Yu Ji', 'Pang De', 'Yan Liang and Wen Chou', 'Jia Xu', 'Cai Wenji', 'Zuo Ci',
    ]);
  });

  it('marks exactly the generals whose skills are coded', () => {
    expect(generals.filter((g) => g.skillsInGame).map((g) => g.id).sort()).toEqual([...GENERAL_SKILLS.keys()].sort());
  });

  it('carries names, title, HP and skills from the data file', () => {
    const caoCao = generals.find((g) => g.id === 'cao-cao')!;
    expect(caoCao).toMatchObject({
      name: 'Cao Cao', nameZh: '曹操', title: 'Martial Emperor of Wei', titleZh: '魏武帝', kingdom: 'Wei', maxHp: 4, skillsInGame: true,
    });
    expect(caoCao.skills.map((s) => [s.name, s.nameZh])).toEqual([['Evil Hero', '奸雄'], ['Escort', '护驾']]);
  });

  it('Lu Meng has no Chinese name (Review Focus 2)', () => {
    expect(generals.find((g) => g.id === 'lu-meng')!.nameZh).toBeNull();
  });

  it('includes every Wind, Fire, Forest and Mountain general of the four kingdoms', () => {
    const ids = new Set(generals.map((g) => g.id));
    for (const id of [
      'xiahou-yuan', 'cao-ren', 'dian-wei', 'xun-yu', 'xu-huang', 'cao-pi', 'zhang-he', 'deng-ai',
      'huang-zhong', 'wei-yan', 'pang-tong', 'fire-zhuge-liang', 'meng-huo', 'zhu-rong', 'jiang-wei', 'liu-shan',
      'xiao-qiao', 'zhou-tai', 'taishi-ci', 'sun-jian', 'lu-su', 'sun-ce', 'zhang-zhao-and-zhang-hong',
      'zhang-jiao', 'yu-ji', 'yuan-shao', 'yan-liang-and-wen-chou', 'pang-de', 'dong-zhuo', 'jia-xu', 'zuo-ci', 'cai-wenji',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(generals.every((g) => g.maxHp !== null)).toBe(true);
  });

  it('keeps both Zhuge Liangs apart (Review Focus 3)', () => {
    const base = generals.find((g) => g.id === 'zhuge-liang')!;
    const fire = generals.find((g) => g.id === 'fire-zhuge-liang')!;
    expect([base.name, fire.name]).toEqual(['Zhuge Liang', 'Zhuge Liang']);
    expect(fire).toMatchObject({ kingdom: 'Shu', title: 'Sleeping Dragon', titleZh: '卧龙', maxHp: 3 });
    expect(base.title).not.toBe(fire.title);
  });

  it('replaces the placeholder Dong Zhuo with the Forest one', () => {
    const dongZhuo = generals.find((g) => g.id === 'dong-zhuo')!;
    expect(dongZhuo).toMatchObject({ kingdom: 'Qun', maxHp: 8 });
    expect(dongZhuo.skills.map((s) => s.name)).not.toContain('Tyranny');
  });

  it('copies skills verbatim from the page', () => {
    const xiahouYuan = generals.find((g) => g.id === 'xiahou-yuan')!;
    expect(xiahouYuan).toMatchObject({ name: 'Xiahou Yuan', nameZh: '夏侯渊', title: 'Running Cheetah', titleZh: '急行的猎豹', maxHp: 4 });
    expect(xiahouYuan.skills).toEqual([{
      name: 'Godspeed', nameZh: '神速', lord: false, status: 'working',
      text: 'During his turn, Xiahou Yuan can exercise either or both of the following options to attack any character regardless of their distance from him: Skip his judgment and drawing phases. Skip his action phase and discard any equipment card.',
    }]);
  });

  it('tags every general with its expansion', () => {
    const count = (e: string) => generals.filter((g) => g.expansion === e).length;
    expect([count('Base'), count('Wind'), count('Fire'), count('Forest'), count('Mountain')]).toEqual([25, 8, 8, 8, 8]);
    expect(generals.find((g) => g.id === 'cao-cao')!.expansion).toBe('Base');
    expect(generals.find((g) => g.id === 'dong-zhuo')!.expansion).toBe('Forest');
  });
});

describe('wikiCards', () => {
  it('lists the basic cards by pack then name; all are in the game', () => {
    const basic = wikiCards('basic');
    expect(basic.map((c) => c.name)).toEqual(['Dodge', 'Peach', 'Slash', 'Fire Attack', 'Lightning Attack', 'Wine']);
    expect(basic.filter((c) => !c.inGame).map((c) => c.id)).toEqual([]);
  });

  it('records the Army basics with their spreadsheet printings', () => {
    const basic = wikiCards('basic');
    expect(basic.find((c) => c.id === 'fire-attack')).toMatchObject({ nameZh: '火杀', count: 5 });
    expect(basic.find((c) => c.id === 'lightning-attack')).toMatchObject({ nameZh: '雷杀', count: 9 });
  });

  it('tags the extra copies Army and EX add to existing cards with their expansion', () => {
    const all = [...wikiCards('basic'), ...wikiCards('tool')];
    const byExpansion = (id: string) => {
      const counts: Record<string, number> = {};
      for (const p of all.find((c) => c.id === id)!.printings) counts[p.expansion ?? 'own'] = (counts[p.expansion ?? 'own'] ?? 0) + 1;
      return counts;
    };
    expect(byExpansion('shan')).toEqual({ own: 15, Army: 9 });
    expect(byExpansion('peach')).toEqual({ own: 8, Army: 4 });
    expect(byExpansion('wuxie')).toEqual({ own: 3, Army: 3, EX: 1 });
    expect(byExpansion('lightning')).toEqual({ own: 1, EX: 1 });
  });

  it('carries Wine from the Army expansion', () => {
    const wine = wikiCards('basic').find((c) => c.id === 'wine')!;
    expect(wine).toMatchObject({ name: 'Wine', nameZh: '酒', category: 'basic', count: 5, mount: null, delayed: false });
    expect(wine.text).toBe(
      'When a player is on the brink of death, that player can use play wine to restore one health. Also any player can play this card once during their turn. If they do, the damage of the next attack is increased by one.'
    );
    expect(wine.printings).toEqual([
      { suit: 'spade', rank: 3 }, { suit: 'spade', rank: 9 }, { suit: 'club', rank: 3 }, { suit: 'club', rank: 9 }, { suit: 'diamond', rank: 9 },
    ]);
  });

  it('records each horse’s mount direction, and nothing else has one', () => {
    const equipment = wikiCards('equipment');
    const mountOf = Object.fromEntries(equipment.filter((c) => c.subtype === 'horse').map((c) => [c.id, c.mount]));
    expect(mountOf).toEqual({
      'da-yuan': 'offensive', 'di-lu': 'defensive', 'hua-liu': 'defensive', 'red-hare': 'offensive', 'shadow-runner': 'defensive', 'storm-runner': 'defensive', 'zi-xing': 'offensive',
    });
    expect(equipment.filter((c) => c.subtype !== 'horse').every((c) => c.mount === null)).toBe(true);
  });

  it('marks exactly Capture, Lightning and Starvation as delayed', () => {
    expect(wikiCards('tool').filter((c) => c.delayed).map((c) => c.id)).toEqual(['capture', 'lightning', 'starvation']);
    expect([...wikiCards('basic'), ...wikiCards('equipment')].some((c) => c.delayed)).toBe(false);
  });

  it('lists equipment by subtype, then pack (Base, EX, Army), then name, with the playable ones in the game', () => {
    const equipment = wikiCards('equipment');
    expect(equipment).toHaveLength(22);
    expect(equipment.map((c) => c.subtype)).toEqual([...Array(11).fill('weapon'), ...Array(4).fill('armor'), ...Array(7).fill('horse')]);
    expect(equipment.slice(7, 11).map((c) => [c.name, c.expansion])).toEqual([['Sky Scorcher', 'Base'], ['Ice Sword', 'EX'], ['Ancient Scimitar', 'Army'], ['Fire Fan', 'Army']]);
    expect(equipment.slice(11, 15).map((c) => c.id)).toEqual(['eight-trigrams', 'black-shield', 'silver-lion', 'wood-armor']);
    expect(equipment.filter((c) => c.inGame).map((c) => c.id)).toEqual(['axe', 'black-pommel', 'crossbow', 'gender-swords', 'green-dragon-blade', 'longbow', 'serpent-spear', 'sky-scorcher', 'ice-sword', 'ancient-scimitar', 'eight-trigrams', 'black-shield', 'silver-lion', 'wood-armor', 'da-yuan', 'di-lu', 'red-hare', 'shadow-runner', 'storm-runner', 'zi-xing', 'hua-liu']);
  });

  it('reports data gaps as null or empty, never guessed (Review Focus 2)', () => {
    const redHare = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    expect(redHare).toMatchObject({ name: 'Red Hare', nameZh: '赤兔', text: null, range: null, count: 1, printings: [{ suit: 'heart', rank: 5 }] });
    expect(wikiCards('equipment').find((c) => c.id === 'axe')!.range).toBe(3);
  });

  it('lists the 15 tools, with the playable ones in the game and their printings', () => {
    const tools = wikiCards('tool');
    expect(tools).toHaveLength(15);
    expect(tools.filter((c) => c.inGame).map((c) => c.id)).toEqual(['barbarians', 'break', 'capture', 'coerce', 'draw-two', 'duel', 'hail-of-arrows', 'harvest', 'lightning', 'peach-garden', 'steal', 'wuxie', 'blaze', 'chains', 'starvation']);
    const duel = tools.find((c) => c.id === 'duel')!;
    expect(duel.count).toBe(3);
    expect(duel.printings).toEqual([{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }]);
  });

  it('includes the crawled EX and Army cards; Blaze and Chains are in the game, Fire Fan is not', () => {
    const all = [...wikiCards('tool'), ...wikiCards('equipment')];
    const ids = ['blaze', 'chains', 'ancient-scimitar', 'fire-fan', 'ice-sword', 'wood-armor', 'black-shield'];
    for (const id of ids) {
      const card = all.find((c) => c.id === id)!;
      expect(card).toBeDefined();
      expect(card.nameZh).toMatch(/[\u4e00-\u9fff]/);
    }
    expect(['blaze', 'chains', 'fire-fan'].map((id) => all.find((c) => c.id === id)!.inGame)).toEqual([true, true, false]);
    expect(all.find((c) => c.id === 'chains')).toMatchObject({ count: 6, nameZh: '铁索连环' });
    expect(all.find((c) => c.id === 'ice-sword')).toMatchObject({ range: 2, subtype: 'weapon' });
    expect(all.find((c) => c.id === 'black-shield')!.printings).toEqual([{ suit: 'club', rank: 2 }]);
  });

  it('states the rules of Chains, Blaze and Wood Armor, in English and Vietnamese', () => {
    const text = (id: string) => [...wikiCards('tool'), ...wikiCards('equipment')].find((c) => c.id === id)!.text!;
    expect(text('chains')).toMatch(/Recast/);
    expect(text('chains')).toMatch(/fire or thunder damage/);
    expect(text('blaze')).toMatch(/1 fire damage/);
    expect(text('wood-armor')).toMatch(/fire damage the wearer takes is increased by 1/i);
    expect(cardDisplayData('chains', 'vi')!.text).toMatch(/sát thương lửa hoặc sét/);
    expect(cardDisplayData('blaze', 'vi')!.text).toMatch(/1 sát thương lửa/);
    expect(cardDisplayData('wood-armor', 'vi')!.text).toMatch(/sát thương lửa người mặc phải chịu tăng thêm 1/i);
  });

  it('lists Silver Lion as in-game armour with its single printing', () => {
    const lion = wikiCards('equipment').find((c) => c.id === 'silver-lion')!;
    expect(lion.inGame).toBe(true);
    expect(lion.printings).toEqual([{ suit: 'club', rank: 1 }]);
  });
});

describe('wiki tabs', () => {
  const summary = (tabs: { key: string; label: string; entries: unknown[] }[]) => tabs.map((t) => [t.key, t.label, t.entries.length]);

  it('splits generals into Wei, Shu, Wu and Qun', () => {
    const tabs = wikiGeneralTabs();
    expect(summary(tabs)).toEqual([['wei', 'Wei', 15], ['shu', 'Shu', 15], ['wu', 'Wu', 15], ['qun', 'Qun', 12]]);
    expect(tabs[3].entries.every((g) => g.kingdom === 'Qun')).toBe(true);
    expect(tabs.map((t) => t.entries[0].name)).toEqual(['Cao Cao', 'Liu Bei', 'Sun Quan', 'Zhang Jiao']);
  });

  it('gives each basic card its own tab, the fire and lightning Slash right after Slash', () => {
    const tabs = wikiCardTabs('basic');
    expect(summary(tabs)).toEqual([
      ['sha', 'Slash', 1], ['fire-attack', 'Fire Attack', 1], ['lightning-attack', 'Lightning Attack', 1],
      ['shan', 'Dodge', 1], ['wine', 'Wine', 1], ['peach', 'Peach', 1],
    ]);
    expect(tabs.map((t) => t.entries[0].id)).toEqual(['sha', 'fire-attack', 'lightning-attack', 'shan', 'wine', 'peach']);
  });

  it('splits equipment into Weapons, Armors and the two kinds of mount', () => {
    const tabs = wikiCardTabs('equipment');
    expect(summary(tabs)).toEqual([
      ['weapons', 'Weapons', 11], ['armors', 'Armors', 4], ['defensive-mount', 'Defensive Mount', 4], ['offensive-mount', 'Offensive Mount', 3],
    ]);
    expect(tabs[2].entries.map((c) => c.id)).toEqual(['di-lu', 'shadow-runner', 'storm-runner', 'hua-liu']);
    expect(tabs[3].entries.map((c) => c.id)).toEqual(['da-yuan', 'red-hare', 'zi-xing']);
  });

  it('splits Tools into Instant and Delayed', () => {
    const tabs = wikiCardTabs('tool');
    expect(summary(tabs)).toEqual([['instant', 'Instant', 12], ['delayed', 'Delayed', 3]]);
    expect(tabs[1].entries.map((c) => c.id)).toEqual(['capture', 'lightning', 'starvation']);
  });

  it('puts unclaimed entries in a trailing tab (Review Focus 4)', () => {
    const base = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    const card = (patch: Partial<WikiCard>): WikiCard => ({ ...base, ...patch });
    const tabs = equipmentTabs([
      card({ id: 'mystery-horse', name: 'Mystery Horse', mount: null }),
      card({ id: 'jade-seal', name: 'Jade Seal', subtype: 'treasure', mount: null }),
    ]);
    expect(summary(tabs)).toEqual([
      ['weapons', 'Weapons', 0], ['armors', 'Armors', 0], ['defensive-mount', 'Defensive Mount', 0], ['offensive-mount', 'Offensive Mount', 0],
      ['other-mounts', 'Other Mounts', 1], ['treasures', 'Treasures', 1],
    ]);
  });
});

describe('wiki Generals: gender and Lord skills', () => {
  const general = (id: string) => wikiGenerals().find((g) => g.id === id)!;

  it('shows each General’s gender', () => {
    expect(general('diao-chan').gender).toBe('female');
    expect(general('lu-bu').gender).toBe('male');
  });

  it('flags the Lord skills, which Kingdom War doesn’t use', () => {
    expect(general('liu-bei').skills.map((s) => [s.name, s.lord])).toEqual([['Kindness', false], ['Fierce General', true]]);
    const lords = wikiGenerals().flatMap((g) => g.skills.filter((s) => s.lord).map((s) => s.name)).sort();
    expect(lords).toEqual(['Amber Sky', 'Bloodline', 'Escort', 'Exaltation', 'Fierce General', 'Rescued', 'Seem Foolish', 'Takeover', 'Violent Tyrant']);
  });
});

describe('skill status', () => {
  it('turns a skill name into the id its code uses', () => {
    expect(skillIdFromName('Evil Hero')).toBe('evil-hero');
    expect(skillIdFromName("Heaven's Envy")).toBe('heavens-envy');
    expect(skillIdFromName('  Sky -- Scorcher! ')).toBe('sky-scorcher');
  });

  it('is working when the game has code for it, whatever the case or apostrophes', () => {
    const coded = new Set(['evil-hero', 'heavens-envy']);
    expect(skillStatus({ name: 'Evil Hero', lord: false }, coded)).toBe('working');
    expect(skillStatus({ name: "Heaven's Envy", lord: false }, coded)).toBe('working');
  });

  it('is not in the game yet when there is no code for it', () => {
    expect(skillStatus({ name: 'Evil Hero', lord: false }, new Set())).toBe('missing');
  });

  it('is a Lord skill, not used in Kingdom War, whether or not it has code', () => {
    expect(skillStatus({ name: 'Escort', lord: true }, new Set())).toBe('lord');
    expect(skillStatus({ name: 'Escort', lord: true }, new Set(['escort']))).toBe('lord');
  });

  it('puts a General’s skills in the game only when it has code and none of its skills is missing', () => {
    expect(generalSkillsInGame(true, [{ status: 'working' }, { status: 'lord' }])).toBe(true);
    expect(generalSkillsInGame(true, [{ status: 'working' }, { status: 'missing' }])).toBe(false);
    expect(generalSkillsInGame(false, [])).toBe(false);
  });

  it('finds code for every skill of every General in the data, so none reads as not in the game by accident', () => {
    const missing = wikiGenerals().flatMap((g) => g.skills.filter((s) => s.status === 'missing').map((s) => `${g.id}: ${s.name}`));
    expect(missing).toEqual([]);
  });

  it('counts the skills: 91 working and 9 Lord', () => {
    const skills = wikiGenerals().flatMap((g) => g.skills);
    expect(skills.filter((s) => s.status === 'working')).toHaveLength(91);
    expect(skills.filter((s) => s.status === 'lord')).toHaveLength(9);
    expect(skills.every((s) => (s.status === 'lord') === s.lord)).toBe(true);
  });
});

describe('Alternate wikiCards', () => {
  const byId = (cards: WikiCard[], id: string) => cards.find((c) => c.id === id)!;
  const all = (deck: 'default' | 'alternate') => (['basic', 'tool', 'equipment'] as const).flatMap((c) => wikiCards(c, deck));

  it('lists the Alternate deck’s cards by category', () => {
    expect(wikiCards('basic', 'alternate')).toHaveLength(6);
    expect(wikiCards('tool', 'alternate')).toHaveLength(19);
    expect(wikiCards('equipment', 'alternate')).toHaveLength(20);
  });

  it('marks every card with its deck, and only Alternate cards lack a pack', () => {
    expect(all('alternate').every((c) => c.deck === 'alternate' && c.expansion === null)).toBe(true);
    expect(all('default').every((c) => c.deck === 'default' && c.expansion !== null)).toBe(true);
  });

  it('shows the Alternate copies, not Default’s', () => {
    expect(byId(wikiCards('basic', 'alternate'), 'sha').count).toBe(21);
    expect(byId(wikiCards('basic'), 'sha').count).toBe(30);
    expect(byId(wikiCards('basic', 'alternate'), 'sha').printings).toHaveLength(21);
  });

  it('takes the English name and text from Default when the card exists there', () => {
    const pommel = byId(wikiCards('equipment', 'alternate'), 'black-pommel');
    expect(pommel).toMatchObject({ name: 'Black Pommel', nameZh: '青釭剑', range: 2, subtype: 'weapon', category: 'equipment' });
    expect(pommel.text).toBe(byId(wikiCards('equipment'), 'black-pommel').text);
  });

  it('keeps Default’s English text for Slash', () => {
    const sha = byId(wikiCards('basic', 'alternate'), 'sha');
    expect(sha.text).toBe(byId(wikiCards('basic'), 'sha').text);
  });

  it('names a card Default lacks from ids.json and gives it its English text from texts.en.json', () => {
    const wuxieGuo = byId(wikiCards('tool', 'alternate'), 'wuxie-guo');
    expect(wuxieGuo).toMatchObject({ name: 'Wuxie Kingdom', inGame: false });
    expect(wuxieGuo.text).toContain('Kingdom');
    expect(byId(wikiCards('tool', 'alternate'), 'ally-far-attack-near').name).toBe('Ally Far Attack Near');
    for (const id of ['amass', 'ascertain', 'ally-far-attack-near']) expect(byId(wikiCards('tool', 'alternate'), id).text).toBeTruthy();
    const weapons = wikiCards('equipment', 'alternate');
    expect(byId(weapons, 'wu-six-swords')).toMatchObject({ name: 'Six Swords of Wu', range: 2 });
    for (const id of ['wu-six-swords', 'trident-glaive']) expect(byId(weapons, id).text).toBeTruthy();
  });

  it('is in the game only when the game has behaviour for the card: five are not', () => {
    const notInGame = all('alternate').filter((c) => !c.inGame).map((c) => c.id).sort();
    expect(notInGame).toEqual(['ally-far-attack-near', 'amass', 'ascertain', 'fire-fan', 'wuxie-guo']);
  });

  it('shows mounts as Default does', () => {
    expect(byId(wikiCards('equipment', 'alternate'), 'red-hare')).toMatchObject({ subtype: 'horse', mount: 'offensive' });
  });

  it('splits the Alternate equipment and tools into tabs with nothing left over', () => {
    expect(wikiCardTabs('equipment', 'alternate').map((t) => t.key)).not.toContain('other');
    const tools = wikiCardTabs('tool', 'alternate');
    expect(tools.map((t) => t.key)).toEqual(['instant', 'delayed']);
    expect(tools[1].entries.map((c) => c.id).sort()).toEqual(['capture', 'lightning', 'starvation']);
  });
});
