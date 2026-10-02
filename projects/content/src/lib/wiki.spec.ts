import { equipmentTabs, wikiCardTabs, wikiCards, wikiGeneralTabs, wikiGenerals, WikiCard } from './wiki';

describe('wikiGenerals', () => {
  const generals = wikiGenerals();

  it('lists every general with data, grouped by kingdom then sorted by name', () => {
    expect(generals).toHaveLength(57);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(generals.filter((g) => g.kingdom === 'Wei').map((g) => g.name)).toEqual([
      'Cao Cao', 'Cao Pi', 'Cao Ren', 'Deng Ai', 'Dian Wei', 'Guo Jia', 'Sima Yi', 'Xiahou Dun',
      'Xiahou Yuan', 'Xu Chu', 'Xu Huang', 'Xun Yu', 'Zhang He', 'Zhang Liao', 'Zhen Ji',
    ]);
  });

  it('marks exactly the generals whose skills are coded', () => {
    expect(generals.filter((g) => g.skillsInGame).map((g) => g.id).sort()).toEqual(
      ['huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang']
    );
  });

  it('carries names, title, HP and skills from the data file', () => {
    const caoCao = generals.find((g) => g.id === 'cao-cao')!;
    expect(caoCao).toMatchObject({
      name: 'Cao Cao', nameZh: '曹操', title: 'Martial Emperor of Wei', titleZh: '魏武帝', kingdom: 'Wei', maxHp: 4, skillsInGame: false,
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
      name: 'Godspeed', nameZh: '神速',
      text: 'During his turn, Xiahou Yuan can exercise either or both of the following options to attack any character regardless of their distance from him: Skip his judgment and drawing phases. Skip his action phase and discard any equipment card.',
    }]);
  });
});

describe('wikiCards', () => {
  it('lists the basic cards by name; Wine is not in the game', () => {
    const basic = wikiCards('basic');
    expect(basic.map((c) => c.name)).toEqual(['Peach', 'Sha', 'Shan', 'Wine']);
    expect(basic.filter((c) => !c.inGame).map((c) => c.id)).toEqual(['wine']);
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
      'da-yuan': 'minus', 'di-lu': 'plus', 'red-hare': 'minus', 'shadow-runner': 'plus', 'storm-runner': 'plus', 'zi-xing': 'minus',
    });
    expect(equipment.filter((c) => c.subtype !== 'horse').every((c) => c.mount === null)).toBe(true);
  });

  it('marks exactly Capture and Lightning as delayed', () => {
    expect(wikiCards('trick').filter((c) => c.delayed).map((c) => c.id)).toEqual(['capture', 'lightning']);
    expect([...wikiCards('basic'), ...wikiCards('equipment')].some((c) => c.delayed)).toBe(false);
  });

  it('lists equipment by subtype then name, with only Green Dragon Blade in the game', () => {
    const equipment = wikiCards('equipment');
    expect(equipment).toHaveLength(15);
    expect(equipment.map((c) => c.subtype)).toEqual([...Array(8).fill('weapon'), 'armor', ...Array(6).fill('horse')]);
    expect(equipment.slice(0, 3).map((c) => c.name)).toEqual(['Axe', 'Black Pommel', 'Crossbow']);
    expect(equipment.filter((c) => c.inGame).map((c) => c.id)).toEqual(['green-dragon-blade']);
  });

  it('reports data gaps as null or empty, never guessed (Review Focus 2)', () => {
    const redHare = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    expect(redHare).toMatchObject({ name: 'Red Hare', nameZh: '赤兔', text: null, range: null, count: null, printings: [] });
    expect(wikiCards('equipment').find((c) => c.id === 'axe')!.range).toBe(3);
  });

  it('lists the 12 tools, with Duel and Wuxie in the game and their printings', () => {
    const tools = wikiCards('trick');
    expect(tools).toHaveLength(12);
    expect(tools.filter((c) => c.inGame).map((c) => c.id)).toEqual(['duel', 'wuxie']);
    const duel = tools.find((c) => c.id === 'duel')!;
    expect(duel.count).toBe(3);
    expect(duel.printings).toEqual([{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }]);
  });

  it('never lists Silver Lion, which has no data file', () => {
    for (const category of ['basic', 'equipment', 'trick'] as const) {
      expect(wikiCards(category).some((c) => c.id === 'silver-lion')).toBe(false);
    }
  });
});

describe('wiki tabs', () => {
  const summary = (tabs: { key: string; label: string; entries: unknown[] }[]) => tabs.map((t) => [t.key, t.label, t.entries.length]);

  it('splits generals into Wei, Shu, Wu and Heroes', () => {
    const tabs = wikiGeneralTabs();
    expect(summary(tabs)).toEqual([['wei', 'Wei', 7], ['shu', 'Shu', 7], ['wu', 'Wu', 8], ['heroes', 'Heroes', 4]]);
    expect(tabs[3].entries.every((g) => g.kingdom === 'Qun')).toBe(true);
    expect(tabs[0].entries[0].name).toBe('Cao Cao');
  });

  it('gives each basic card its own tab, in the order Sha, Shan, Wine, Peach', () => {
    const tabs = wikiCardTabs('basic');
    expect(summary(tabs)).toEqual([['sha', 'Sha', 1], ['shan', 'Shan', 1], ['wine', 'Wine', 1], ['peach', 'Peach', 1]]);
    expect(tabs.map((t) => t.entries[0].id)).toEqual(['sha', 'shan', 'wine', 'peach']);
  });

  it('splits equipment into Weapons, Armors and the two kinds of mount', () => {
    const tabs = wikiCardTabs('equipment');
    expect(summary(tabs)).toEqual([
      ['weapons', 'Weapons', 8], ['armors', 'Armors', 1], ['plus-mount', 'Plus Mount', 3], ['minus-mount', 'Minus Mount', 3],
    ]);
    expect(tabs[2].entries.map((c) => c.id)).toEqual(['di-lu', 'shadow-runner', 'storm-runner']);
    expect(tabs[3].entries.map((c) => c.id)).toEqual(['da-yuan', 'red-hare', 'zi-xing']);
  });

  it('splits Tools into Instant and Delayed', () => {
    const tabs = wikiCardTabs('trick');
    expect(summary(tabs)).toEqual([['instant', 'Instant', 10], ['delayed', 'Delayed', 2]]);
    expect(tabs[1].entries.map((c) => c.id)).toEqual(['capture', 'lightning']);
  });

  it('puts unclaimed entries in a trailing tab (Review Focus 4)', () => {
    const base = wikiCards('equipment').find((c) => c.id === 'red-hare')!;
    const card = (patch: Partial<WikiCard>): WikiCard => ({ ...base, ...patch });
    const tabs = equipmentTabs([
      card({ id: 'mystery-horse', name: 'Mystery Horse', mount: null }),
      card({ id: 'jade-seal', name: 'Jade Seal', subtype: 'treasure', mount: null }),
    ]);
    expect(summary(tabs)).toEqual([
      ['weapons', 'Weapons', 0], ['armors', 'Armors', 0], ['plus-mount', 'Plus Mount', 0], ['minus-mount', 'Minus Mount', 0],
      ['other-mounts', 'Other mounts', 1], ['treasures', 'Treasures', 1],
    ]);
  });
});
