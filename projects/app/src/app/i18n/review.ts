// Which Vietnamese entries a native speaker has reviewed. Everything starts as a draft; an entry
// is reviewed once its id is listed in `review.json`. Nothing is blocked on review: drafts display
// like any other text, and this only reports how many are left.

export interface ReviewLists {
  ui: string[];
  generals: string[];
  cards: string[];
  prose: Record<string, string[]>;
}

// Every id that exists in the catalogs and data, given the English prose tables.
export function reviewUniverse(en: Record<string, string>, generalIds: string[], cardIds: string[], proseTables: Record<string, object>): ReviewLists {
  return {
    ui: Object.keys(en),
    generals: generalIds,
    cards: cardIds,
    prose: Object.fromEntries(Object.entries(proseTables).map(([table, entries]) => [table, Object.keys(entries)])),
  };
}

export interface CategoryStatus {
  category: string;
  total: number;
  reviewed: number;
  unreviewed: string[];
  // Ids the review file lists that no longer exist.
  unknown: string[];
}

function status(category: string, universe: readonly string[], reviewedIds: readonly string[]): CategoryStatus {
  const known = new Set(universe);
  const reviewed = new Set(reviewedIds);
  return {
    category,
    total: universe.length,
    reviewed: universe.filter((id) => reviewed.has(id)).length,
    unreviewed: universe.filter((id) => !reviewed.has(id)),
    unknown: reviewedIds.filter((id) => !known.has(id)),
  };
}

// One status per category: `universe` holds every id that exists, `review` the reviewed ones.
export function reviewStatus(review: ReviewLists, universe: ReviewLists): CategoryStatus[] {
  return [
    status('UI messages', universe.ui, review.ui),
    status('Generals (name, title and skills)', universe.generals, review.generals),
    status('Cards (name and text)', universe.cards, review.cards),
    ...Object.keys(universe.prose).map((table) => status(`Prose: ${table}`, universe.prose[table], review.prose[table] ?? [])),
    // A table the review file lists that no longer exists: all of its ids are unknown.
    ...Object.keys(review.prose)
      .filter((table) => !Object.prototype.hasOwnProperty.call(universe.prose, table))
      .map((table) => status(`Prose: ${table}`, [], review.prose[table])),
  ];
}
