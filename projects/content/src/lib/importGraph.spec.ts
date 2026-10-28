import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

// display.ts and the bots read variant ids through kingdomWarsBase.ts. If display.ts could reach the variant
// files again, mountain.ts (which imports display.ts) would form an import cycle with them.
const LIB = __dirname;
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\b[^;'"]*?from\s*'([^']+)'|(?:^|\n)\s*import\s*'([^']+)'/g;

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) if (existsSync(candidate)) return candidate;
  return null;
}

export function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(STATIC_IMPORT)) {
      const next = resolveImport(file, match[1] ?? match[2]);
      if (next) queue.push(next);
    }
  }
  seen.delete(entry);
  return seen;
}

describe('content import graph', () => {
  it('display.ts reaches no General file, kingdomWarsVariants.ts or kingdomWarsSkills.ts', () => {
    const reached = [...reachableFrom(join(LIB, 'display.ts'))].map((f) => relative(LIB, f));
    expect(reached).toContain('kingdomWarsBase.ts');
    const forbidden = reached.filter((f) => f.startsWith('generals/') || f === 'kingdomWarsVariants.ts' || f === 'kingdomWarsSkills.ts');
    expect(forbidden).toEqual([]);
  });
});
