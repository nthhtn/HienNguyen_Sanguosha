# Side Navigation and Wiki Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move navigation into a left side panel, and split every Wiki page into tabs. This also adds the data the new tabs need: each horse's mount direction, which Tools are delayed, and a Wine card.

**Architecture:**
- **Data:** new facts go into the per-card JSON files, each with its source recorded.
- **Content** (`wiki.ts`) splits entries into tabs with pure helpers. The app never decides which tab a card belongs to.
- **Wiki pages** render a Material tab group, and the selected tab is kept in a `tab` query parameter.
- **The shell** replaces the header menu with a side panel. It is a sticky `<aside>` from 1024px up and a slide-in drawer below that.

**Tech Stack:** TypeScript, Angular 22 (standalone, signals, zoneless tests), Angular Material (list, tabs, toolbar, icon, button), `@angular/cdk/layout`, Jest.

**Spec:** `docs/superpowers/specs/2026-10-02-side-nav-and-wiki-tabs-design.md` (it revises `2026-10-02-navigation-and-wiki-design.md`).

## Global Constraints

- Tabs, keys and labels, in order:
  - Generals: `wei` Wei · `shu` Shu · `wu` Wu · `heroes` Heroes (the Heroes tab holds kingdom `'Qun'`).
  - Basic: `sha` Sha · `shan` Shan · `wine` Wine · `peach` Peach.
  - Equipment: `weapons` Weapons · `armors` Armors · `plus-mount` Plus Mount · `minus-mount` Minus Mount. Optional trailing tabs, shown only when they have entries: `other-mounts` Other mounts, `treasures` Treasures.
  - Tools: `instant` Instant · `delayed` Delayed.
  - Any entry no tab claims goes in a trailing `other` tab labelled Other.
