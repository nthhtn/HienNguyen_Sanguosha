import { Action } from '../pipeline/actions';

// The fields a player fills in on an offered template. The engine checks them
// when it resolves the action.
function freeKeys(offered: Action): readonly string[] {
  switch (offered.kind) {
    case 'SelectAction':
      return ['ids'];
    case 'ArrangeCardsAction':
      return ['top', 'bottom'];
    case 'PlayCardAction':
    case 'UseConversionAction':
      return offered.pickTargets ? ['targets', 'pickTargets'] : [];
    default:
      return [];
  }
}

// Structural equality for plain data (what JSON carries), ignoring key order.
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameValue(left[key], right[key]));
}

// Whether `action` is one the engine offered in `legal`: the same action, or
// an offered template with only its free fields filled in. A remote player may
// submit only what it was offered, because resolve trusts its caller on this
// (it would deal cards for a DrawCardsAction from anyone).
export function isOfferedAction(action: Action, legal: readonly Action[]): boolean {
  return legal.some((offered) => {
    if (offered.kind !== action.kind) return false;
    const free = new Set(freeKeys(offered));
    const submitted = action as Record<string, unknown>;
    const expected = offered as Record<string, unknown>;
    const keys = new Set([...Object.keys(submitted), ...Object.keys(expected)]);
    return [...keys].every((key) => free.has(key) || sameValue(submitted[key], expected[key]));
  });
}
