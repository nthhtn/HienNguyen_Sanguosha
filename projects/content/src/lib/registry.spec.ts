import { buildContentRegistry } from './registry';

describe('buildContentRegistry', () => {
  it('registers all seven cards and six generals from this content pack', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.keys()].sort()).toEqual(
      ['duel', 'green-dragon-blade', 'peach', 'sha', 'shan', 'silver-lion', 'wuxie'].sort()
    );
    expect([...registry.generals.keys()].sort()).toEqual(
      ['dong-zhuo', 'huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang'].sort()
    );
  });
});
