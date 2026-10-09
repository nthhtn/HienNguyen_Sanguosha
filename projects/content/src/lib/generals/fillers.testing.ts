import type { ContentRegistry } from 'engine';

// Test-only stand-ins for real Generals the specs once used as skill-less
// fillers: `filler-<id>` has the original's kingdom, gender and max HP, and no
// skills, so a later stage giving the original skills changes no spec. Never
// part of the real registry.
export const FILLER_IDS: readonly string[] = [
  'cai-wenji', 'cao-pi', 'deng-ai', 'dian-wei', 'dong-zhuo', 'jia-xu', 'jiang-wei', 'liu-shan',
  'lu-su', 'meng-huo', 'pang-de', 'pang-tong', 'sun-ce', 'sun-jian', 'taishi-ci', 'xu-huang',
  'xun-yu', 'yuan-shao', 'zhang-he', 'zhang-zhao-and-zhang-hong', 'zhu-rong', 'zuo-ci',
];

export function withFillers(registry: ContentRegistry): ContentRegistry {
  for (const id of FILLER_IDS) {
    const real = registry.generals.get(id);
    if (!real) throw new Error(`No General ${id} to make a filler from`);
    registry.generals.set(`filler-${id}`, { id: `filler-${id}`, kingdom: real.kingdom, maxHp: real.maxHp, ...(real.gender ? { gender: real.gender } : {}), skills: [] });
  }
  return registry;
}