- Tab label text: `<Label> (<count>)`. An empty tab shows "Nothing here yet".
- The URL query parameter is `tab=<key>`. A missing or unknown value selects the first tab. Changing tabs uses `replaceUrl: true`.
- Data facts:
  - plus mounts: di-lu, shadow-runner, storm-runner;
  - minus mounts: red-hare, da-yuan, zi-xing (both read from the printed "+1" / "−1" on the card art);
  - delayed Tools: capture, lightning (from the spreadsheet's "Delay Tool" type).
- Wine:
  - name `Wine`, nameZh `酒`, count 5;
  - printings ♠3 ♠9 ♣3 ♣9 ♦9;
  - text: `When a player is on the brink of death, that player can use play wine to restore one health. Also any player can play this card once during their turn. If they do, the damage of the next attack is increased by one.` This is verbatim, including the source's "use play wine";
  - source url `https://sites.google.com/site/englishsanguosha/expansions/original/army/wine`, with `expansion: "Army"`.
- Counts:
  - Generals: Wei 7 · Shu 7 · Wu 8 · Heroes 4;
  - Basic: 1 per tab;
  - Equipment: 8 · 1 · 3 · 3;
  - Tools: 10 · 2.
- Side panel:
  - From 1024px (`(min-width: 1024px)` via `BreakpointObserver`) it is always shown: 240px wide, sticky under the 64px header.
  - Below 1024px it is hidden, and the ☰ button (`aria-label="Open navigation"`) opens a drawer over the page with a backdrop. A link, the backdrop or Escape closes it.
- Current link: `aria-current="page"`. Play Game is current on `/setup` and `/game`.
- No Material `mat-sidenav`: its container sets `overflow: hidden`, which breaks the sticky phase indicator and window scrolling.
- Tests: `npx jest --selectProjects <content|app> --testPathPatterns <pattern>`; full suite `npx jest`; build `npx ng build app` (no warnings, initial total under 500 kB).
- Commits end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A deep link to a tab** (`/wiki/equipment?tab=minus-mount`), whether refreshed or shared, must open that tab, not the first. Pinned in Task 3, "opens the tab named in the URL".
2. **A junk `tab=` value** must fall back to the first tab, never a blank page. Pinned in Task 3, "falls back to the first tab for an unknown tab".
3. **The narrow drawer must not trap the user:** a link, the backdrop and Escape all close it, and a hidden drawer can't be tabbed into. Pinned in Task 4, the drawer tests, which include `inert`.
4. **New data must not be silently dropped:** a horse without a mount, or a basic card without its own tab, must still appear. Pinned in Task 2, "puts unclaimed entries in a trailing tab".
5. **The game board must still fit beside the 240px panel** at 1024px. Checked live in Task 5.

---

### Task 1: Data for mounts, delayed Tools and Wine

**Files:**
- Modify: `projects/content/data/cards/equipment/horse/*.json` (6 files)
- Modify: `projects/content/data/cards/tool/capture.json` and `projects/content/data/cards/tool/lightning.json`
- Create: `projects/content/data/cards/basic/wine.json`
- Modify: `projects/content/data/cards/index.ts`
- Modify: `projects/content/assets/manifest.json` (via the crawler)
- Modify: `projects/content/src/lib/wiki.ts` (`WikiCard` gains `mount` and `delayed`)
- Modify: `docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md` (open item 6)
- Test: `projects/content/src/lib/wiki.spec.ts`

**Interfaces:**
- Produces:
  - `CardFileData` gains `mount?: 'plus' | 'minus'`, `delayed?: true`, and `source.mountFrom?: string` / `source.expansion?: string`.
  - `WikiCard` gains `mount: 'plus' | 'minus' | null` and `delayed: boolean`.
  - `cardsData['wine']` exists, with category `'basic'`.

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/wiki.spec.ts`, replace the test "lists the basic cards by name, all in the game" with:

```ts
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
    expect(wikiCards('tool').filter((c) => c.delayed).map((c) => c.id)).toEqual(['capture', 'lightning']);
    expect([...wikiCards('basic'), ...wikiCards('equipment')].some((c) => c.delayed)).toBe(false);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects content --testPathPatterns wiki`
Expected: FAIL. There is no Wine, and `mount` and `delayed` are undefined.

- [ ] **Step 3: Write the data**

Run from the repo root:

```bash
python3 - <<'EOF'
import json, pathlib
root = pathlib.Path('projects/content/data/cards')

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')

def edit(rel, **fields):
    path = root / rel
    data = json.loads(path.read_text(encoding='utf-8'))
    for key, value in fields.items():
        if key == 'source':
            data['source'].update(value)
        else:
            data[key] = value
    write(path, data)

# Printed "+1" / "-1" on each horse's own card art (the source site's Distance
# rules: "The type of Horse is indicated on the card itself").
for horse in ['di-lu', 'shadow-runner', 'storm-runner']:
    edit(f'equipment/horse/{horse}.json', mount='plus', source={'mountFrom': 'card art'})
for horse in ['red-hare', 'da-yuan', 'zi-xing']:
    edit(f'equipment/horse/{horse}.json', mount='minus', source={'mountFrom': 'card art'})

# AllCards spreadsheet Type "Delay Tool".
for tool in ['capture', 'lightning']:
    edit(f'tool/{tool}.json', delayed=True)

# Army expansion page text (verbatim) + AllCards spreadsheet Wine row (Army, Number 5).
write(root / 'basic' / 'wine.json', {
    'count': 5,
    'name': 'Wine',
    'nameZh': '酒',
    'printings': [
        {'rank': 3, 'suit': 'spade'}, {'rank': 9, 'suit': 'spade'},
        {'rank': 3, 'suit': 'club'}, {'rank': 9, 'suit': 'club'},
        {'rank': 9, 'suit': 'diamond'},
    ],
    'source': {
        'crawledAt': '2026-10-02',
        'expansion': 'Army',
        'site': 'English Sanguosha (Jason Keeney and Scott Maresh)',
        'url': 'https://sites.google.com/site/englishsanguosha/expansions/original/army/wine',
    },
    'text': 'When a player is on the brink of death, that player can use play wine to restore one health. Also any player can play this card once during their turn. If they do, the damage of the next attack is increased by one.',
})
EOF
git diff --stat projects/content/data
```

Expected: 8 files modified and `basic/wine.json` untracked. Each horse diff adds only `mount` and `source.mountFrom`, and each delayed tool adds only `delayed`.

- [ ] **Step 4: Register Wine and the new fields**

In `projects/content/data/cards/index.ts`:
- Add `import wineBasic from './basic/wine.json';` in alphabetical position among the imports (after `stormRunnerEquipmentHorse`).
- In `CardFileData`, add the new fields and widen `source`:

```ts
  mount?: 'plus' | 'minus'; // horses only: the printed +1 / -1 on the card art
  delayed?: true; // tools only: a delayed ("Delay Tool") card
  source: { url: string; site: string; crawledAt: string; expansion?: string; mountFrom?: string };
```

- Add the entry in alphabetical position (after `'storm-runner'`):

```ts
  'wine': { ...(wineBasic as CardFileData), category: 'basic' },
```

- [ ] **Step 5: Expose the fields in Wiki cards**

In `projects/content/src/lib/wiki.ts`, add to `WikiCard` (after `printings`):

```ts
  mount: NonNullable<CardData['mount']> | null;
  delayed: boolean;
```

In `wikiCards`'s `.map(...)`, add after `printings: data.printings ?? [],`:

```ts
      mount: data.mount ?? null,
      delayed: data.delayed === true,
```

- [ ] **Step 6: Fetch Wine's art**

Run: `python3 scripts/crawl-assets.py --only wine`
Expected: `Crawled wine: cards/basic/wine.jpg (...)` and `Done: 1 crawled, 0 skipped.` `projects/content/assets/manifest.json` gains a `"wine"` entry. The image itself is gitignored.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 8: Close the pipeline spec's open item**

In `docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md`, append to open item 6 ("Delayed tools are not distinguished in the data"):

```markdown
   **Resolved 2026-10-02** (see `2026-10-02-side-nav-and-wiki-tabs-design.md`)
   with a field, not a folder: `capture.json` and `lightning.json` carry
   `"delayed": true` (from the spreadsheet's "Delay Tool" type). Horses
   likewise carry `"mount": "plus" | "minus"`, read from the printed +1/-1
   on each card's art. Wine (Army expansion) is the first non-Base card, with
   `source.expansion: "Army"`.
```

- [ ] **Step 9: Run the whole suite**

Run: `npx jest`
Expected: PASS. No other test counts basic cards. If one does, update it to 4 and name it in the commit message.

- [ ] **Step 10: Commit**

```bash
git add projects/content/data/cards projects/content/assets/manifest.json projects/content/src/lib/wiki.ts projects/content/src/lib/wiki.spec.ts docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md
git commit -m "feat(content): mount direction for horses, delayed Tools, and Wine from the Army expansion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tabs in content

**Files:**
- Modify: `projects/content/src/lib/wiki.ts`
- Test: `projects/content/src/lib/wiki.spec.ts`

**Interfaces:**
- Consumes: `wikiGenerals()`, `wikiCards()`, and `WikiCard.mount` / `.delayed` (Task 1).
- Produces, all exported from `content`:

```ts
export interface WikiTab<T> { key: string; label: string; entries: T[] }
export function wikiGeneralTabs(): WikiTab<WikiGeneral>[];
export function wikiCardTabs(category: WikiCard['category']): WikiTab<WikiCard>[];
// Pure splitters, exported so tests can feed synthetic entries:
export function generalTabs(generals: WikiGeneral[]): WikiTab<WikiGeneral>[];
export function basicTabs(cards: WikiCard[]): WikiTab<WikiCard>[];
export function equipmentTabs(cards: WikiCard[]): WikiTab<WikiCard>[];
export function toolTabs(cards: WikiCard[]): WikiTab<WikiCard>[];
```

- [ ] **Step 1: Write the failing tests**

Append to `projects/content/src/lib/wiki.spec.ts`. Change its import line to:

```ts
import { equipmentTabs, wikiCardTabs, wikiCards, wikiGeneralTabs, wikiGenerals, WikiCard } from './wiki';
```

```ts
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
    const tabs = wikiCardTabs('tool');
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects content --testPathPatterns wiki`
Expected: FAIL. `equipmentTabs`, `wikiCardTabs` and `wikiGeneralTabs` are not exported.

- [ ] **Step 3: Implement**

Append to `projects/content/src/lib/wiki.ts`:

```ts
export interface WikiTab<T> {
  key: string;
  label: string;
  entries: T[];
}

interface TabRule<T> {
  key: string;
  label: string;
  holds: (entry: T) => boolean;
  optional?: boolean; // dropped when it holds nothing
}

// Splits entries into the given tabs, in order. Anything no tab claims goes in a
// trailing "Other" tab, so new data is never silently dropped.
function splitIntoTabs<T>(entries: T[], rules: TabRule<T>[]): WikiTab<T>[] {
  const tabs = rules
    .map((rule) => ({ key: rule.key, label: rule.label, entries: entries.filter(rule.holds), optional: rule.optional }))
    .filter((tab) => !tab.optional || tab.entries.length > 0)
    .map(({ key, label, entries: held }) => ({ key, label, entries: held }));
  const unclaimed = entries.filter((entry) => !rules.some((rule) => rule.holds(entry)));
  return unclaimed.length > 0 ? [...tabs, { key: 'other', label: 'Other', entries: unclaimed }] : tabs;
}

export function generalTabs(generals: WikiGeneral[]): WikiTab<WikiGeneral>[] {
  return splitIntoTabs(generals, [
    { key: 'wei', label: 'Wei', holds: (g) => g.kingdom === 'Wei' },
    { key: 'shu', label: 'Shu', holds: (g) => g.kingdom === 'Shu' },
    { key: 'wu', label: 'Wu', holds: (g) => g.kingdom === 'Wu' },
    // The source site calls the fourth faction "Hero"; the engine's kingdom is 'Qun'.
    { key: 'heroes', label: 'Heroes', holds: (g) => g.kingdom === 'Qun' },
  ]);
}

export function basicTabs(cards: WikiCard[]): WikiTab<WikiCard>[] {
  return splitIntoTabs(cards, [
    { key: 'sha', label: 'Sha', holds: (c) => c.id === 'sha' },
    { key: 'shan', label: 'Shan', holds: (c) => c.id === 'shan' },
    { key: 'wine', label: 'Wine', holds: (c) => c.id === 'wine' },
    { key: 'peach', label: 'Peach', holds: (c) => c.id === 'peach' },
  ]);
}

export function equipmentTabs(cards: WikiCard[]): WikiTab<WikiCard>[] {
  return splitIntoTabs(cards, [
    { key: 'weapons', label: 'Weapons', holds: (c) => c.subtype === 'weapon' },
    { key: 'armors', label: 'Armors', holds: (c) => c.subtype === 'armor' },
    { key: 'plus-mount', label: 'Plus Mount', holds: (c) => c.subtype === 'horse' && c.mount === 'plus' },
    { key: 'minus-mount', label: 'Minus Mount', holds: (c) => c.subtype === 'horse' && c.mount === 'minus' },
    { key: 'other-mounts', label: 'Other mounts', holds: (c) => c.subtype === 'horse' && c.mount === null, optional: true },
    { key: 'treasures', label: 'Treasures', holds: (c) => c.subtype === 'treasure', optional: true },
  ]);
}

export function toolTabs(cards: WikiCard[]): WikiTab<WikiCard>[] {
  return splitIntoTabs(cards, [
    { key: 'instant', label: 'Instant', holds: (c) => !c.delayed },
    { key: 'delayed', label: 'Delayed', holds: (c) => c.delayed },
  ]);
}

export function wikiGeneralTabs(): WikiTab<WikiGeneral>[] {
  return generalTabs(wikiGenerals());
}

const CARD_TABS: Record<WikiCard['category'], (cards: WikiCard[]) => WikiTab<WikiCard>[]> = {
  basic: basicTabs,
  equipment: equipmentTabs,
  tool: toolTabs,
};

export function wikiCardTabs(category: WikiCard['category']): WikiTab<WikiCard>[] {
  return CARD_TABS[category](wikiCards(category));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/wiki.ts projects/content/src/lib/wiki.spec.ts
git commit -m "feat(content): split Wiki entries into tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tabs on the Wiki pages

**Files:**
- Create: `projects/app/src/app/wiki/tab-param.ts`
- Modify: `projects/app/src/app/wiki/wiki-generals.ts`
- Modify: `projects/app/src/app/wiki/wiki-cards.ts`
- Test: `projects/app/src/app/wiki/wiki-pages.spec.ts` (rewrite)
- Possibly modify: `jest.setup.app.ts` (see Step 2)

**Interfaces:**
- Consumes: `wikiGeneralTabs`, `wikiCardTabs`, `WikiTab`, `wikiGenerals` and `wikiCards` from `content` (Task 2).
- Produces: `tabQueryParam(keys: readonly string[]): { selectedIndex: Signal<number>; select(index: number): void }`. It must be called in an injection context.

  Pages render `mat-tab-group` with one `mat-tab` per content tab, labelled `<Label> (<count>)`. Content is lazy, so only the active tab's entries are in the DOM.

- [ ] **Step 1: Write the failing tests**

Replace `projects/app/src/app/wiki/wiki-pages.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

async function open(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const el = () => harness.routeNativeElement as HTMLElement;
  return { harness, el, router: TestBed.inject(Router) };
}

const tabLabels = (el: HTMLElement) => [...el.querySelectorAll('[role="tab"]')].map((t) => t.textContent!.trim());
const selectedTab = (el: HTMLElement) => el.querySelector('[role="tab"][aria-selected="true"]')!.textContent!.trim();
const entryIds = (el: HTMLElement) => [...el.querySelectorAll('article.entry')].map((a) => a.getAttribute('data-id'));

describe('Wiki pages', () => {
  it('redirects /wiki to the Generals page', async () => {
    const { router } = await open('/wiki');
    expect(router.url).toBe('/wiki/generals');
  });

  it('shows Generals in Wei, Shu, Wu and Heroes tabs, opening on Wei', async () => {
    const { el } = await open('/wiki/generals');
    expect(el().querySelector('h2')!.textContent).toBe('Generals');
    expect(el().querySelector('.summary')!.textContent).toContain('26 generals · 6 with skills in the game');
    expect(tabLabels(el())).toEqual(['Wei (7)', 'Shu (7)', 'Wu (8)', 'Heroes (4)']);
    expect(selectedTab(el())).toBe('Wei (7)');
    expect(el().querySelectorAll('app-wiki-general-entry')).toHaveLength(7);
  });

  it('shows one tab per basic card', async () => {
    const { el } = await open('/wiki/basic');
    expect(tabLabels(el())).toEqual(['Sha (1)', 'Shan (1)', 'Wine (1)', 'Peach (1)']);
    expect(entryIds(el())).toEqual(['sha']);
  });

  it('opens the tab named in the URL (Review Focus 1)', async () => {
    const { el } = await open('/wiki/equipment?tab=minus-mount');
    expect(tabLabels(el())).toEqual(['Weapons (8)', 'Armors (1)', 'Plus Mount (3)', 'Minus Mount (3)']);
    expect(selectedTab(el())).toBe('Minus Mount (3)');
    expect(entryIds(el())).toEqual(['da-yuan', 'red-hare', 'zi-xing']);
  });

  it('falls back to the first tab for an unknown tab (Review Focus 2)', async () => {
    const { el } = await open('/wiki/equipment?tab=nope');
    expect(selectedTab(el())).toBe('Weapons (8)');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(8);
  });

  it('records the chosen tab in the URL', async () => {
    const { harness, el, router } = await open('/wiki/tools');
    expect(tabLabels(el())).toEqual(['Instant (10)', 'Delayed (2)']);
    (el().querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(router.url).toBe('/wiki/tools?tab=delayed');
    expect(entryIds(el())).toEqual(['capture', 'lightning']);
  });

  it('each card route renders its own category', async () => {
    const { harness, el } = await open('/wiki/basic');
    expect(el().querySelector('h2')!.textContent).toBe('Basic Cards');
    await harness.navigateByUrl('/wiki/tools');
    await harness.fixture.whenStable();
    expect(el().querySelector('h2')!.textContent).toBe('Tools');
    expect(el().querySelector('.summary')!.textContent).toContain('12 cards · 2 in the game');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --testPathPatterns wiki-pages`
Expected: FAIL. There are no `[role="tab"]` elements: the tab-label assertions get `[]`, and `selectedTab` throws on null.

If, after Step 3, any test errors with `ResizeObserver is not defined`, Material's tab header needs it and jsdom lacks it. Append this to `jest.setup.app.ts` and re-run:

```ts
// jsdom has no ResizeObserver; Material's tab header observes its own size.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
```

- [ ] **Step 3: Implement**

Create `projects/app/src/app/wiki/tab-param.ts`:

```ts
import { computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

// Keeps a page's selected tab in the `tab` query parameter, so Back, refresh
// and shared links land on the same tab. A missing or unknown key selects the
// first tab. Call in an injection context.
export function tabQueryParam(keys: readonly string[]): { selectedIndex: Signal<number>; select(index: number): void } {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const tab = toSignal(route.queryParamMap.pipe(map((params) => params.get('tab'))), {
    initialValue: route.snapshot.queryParamMap.get('tab'),
  });
  const selectedIndex = computed(() => Math.max(0, keys.indexOf(tab() ?? '')));
  const select = (index: number) => {
    const key = keys[index];
    if (!key || key === tab()) return;
    void router.navigate([], { relativeTo: route, queryParams: { tab: key }, queryParamsHandling: 'merge', replaceUrl: true });
  };
  return { selectedIndex, select };
}
```

Replace `projects/app/src/app/wiki/wiki-generals.ts` with:

```ts
import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { wikiGeneralTabs, wikiGenerals } from 'content';
import { WikiGeneralEntry } from './wiki-general-entry';
import { tabQueryParam } from './tab-param';

@Component({
  selector: 'app-wiki-generals',
  imports: [MatTabsModule, WikiGeneralEntry],
  template: `
    <h2>Generals</h2>
    <p class="summary">{{ generals.length }} generals · {{ withSkills }} with skills in the game</p>
    <mat-tab-group
      [selectedIndex]="tab.selectedIndex()"
      (selectedIndexChange)="tab.select($event)"
      mat-stretch-tabs="false"
      animationDuration="0ms"
    >
      @for (t of tabs; track t.key) {
        <mat-tab [label]="t.label + ' (' + t.entries.length + ')'">
          <ng-template matTabContent>
            @for (general of t.entries; track general.id) {
              <app-wiki-general-entry [general]="general" />
            } @empty {
              <p class="empty">Nothing here yet</p>
            }
          </ng-template>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary, .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class WikiGenerals {
  protected readonly generals = wikiGenerals();
  protected readonly withSkills = this.generals.filter((g) => g.skillsInGame).length;
  protected readonly tabs = wikiGeneralTabs();
  protected readonly tab = tabQueryParam(this.tabs.map((t) => t.key));
}
```

Replace `projects/app/src/app/wiki/wiki-cards.ts` with:

```ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { wikiCardTabs, wikiCards, WikiCard } from 'content';
import { WikiCardEntry } from './wiki-card-entry';
import { tabQueryParam } from './tab-param';

const PAGE_TITLES: Record<WikiCard['category'], string> = { basic: 'Basic Cards', equipment: 'Equipments', tool: 'Tools' };

// One page per card category; the category comes from the route's data and
// the tabs from content.
@Component({
  selector: 'app-wiki-cards',
  imports: [MatTabsModule, WikiCardEntry],
  template: `
    <h2>{{ title }}</h2>
    <p class="summary">{{ cards.length }} cards · {{ inGame }} in the game</p>
    <mat-tab-group
      [selectedIndex]="tab.selectedIndex()"
      (selectedIndexChange)="tab.select($event)"
      mat-stretch-tabs="false"
      animationDuration="0ms"
    >
      @for (t of tabs; track t.key) {
        <mat-tab [label]="t.label + ' (' + t.entries.length + ')'">
          <ng-template matTabContent>
            @for (card of t.entries; track card.id) {
              <app-wiki-card-entry [card]="card" />
            } @empty {
              <p class="empty">Nothing here yet</p>
            }
          </ng-template>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary, .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class WikiCards {
  private readonly category = inject(ActivatedRoute).snapshot.data['category'] as WikiCard['category'];
  protected readonly title = PAGE_TITLES[this.category];
  protected readonly cards = wikiCards(this.category);
  protected readonly inGame = this.cards.filter((c) => c.inGame).length;
  protected readonly tabs = wikiCardTabs(this.category);
  protected readonly tab = tabQueryParam(this.tabs.map((t) => t.key));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app --testPathPatterns wiki`
Expected: PASS. Apply the `ResizeObserver` stub from Step 2 only if that exact error appears.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/wiki/tab-param.ts projects/app/src/app/wiki/wiki-generals.ts projects/app/src/app/wiki/wiki-cards.ts projects/app/src/app/wiki/wiki-pages.spec.ts
git commit -m "feat(app): tabs on every Wiki page, kept in the URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Also stage `jest.setup.app.ts` if Step 2's stub was needed.)

---

### Task 4: Left side navigation

**Files:**
- Modify: `projects/app/src/app/app.ts`, `projects/app/src/app/app.html`, `projects/app/src/app/app.css`
- Modify: `projects/app/src/styles.scss` (remove the header-menu rule)
- Modify: `docs/superpowers/specs/2026-10-02-side-nav-and-wiki-tabs-design.md` (no `mat-sidenav`; see Step 6)
- Test: `projects/app/src/app/app.spec.ts` (rewrite)

**Interfaces:**
- Consumes: `/play` and `/wiki/...` routes (existing).
- Produces:
  - `aside.side-nav` (class `open` when shown) containing `a.nav-play`, `button.nav-wiki` (with `aria-expanded`) and four `a.nav-sub` links;
  - `button.nav-toggle` (narrow only) and `div.nav-backdrop` (narrow and open only).

- [ ] **Step 1: Write the failing tests**

Replace `projects/app/src/app/app.spec.ts` with:

```ts
import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';

function setup(wide: boolean) {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([
        { path: 'setup', children: [] },
        { path: 'game', children: [] },
        { path: 'play', children: [] },
        { path: 'wiki/:page', children: [] },
      ]),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: wide, breakpoints: {} }), isMatched: () => wide },
      },
    ],
  });
}

async function render(url = '/setup') {
  const fixture = TestBed.createComponent(App);
  await TestBed.inject(Router).navigateByUrl(url);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const refresh = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, el, refresh };
}

const nav = (el: HTMLElement) => el.querySelector('aside.side-nav') as HTMLElement;
const subLinks = (el: HTMLElement) => [...el.querySelectorAll('a.nav-sub')] as HTMLAnchorElement[];

describe('App shell', () => {
  describe('on a wide screen', () => {
    beforeEach(() => setup(true));

    it('shows the title and an always-open side panel with no menu button', async () => {
      const { el } = await render();
      expect(el.querySelector('mat-toolbar h1')!.textContent).toContain('Kingdom War');
      expect(nav(el).classList).toContain('open');
      expect(el.querySelector('button.nav-toggle')).toBeNull();
      expect(nav(el).hasAttribute('inert')).toBe(false);
    });

    it('links Play Game to /play and the Wiki group to its four pages', async () => {
      const { el } = await render();
      expect(el.querySelector('a.nav-play')!.getAttribute('href')).toBe('/play');
      expect(subLinks(el).map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
        ['Generals', '/wiki/generals'],
        ['Basic Cards', '/wiki/basic'],
        ['Equipments', '/wiki/equipment'],
        ['Tools', '/wiki/tools'],
      ]);
    });

    it('marks the current page', async () => {
      const { el } = await render('/setup');
      expect(el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBe('page');
      const wiki = await render('/wiki/basic');
      expect(wiki.el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBeNull();
      expect(subLinks(wiki.el).find((a) => a.textContent!.trim() === 'Basic Cards')!.getAttribute('aria-current')).toBe('page');
    });

    it('collapses and expands the Wiki group', async () => {
      const { el, refresh } = await render();
      const wiki = el.querySelector('button.nav-wiki') as HTMLButtonElement;
      expect(wiki.getAttribute('aria-expanded')).toBe('true');
      wiki.click();
      await refresh();
      expect(wiki.getAttribute('aria-expanded')).toBe('false');
      expect(subLinks(el)).toHaveLength(0);
    });
  });

  describe('on a narrow screen (Review Focus 3)', () => {
    beforeEach(() => setup(false));

    it('hides the panel behind a menu button', async () => {
      const { el } = await render();
      const toggle = el.querySelector('button.nav-toggle')!;
      expect(toggle.getAttribute('aria-label')).toBe('Open navigation');
      expect(nav(el).classList).not.toContain('open');
      expect(nav(el).hasAttribute('inert')).toBe(true);
    });

    it('opens the drawer, and a link closes it', async () => {
      const { el, refresh } = await render();
      (el.querySelector('button.nav-toggle') as HTMLButtonElement).click();
      await refresh();
      expect(nav(el).classList).toContain('open');
      expect(nav(el).hasAttribute('inert')).toBe(false);
      expect(el.querySelector('.nav-backdrop')).not.toBeNull();
      subLinks(el)[3].click();
      await refresh();
      expect(nav(el).classList).not.toContain('open');
      expect(el.querySelector('.nav-backdrop')).toBeNull();
    });

    it('closes the drawer from the backdrop and from Escape', async () => {
      const { el, refresh } = await render();
      (el.querySelector('button.nav-toggle') as HTMLButtonElement).click();
      await refresh();
      (el.querySelector('.nav-backdrop') as HTMLElement).click();
      await refresh();
      expect(nav(el).classList).not.toContain('open');

      (el.querySelector('button.nav-toggle') as HTMLButtonElement).click();
      await refresh();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await refresh();
      expect(nav(el).classList).not.toContain('open');
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --testPathPatterns app.spec`
Expected: FAIL. There is no `aside.side-nav`. The title assertion passes, and the others throw on null.

- [ ] **Step 3: Implement the shell**

Replace `projects/app/src/app/app.html` with:

```html
<mat-toolbar class="app-bar">
  @if (!wide()) {
    <button mat-icon-button type="button" class="nav-toggle" aria-label="Open navigation" [attr.aria-expanded]="navOpen()" (click)="navOpen.set(true)">
      <mat-icon>menu</mat-icon>
    </button>
  }
  <mat-icon aria-hidden="true">castle</mat-icon>
  <h1>{{ title() }}</h1>
</mat-toolbar>
<div class="shell" [class.wide]="wide()">
  @if (!wide() && navOpen()) {
    <div class="nav-backdrop" (click)="navOpen.set(false)"></div>
  }
  <aside class="side-nav" [class.open]="wide() || navOpen()" [attr.inert]="wide() || navOpen() ? null : ''">
    <nav aria-label="Main">
      <mat-nav-list>
        <a mat-list-item class="nav-play" routerLink="/play" [activated]="playActive()" [attr.aria-current]="playActive() ? 'page' : null" (click)="closeDrawer()">
          <mat-icon matListItemIcon>play_arrow</mat-icon>
          <span matListItemTitle>Play Game</span>
        </a>
        <button mat-list-item type="button" class="nav-wiki" [attr.aria-expanded]="wikiOpen()" (click)="wikiOpen.set(!wikiOpen())">
          <mat-icon matListItemIcon>menu_book</mat-icon>
          <span matListItemTitle>Wiki</span>
          <mat-icon matListItemMeta>{{ wikiOpen() ? 'expand_less' : 'expand_more' }}</mat-icon>
        </button>
        @if (wikiOpen()) {
          @for (page of wikiPages; track page.path) {
            <a
              mat-list-item
              class="nav-sub"
              [routerLink]="page.path"
              routerLinkActive
              #link="routerLinkActive"
              [activated]="link.isActive"
              ariaCurrentWhenActive="page"
              (click)="closeDrawer()"
            >{{ page.label }}</a>
          }
        }
      </mat-nav-list>
    </nav>
  </aside>
  <main class="content">
    <router-outlet />
  </main>
</div>
```

Replace `projects/app/src/app/app.ts` with:

```ts
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';

const WIDE = '(min-width: 1024px)';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatListModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: { '(document:keydown.escape)': 'navOpen.set(false)' },
})
export class App {
  protected readonly title = signal('Kingdom War');
  protected readonly wikiPages = [
    { path: '/wiki/generals', label: 'Generals' },
    { path: '/wiki/basic', label: 'Basic Cards' },
    { path: '/wiki/equipment', label: 'Equipments' },
    { path: '/wiki/tools', label: 'Tools' },
  ];

  private readonly breakpoints = inject(BreakpointObserver);
  // Wide screens show the panel beside the page; narrow ones slide it in over it.
  protected readonly wide = toSignal(this.breakpoints.observe(WIDE).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(WIDE),
  });
  protected readonly navOpen = signal(false);
  protected readonly wikiOpen = signal(true);

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );
  protected readonly playActive = computed(() => /^\/(setup|game)(\/|$|\?)/.test(this.url()));

  protected closeDrawer(): void {
    this.navOpen.set(false);
  }
}
```

Replace `projects/app/src/app/app.css` with:

```css
.app-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  gap: 12px;
  background: var(--mat-sys-primary);
  color: var(--mat-sys-on-primary);
}
.app-bar h1 {
  margin: 0;
  font: var(--mat-sys-title-large);
}
.nav-toggle {
  color: var(--mat-sys-on-primary);
  margin-left: -8px;
}
.content {
  padding: 0 16px 16px;
  min-width: 0;
}

/* Wide: the panel sits beside the page, sticky under the header. */
.shell.wide {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  align-items: start;
}
.side-nav {
  background: var(--mat-sys-surface-container-low);
}
.shell.wide .side-nav {
  position: sticky;
  top: 64px;
  height: calc(100vh - 64px);
  overflow-y: auto;
  border-right: 1px solid var(--mat-sys-outline-variant);
}

/* Narrow: the panel is a drawer that slides in over the page. */
.shell:not(.wide) .side-nav {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  width: 280px;
  max-width: 85vw;
  overflow-y: auto;
  transform: translateX(-100%);
  transition: transform 200ms ease;
  box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
}
.shell:not(.wide) .side-nav.open {
  transform: none;
}
.nav-backdrop {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: rgb(0 0 0 / 32%);
}
.nav-sub {
  padding-left: 56px;
}
```

In `projects/app/src/styles.scss`, delete the line `.mat-mdc-menu-item.current { … }`. The header menu it styled no longer exists.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app --testPathPatterns "app.spec|app.config|play-redirect"`
Expected: PASS. The scroll-reset bootstrap test (`app.config.spec.ts`) uses the real `BreakpointObserver`. jsdom has no `matchMedia`, so the CDK reports "not matched", and the narrow layout renders. That's fine for that test.

- [ ] **Step 5: Run the whole suite and the build**

Run: `npx jest && npx ng build app`
Expected: tests PASS, and the build succeeds with no warnings and "Initial total" under 500 kB. Dropping the Material menu and overlay from the shell should shrink it from 469.95 kB.

- [ ] **Step 6: Record the shell design in the spec**

In `docs/superpowers/specs/2026-10-02-side-nav-and-wiki-tabs-design.md`, replace the sentence that begins "The app shell (`app.html`) becomes a Material `mat-sidenav-container`" with:

```markdown
The app shell (`app.html`) puts a `<div class="shell">` under the header
toolbar, holding an `<aside class="side-nav">` and the page. It is not a
Material `mat-sidenav-container`: that container sets `overflow: hidden`,
which would stop the sticky phase indicator from sticking and move scrolling
off the window (breaking the router's scroll reset). Material's `mat-nav-list`
items still style the links.
```

Also replace "the panel is `mode=\"side\"`, always open, and 240px wide" with "the panel is always shown, 240px wide, and sticky under the header". Replace "the panel is `mode=\"over\"` and closed by default" with "the panel is a drawer, closed by default, that slides in over the page with a backdrop; when closed it is `inert`".

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/app.ts projects/app/src/app/app.html projects/app/src/app/app.css projects/app/src/app/app.spec.ts projects/app/src/styles.scss docs/superpowers/specs/2026-10-02-side-nav-and-wiki-tabs-design.md
git commit -m "feat(app): left side navigation panel, a drawer on narrow screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: See it in the running app

**Files:** none changed.

- [ ] **Step 1: Drive it at 1400px, 1024px, 800px and 360px wide**

With `npx ng serve --port 4300` running:
- **Panel:** at 1400px and 1024px it is open beside the page, with no ☰ button. At 800px and 360px, ☰ opens a drawer, and a link, the backdrop or Escape closes it. The page never scrolls sideways.
- **Tabs:** every tab of every page, with these labels:
  - Wei (7) · Shu (7) · Wu (8) · Heroes (4);
  - Sha · Shan · Wine · Peach (1 each);
  - Weapons (8) · Armors (1) · Plus Mount (3) · Minus Mount (3);
  - Instant (10) · Delayed (2).

  Wine shows its art and "Not in the game yet".
- **Deep link:** `/wiki/tools?tab=delayed` opens on Delayed, and a refresh stays there.
- **Game board:** at 1024px, start a vs-bots game. The table and the hand fit beside the panel without sideways scrolling.
- **Resume:** Play Game after a Wiki trip resumes the same game.

Expected: all of the above, and no console errors.
