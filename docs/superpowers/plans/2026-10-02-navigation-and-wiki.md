# Navigation Menu and Wiki — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A header navigation menu (Play Game, and a Wiki dropdown) and four read-only Wiki pages: Generals, Basic Cards, Equipments, Tools. They list every crawled base-set general and card, badged by whether each is in the game.

**Architecture:**
- **Content** (`projects/content/src/lib/wiki.ts`) builds Wiki entries from the data files and computes the "in the game" badges from the registry.
- **The app** adds a `wiki/` folder of presentational components behind lazily loaded routes.
- **The shell header** gains a Material menu. Its Play Game link goes through a `/play` guard that loads `GameService` lazily, so the initial bundle stays under budget.

**Tech Stack:** TypeScript, Angular 22 (standalone components, signals, `input()`, the new control flow), Angular Material (toolbar, button, icon, menu), Jest (`ts-jest` for content, the Angular preset for app).

**Spec:** `docs/superpowers/specs/2026-10-02-navigation-and-wiki-design.md`

## Global Constraints

- The Wiki lists data files (`generalsData`, `cardsData`), not just the registry. Silver Lion (registry-only, with no data file) appears nowhere.
- Badges:
  - cards: "In the game" when `buildContentRegistry().cards.has(id)`, otherwise "Not in the game yet";
  - generals: "Skills in game" when `GENERAL_SKILLS.has(id)`, otherwise "Skills not in game yet".
- Badges are computed in `projects/content`, never in the app (CLAUDE.md: the UI never decides game facts).
- Today's counts:
  - 26 generals, 6 with skills in game: xiahou-dun, sun-shangxiang, zhuge-liang, dong-zhuo, zhao-yun, huang-yueying;
  - 3 basic cards, all in the game;
  - 15 equipment cards, 1 in the game (green-dragon-blade);
  - 12 tools, 2 in the game (duel, wuxie).
- Order:
  - generals by kingdom Wei, Shu, Wu, Qun, then by name;
  - basic cards and tools by name;
  - equipment by subtype (weapon, armor, horse, treasure), then by name.
- Gap texts: "Rules text not available" when a card has no text, and "Printings not recorded" when it has no printings. A missing Chinese name or title is left out.
- Page headings: "Generals", "Basic Cards", "Equipments", "Tools". Equipment sections: "Weapons", "Armor", "Horses", "Treasure".
- Routes:
  - `/play` (guard: `/game` if a game is in progress, otherwise `/setup`);
  - `/wiki/generals`, `/wiki/basic`, `/wiki/equipment` and `/wiki/tools`;
  - `/wiki` redirects to `/wiki/generals`.
- Header: "Play Game" (`play_arrow`) and "Wiki" (`menu_book`, `arrow_drop_down`). Under 600px they show icons only, with `aria-label`s "Play Game" and "Wiki".
- The initial bundle must stay under the 500 kB warning budget: `GameService` is never imported statically by the shell.
- Phone width 360px: entries stack, there is no horizontal scroll, and gutters are 16px.
- Tests: `npx jest --selectProjects <content|app> --testPathPatterns <pattern>` from the repo root. Full suite: `npx jest`.
- Commits end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A game in progress must survive a trip to the Wiki.** Play Game must resume it, never start over. Pinned in Task 4, "Play Game resumes a game in progress".
2. **Data gaps must read as gaps, not blanks:** horses with no rules text, equipment with no printings, Lu Meng with no Chinese name. Pinned in Task 2, "shows gap texts instead of blanks", and Task 1, "Lu Meng has no Chinese name".
3. **Switching between card pages** (Basic → Tools) must show the new category, not a stale one. Pinned in Task 3, "each card route renders its own category".
4. **The header at phone width:** the menu must stay usable, with icon buttons that have accessible names. Pinned in Task 4, "icon buttons have accessible names", and checked live in Task 5.
5. **Initial bundle size:** adding the menu must not pull engine and content code into the shell. Pinned in Task 4 Step 7 (`ng build app` initial total under 500 kB, no budget warning).

---

### Task 1: Wiki entries in content

**Files:**
- Create: `projects/content/src/lib/wiki.ts`
- Create: `projects/content/src/lib/wiki.spec.ts`
- Modify: `projects/content/src/public-api.ts` (add `export * from './lib/wiki';`)

**Interfaces:**
- Produces (exported from `content`):

```ts
export interface WikiSkill { name: string; nameZh: string | null; text: string }
export interface WikiGeneral {
  id: string; name: string; nameZh: string | null; title: string | null; titleZh: string | null;
  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun'; maxHp: number | null; skills: WikiSkill[]; skillsInGame: boolean;
}
export interface WikiCard {
  id: string; name: string; nameZh: string | null; category: 'basic' | 'tool' | 'equipment';
  subtype: 'weapon' | 'armor' | 'horse' | 'treasure' | null; text: string | null; range: number | null;
  count: number | null; printings: { suit: 'spade' | 'heart' | 'club' | 'diamond'; rank: number }[]; inGame: boolean;
}
export function wikiGenerals(): WikiGeneral[];
export function wikiCards(category: WikiCard['category']): WikiCard[];
```

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/wiki.spec.ts`:

```ts
import { wikiCards, wikiGenerals } from './wiki';

describe('wikiGenerals', () => {
  const generals = wikiGenerals();

  it('lists every general with data, grouped by kingdom then sorted by name', () => {
    expect(generals).toHaveLength(26);
    expect([...new Set(generals.map((g) => g.kingdom))]).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(generals.filter((g) => g.kingdom === 'Wei').map((g) => g.name)).toEqual([
      'Cao Cao', 'Guo Jia', 'Sima Yi', 'Xiahou Dun', 'Xu Chu', 'Zhang Liao', 'Zhen Ji',
    ]);
  });

  it('marks exactly the generals whose skills are coded', () => {
    expect(generals.filter((g) => g.skillsInGame).map((g) => g.id).sort()).toEqual(
      ['dong-zhuo', 'huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang']
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
});

describe('wikiCards', () => {
  it('lists the basic cards by name, all in the game', () => {
    const basic = wikiCards('basic');
    expect(basic.map((c) => c.name)).toEqual(['Peach', 'Sha', 'Shan']);
    expect(basic.every((c) => c.inGame && c.category === 'basic')).toBe(true);
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
    const tools = wikiCards('tool');
    expect(tools).toHaveLength(12);
    expect(tools.filter((c) => c.inGame).map((c) => c.id)).toEqual(['duel', 'wuxie']);
    const duel = tools.find((c) => c.id === 'duel')!;
    expect(duel.count).toBe(3);
    expect(duel.printings).toEqual([{ suit: 'spade', rank: 1 }, { suit: 'club', rank: 1 }, { suit: 'diamond', rank: 1 }]);
  });

  it('never lists Silver Lion, which has no data file', () => {
    for (const category of ['basic', 'equipment', 'tool'] as const) {
      expect(wikiCards(category).some((c) => c.id === 'silver-lion')).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects content --testPathPatterns wiki`
Expected: FAIL. Cannot find module `./wiki`.

- [ ] **Step 3: Implement**

Create `projects/content/src/lib/wiki.ts`:

```ts
import { cardsData, CardData } from '../../data/cards';
import { generalsData, GeneralData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { buildContentRegistry } from './registry';

export interface WikiSkill {
  name: string;
  nameZh: string | null;
  text: string;
}

// One general as the Wiki shows it: everything the data file knows, plus
// whether its skills are coded. Missing optional fields are null, never guessed.
export interface WikiGeneral {
  id: string;
  name: string;
  nameZh: string | null;
  title: string | null;
  titleZh: string | null;
  kingdom: GeneralData['kingdom'];
  maxHp: number | null;
  skills: WikiSkill[];
  skillsInGame: boolean;
}

// One card as the Wiki shows it, plus whether its rules are implemented
// (it is in the game registry).
export interface WikiCard {
  id: string;
  name: string;
  nameZh: string | null;
  category: CardData['category'];
  subtype: NonNullable<CardData['subtype']> | null;
  text: string | null;
  range: number | null;
  count: number | null;
  printings: NonNullable<CardData['printings']>;
  inGame: boolean;
}

const KINGDOM_ORDER: readonly WikiGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];
const SUBTYPE_ORDER: readonly NonNullable<WikiCard['subtype']>[] = ['weapon', 'armor', 'horse', 'treasure'];

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

export function wikiGenerals(): WikiGeneral[] {
  return Object.entries(generalsData)
    .map(([id, data]) => ({
      id,
      name: data.name,
      nameZh: data.nameZh ?? null,
      title: data.title ?? null,
      titleZh: data.titleZh ?? null,
      kingdom: data.kingdom,
      maxHp: data.maxHp,
      skills: data.skills.map((s) => ({ name: s.name, nameZh: s.nameZh || null, text: s.text })),
      skillsInGame: GENERAL_SKILLS.has(id),
    }))
    .sort((a, b) => KINGDOM_ORDER.indexOf(a.kingdom) - KINGDOM_ORDER.indexOf(b.kingdom) || byName(a, b));
}

export function wikiCards(category: WikiCard['category']): WikiCard[] {
  const registry = buildContentRegistry();
  const subtypeRank = (c: WikiCard) => (c.subtype === null ? -1 : SUBTYPE_ORDER.indexOf(c.subtype));
  return Object.entries(cardsData)
    .filter(([, data]) => data.category === category)
    .map(([id, data]) => ({
      id,
      name: data.name,
      nameZh: data.nameZh ?? null,
      category: data.category,
      subtype: data.subtype ?? null,
      text: data.text ?? null,
      range: data.range ?? null,
      count: data.count ?? null,
      printings: data.printings ?? [],
      inGame: registry.cards.has(id),
    }))
    .sort((a, b) => subtypeRank(a) - subtypeRank(b) || byName(a, b));
}
```

Add to `projects/content/src/public-api.ts`:

```ts
export * from './lib/wiki';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/wiki.ts projects/content/src/lib/wiki.spec.ts projects/content/src/public-api.ts
git commit -m "feat(content): Wiki entries for every general and card, badged by whether each is in the game

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wiki entry components

**Files:**
- Create: `projects/app/src/app/wiki/printing-label.ts`
- Create: `projects/app/src/app/wiki/printing-label.spec.ts`
- Create: `projects/app/src/app/wiki/wiki-general-entry.ts`
- Create: `projects/app/src/app/wiki/wiki-card-entry.ts`
- Create: `projects/app/src/app/wiki/wiki-entries.spec.ts`

**Interfaces:**
- Consumes: `WikiGeneral` and `WikiCard` from `content` (Task 1), and `CardArt` from `../game-board/card-art` (existing: inputs `id`, `label`, `size: 'normal' | 'small' | 'large' | 'tiny'`).
- Produces:
  - `printingLabel(p: WikiCard['printings'][number]): string`;
  - the standalone component `WikiGeneralEntry` (selector `app-wiki-general-entry`, required input `general: WikiGeneral`);
  - the standalone component `WikiCardEntry` (selector `app-wiki-card-entry`, required input `card: WikiCard`).

  Both render a root `<article class="entry" [attr.data-id]="id">` containing `.badge` (with class `on` when in the game) and `h4 .name`.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/wiki/printing-label.spec.ts`:

```ts
import { printingLabel } from './printing-label';

describe('printingLabel', () => {
  it('shows the suit symbol and the rank, with face ranks as letters', () => {
    expect(printingLabel({ suit: 'spade', rank: 1 })).toBe('♠A');
    expect(printingLabel({ suit: 'heart', rank: 11 })).toBe('♥J');
    expect(printingLabel({ suit: 'club', rank: 12 })).toBe('♣Q');
    expect(printingLabel({ suit: 'diamond', rank: 13 })).toBe('♦K');
    expect(printingLabel({ suit: 'spade', rank: 7 })).toBe('♠7');
    expect(printingLabel({ suit: 'heart', rank: 10 })).toBe('♥10');
  });
});
```

Create `projects/app/src/app/wiki/wiki-entries.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import type { WikiCard, WikiGeneral } from 'content';
import { WikiCardEntry } from './wiki-card-entry';
import { WikiGeneralEntry } from './wiki-general-entry';

const caoCao: WikiGeneral = {
  id: 'cao-cao', name: 'Cao Cao', nameZh: '曹操', title: 'Martial Emperor of Wei', titleZh: '魏武帝',
  kingdom: 'Wei', maxHp: 4, skillsInGame: false,
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --testPathPatterns "wiki|printing-label"`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Implement**

Create `projects/app/src/app/wiki/printing-label.ts`:

```ts
import type { WikiCard } from 'content';

const SUIT_SYMBOL: Record<WikiCard['printings'][number]['suit'], string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦',
};
const FACE_RANK: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// One physical copy's corner, e.g. { suit: 'spade', rank: 1 } -> "♠A".
export function printingLabel(printing: WikiCard['printings'][number]): string {
  return `${SUIT_SYMBOL[printing.suit]}${FACE_RANK[printing.rank] ?? printing.rank}`;
}
```

Create `projects/app/src/app/wiki/wiki-general-entry.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { WikiGeneral } from 'content';
import { CardArt } from '../game-board/card-art';

// One general in the Wiki: art beside everything the data knows about it.
@Component({
  selector: 'app-wiki-general-entry',
  imports: [CardArt, MatIconModule],
  template: `
    <article class="entry kingdom-{{ general().kingdom }}" [attr.data-id]="general().id">
      <app-card-art [id]="general().id" [label]="general().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ general().name }}</span>
            @if (general().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
          <span class="badge" [class.on]="general().skillsInGame">
            {{ general().skillsInGame ? 'Skills in game' : 'Skills not in game yet' }}
          </span>
        </header>
        @if (general().title; as title) {
          <p class="title">
            {{ title }}
            @if (general().titleZh; as titleZh) {
              <span class="zh">{{ titleZh }}</span>
            }
          </p>
        }
        <p class="meta">
          <span class="kingdom-tag">{{ general().kingdom }}</span>
          @if (general().maxHp !== null) {
            <span class="hearts" [attr.aria-label]="'HP ' + general().maxHp">
              @for (h of hearts(); track $index) {
                <mat-icon>favorite</mat-icon>
              }
            </span>
          } @else {
            <span class="gap">HP not recorded</span>
          }
        </p>
        <ul class="skills">
          @for (skill of general().skills; track skill.name) {
            <li>
              <strong>{{ skill.name }}</strong>
              @if (skill.nameZh; as zh) {
                <span class="zh">{{ zh }}</span>
              }
              <span class="skill-text">{{ skill.text }}</span>
            </li>
          } @empty {
            <li class="gap">No skills</li>
          }
        </ul>
      </div>
    </article>
  `,
  styles: `
    .entry { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .body { flex: 1; min-width: 0; }
    header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
    h4 { margin: 0; font: var(--mat-sys-title-large); }
    .zh { margin-left: 8px; color: var(--mat-sys-on-surface-variant); }
    .badge { padding: 2px 10px; border-radius: 12px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .badge.on { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); }
    .title { margin: 4px 0; font-style: italic; }
    .meta { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    .kingdom-Wei { --kingdom: #3f6fd8; }
    .kingdom-Shu { --kingdom: #d84a3f; }
    .kingdom-Wu { --kingdom: #2f9e58; }
    .kingdom-Qun { --kingdom: #8a7f8c; }
    .kingdom-tag { padding: 0 8px; border-radius: 8px; color: #fff; background: var(--kingdom); font: var(--mat-sys-label-medium); }
    .hearts { display: inline-flex; color: #d84a3f; }
    .hearts mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .skills { margin: 0; padding-left: 18px; }
    .skills li { margin: 4px 0; }
    .skill-text { margin-left: 6px; }
    .gap { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiGeneralEntry {
  readonly general = input.required<WikiGeneral>();
  protected readonly hearts = computed(() => Array.from({ length: this.general().maxHp ?? 0 }));
}
```

Create `projects/app/src/app/wiki/wiki-card-entry.ts`:

```ts
import { Component, computed, input } from '@angular/core';
import type { WikiCard } from 'content';
import { CardArt } from '../game-board/card-art';
import { printingLabel } from './printing-label';

// One card in the Wiki: art beside its rules text, stats and printings.
@Component({
  selector: 'app-wiki-card-entry',
  imports: [CardArt],
  template: `
    <article class="entry" [attr.data-id]="card().id">
      <app-card-art [id]="card().id" [label]="card().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ card().name }}</span>
            @if (card().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
          <span class="badge" [class.on]="card().inGame">{{ card().inGame ? 'In the game' : 'Not in the game yet' }}</span>
        </header>
        @if (card().range !== null) {
          <p class="range">Range {{ card().range }}</p>
        }
        @if (card().text; as text) {
          <p class="text">{{ text }}</p>
        } @else {
          <p class="gap">Rules text not available</p>
        }
        @if (card().printings.length > 0) {
          <p class="printings">{{ copies() }} copies: {{ printings() }}</p>
        } @else {
          <p class="gap">Printings not recorded</p>
        }
      </div>
    </article>
  `,
  styles: `
    .entry { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .body { flex: 1; min-width: 0; }
    header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
    h4 { margin: 0; font: var(--mat-sys-title-large); }
    .zh { margin-left: 8px; color: var(--mat-sys-on-surface-variant); }
    .badge { padding: 2px 10px; border-radius: 12px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .badge.on { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); }
    .range { margin: 8px 0 0; font-weight: 600; }
    .text { margin: 8px 0; }
    .printings { margin: 8px 0; letter-spacing: 0.04em; }
    .gap { margin: 8px 0; color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiCardEntry {
  readonly card = input.required<WikiCard>();
  protected readonly copies = computed(() => this.card().count ?? this.card().printings.length);
  protected readonly printings = computed(() => this.card().printings.map(printingLabel).join(' '));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app --testPathPatterns "wiki|printing-label"`
Expected: PASS. If an `anyComponentStyle` budget warning appears later in `ng build`, it applies to these styles. Each stays well under 4 kB.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/wiki/printing-label.ts projects/app/src/app/wiki/printing-label.spec.ts projects/app/src/app/wiki/wiki-general-entry.ts projects/app/src/app/wiki/wiki-card-entry.ts projects/app/src/app/wiki/wiki-entries.spec.ts
git commit -m "feat(app): Wiki entry components for generals and cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wiki pages and routes

**Files:**
- Create: `projects/app/src/app/wiki/wiki-generals.ts`
- Create: `projects/app/src/app/wiki/wiki-cards.ts`
- Create: `projects/app/src/app/wiki/wiki.routes.ts`
- Create: `projects/app/src/app/wiki/wiki-pages.spec.ts`
- Modify: `projects/app/src/app/app.routes.ts` (add the `wiki` route)

**Interfaces:**
- Consumes: `wikiGenerals`, `wikiCards` and `WikiCard` from `content` (Task 1), plus `WikiGeneralEntry` and `WikiCardEntry` (Task 2).
- Produces:
  - `WIKI_ROUTES: Routes`;
  - the standalone components `WikiGenerals` and `WikiCards`.

  Each page renders `<h2>` with the page name, `.summary`, and one `<section class="group">` per group with a `<h3 class="group-title">` when the page is grouped.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/wiki/wiki-pages.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

async function open(url: string): Promise<{ harness: RouterTestingHarness; el: () => HTMLElement; router: Router }> {
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return { harness, el: () => harness.routeNativeElement as HTMLElement, router: TestBed.inject(Router) };
}

const groupTitles = (el: HTMLElement) => [...el.querySelectorAll('.group-title')].map((h) => h.textContent!.trim());

describe('Wiki pages', () => {
  it('redirects /wiki to the Generals page', async () => {
    const { router } = await open('/wiki');
    expect(router.url).toBe('/wiki/generals');
  });

  it('lists the 26 generals in four kingdom sections', async () => {
    const page = (await open('/wiki/generals')).el();
    expect(page.querySelector('h2')!.textContent).toBe('Generals');
    expect(page.querySelector('.summary')!.textContent).toContain('26 generals · 6 with skills in the game');
    expect(groupTitles(page)).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(page.querySelectorAll('app-wiki-general-entry')).toHaveLength(26);
  });

  it('splits Equipments into Weapons, Armor and Horses', async () => {
    const page = (await open('/wiki/equipment')).el();
    expect(page.querySelector('h2')!.textContent).toBe('Equipments');
    expect(page.querySelector('.summary')!.textContent).toContain('15 cards · 1 in the game');
    expect(groupTitles(page)).toEqual(['Weapons', 'Armor', 'Horses']);
    expect(page.querySelectorAll('app-wiki-card-entry')).toHaveLength(15);
  });

  it('each card route renders its own category (Review Focus 3)', async () => {
    const { harness, el } = await open('/wiki/basic');
    expect(el().querySelector('h2')!.textContent).toBe('Basic Cards');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(3);
    expect(groupTitles(el())).toEqual([]);

    // Same harness: moving Basic -> Tools must not reuse the Basic page.
    await harness.navigateByUrl('/wiki/tools');
    expect(el().querySelector('h2')!.textContent).toBe('Tools');
    expect(el().querySelector('.summary')!.textContent).toContain('12 cards · 2 in the game');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --testPathPatterns wiki-pages`
Expected: FAIL. No route matches `wiki`.

- [ ] **Step 3: Implement the pages**

Create `projects/app/src/app/wiki/wiki-generals.ts`:

```ts
import { Component } from '@angular/core';
import { wikiGenerals, WikiGeneral } from 'content';
import { WikiGeneralEntry } from './wiki-general-entry';

const KINGDOMS: readonly WikiGeneral['kingdom'][] = ['Wei', 'Shu', 'Wu', 'Qun'];

@Component({
  selector: 'app-wiki-generals',
  imports: [WikiGeneralEntry],
  template: `
    <h2>Generals</h2>
    <p class="summary">{{ generals.length }} generals · {{ withSkills }} with skills in the game</p>
    @for (group of groups; track group.kingdom) {
      <section class="group" [attr.data-kingdom]="group.kingdom">
        <h3 class="group-title">{{ group.kingdom }}</h3>
        @for (general of group.generals; track general.id) {
          <app-wiki-general-entry [general]="general" />
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary { color: var(--mat-sys-on-surface-variant); }
    .group-title { margin: 24px 0 0; font: var(--mat-sys-headline-small); }
  `,
})
export class WikiGenerals {
  protected readonly generals = wikiGenerals();
  protected readonly withSkills = this.generals.filter((g) => g.skillsInGame).length;
  protected readonly groups = KINGDOMS.map((kingdom) => ({
    kingdom,
    generals: this.generals.filter((g) => g.kingdom === kingdom),
  })).filter((group) => group.generals.length > 0);
}
```

Create `projects/app/src/app/wiki/wiki-cards.ts`:

```ts
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { wikiCards, WikiCard } from 'content';
import { WikiCardEntry } from './wiki-card-entry';

const PAGE_TITLES: Record<WikiCard['category'], string> = { basic: 'Basic Cards', equipment: 'Equipments', tool: 'Tools' };
const SUBTYPE_TITLES: Record<NonNullable<WikiCard['subtype']>, string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  horse: 'Horses',
  treasure: 'Treasure',
};

// One page per card category; the category comes from the route's data.
@Component({
  selector: 'app-wiki-cards',
  imports: [WikiCardEntry],
  template: `
    <h2>{{ title }}</h2>
    <p class="summary">{{ cards.length }} cards · {{ inGame }} in the game</p>
    @for (group of groups; track group.title) {
      <section class="group">
        @if (group.title) {
          <h3 class="group-title">{{ group.title }}</h3>
        }
        @for (card of group.cards; track card.id) {
          <app-wiki-card-entry [card]="card" />
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; max-width: 960px; margin: 0 auto; }
    .summary { color: var(--mat-sys-on-surface-variant); }
    .group-title { margin: 24px 0 0; font: var(--mat-sys-headline-small); }
  `,
})
export class WikiCards {
  private readonly category = inject(ActivatedRoute).snapshot.data['category'] as WikiCard['category'];
  protected readonly title = PAGE_TITLES[this.category];
  protected readonly cards = wikiCards(this.category);
  protected readonly inGame = this.cards.filter((c) => c.inGame).length;
  // Equipment splits by subtype (already ordered by content); other categories are one list.
  protected readonly groups: { title: string; cards: WikiCard[] }[] =
    this.category === 'equipment'
      ? [...new Set(this.cards.map((c) => c.subtype!))].map((subtype) => ({
          title: SUBTYPE_TITLES[subtype],
          cards: this.cards.filter((c) => c.subtype === subtype),
        }))
      : [{ title: '', cards: this.cards }];
}
```

Create `projects/app/src/app/wiki/wiki.routes.ts`:

```ts
import { Routes } from '@angular/router';

// The three card pages share one component; each route names its category.
export const WIKI_ROUTES: Routes = [
  { path: 'generals', loadComponent: () => import('./wiki-generals').then((m) => m.WikiGenerals) },
  { path: 'basic', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'basic' } },
  { path: 'equipment', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'equipment' } },
  { path: 'tools', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'tool' } },
  { path: '', redirectTo: 'generals', pathMatch: 'full' },
];
```

In `projects/app/src/app/app.routes.ts`, add before the `''` redirect:

```ts
  { path: 'wiki', loadChildren: () => import('./wiki/wiki.routes').then((m) => m.WIKI_ROUTES) },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app --testPathPatterns wiki`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/wiki/wiki-generals.ts projects/app/src/app/wiki/wiki-cards.ts projects/app/src/app/wiki/wiki.routes.ts projects/app/src/app/wiki/wiki-pages.spec.ts projects/app/src/app/app.routes.ts
git commit -m "feat(app): Wiki pages for generals, basic cards, equipment and tools

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Header navigation menu and the /play redirect

**Files:**
- Create: `projects/app/src/app/play-redirect.ts`
- Modify: `projects/app/src/app/app.routes.ts` (add the `play` route)
- Modify: `projects/app/src/app/app.ts`, `projects/app/src/app/app.html`, `projects/app/src/app/app.css`
- Test: `projects/app/src/app/app.spec.ts`
- Test: `projects/app/src/app/play-redirect.spec.ts` (create)

**Interfaces:**
- Consumes: the `/wiki/...` routes (Task 3), and `GameService` (existing; `state(): GameState | null`; `startGame(seatCount, seed?, mode?)`).
- Produces:
  - `playRedirect: CanActivateFn`, which resolves to a `UrlTree` for `/game` or `/setup`;
  - a header with `a.nav-play` (routerLink `/play`) and `button.nav-wiki` (opens a `mat-menu` of four `a[mat-menu-item]` links).

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/play-redirect.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { GameService } from './game.service';

describe('/play', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes)] }));

  it('goes to Setup when no game is in progress', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/play');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });

  it('Play Game resumes a game in progress (Review Focus 1)', async () => {
    const gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1);
    const stateBefore = gameService.state();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/wiki/tools');
    await harness.navigateByUrl('/play');
    expect(TestBed.inject(Router).url).toBe('/game');
    expect(gameService.state()).toBe(stateBefore);
  });

  it('goes to Setup once the game has ended', async () => {
    const gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1);
    (gameService as unknown as { _state: { set(v: unknown): void } })._state.set({
      ...gameService.state()!,
      result: { endedAt: 1, winningSeatIds: [], losingSeatIds: [] },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/play');
    expect(TestBed.inject(Router).url).toBe('/setup');
  });
});
```

(`_state` is GameService's private writable signal. Setting it is a test-only shortcut to a finished game, because playing one to the end is slow. If the field name differs, read `game.service.ts` and use the actual writable signal behind `state`.)

Replace `projects/app/src/app/app.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'setup', children: [] },
          { path: 'game', children: [] },
          { path: 'play', children: [] },
          { path: 'wiki/:page', children: [] },
        ]),
      ],
    }).compileComponents();
  });

  afterEach(() => (document.querySelector('.cdk-overlay-container') as HTMLElement | null)?.replaceChildren());

  async function render(url = '/setup') {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('should render title', async () => {
    const { el } = await render();
    expect(el.querySelector('mat-toolbar h1')?.textContent).toContain('Guozhan');
  });

  it('links Play Game to /play, highlighted on the play screens', async () => {
    const { el, fixture } = await render('/setup');
    const play = el.querySelector('a.nav-play') as HTMLAnchorElement;
    expect(play.getAttribute('href')).toBe('/play');
    expect(play.classList).toContain('active');
    await TestBed.inject(Router).navigateByUrl('/wiki/generals');
    fixture.detectChanges();
    expect(play.classList).not.toContain('active');
    expect(el.querySelector('button.nav-wiki')!.classList).toContain('active');
  });

  it('opens the Wiki menu with links to the four pages', async () => {
    const { el, fixture } = await render();
    (el.querySelector('button.nav-wiki') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...document.querySelectorAll('.cdk-overlay-container a[mat-menu-item]')] as HTMLAnchorElement[];
    expect(items.map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
      ['Generals', '/wiki/generals'],
      ['Basic Cards', '/wiki/basic'],
      ['Equipments', '/wiki/equipment'],
      ['Tools', '/wiki/tools'],
    ]);
  });

  it('icon buttons have accessible names (Review Focus 4)', async () => {
    const { el } = await render();
    expect(el.querySelector('a.nav-play')!.getAttribute('aria-label')).toBe('Play Game');
    expect(el.querySelector('button.nav-wiki')!.getAttribute('aria-label')).toBe('Wiki');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --testPathPatterns "app.spec|play-redirect"`
Expected: FAIL. There is no `/play` route, no `a.nav-play` and no `button.nav-wiki`.

- [ ] **Step 3: Implement the /play guard and route**

Create `projects/app/src/app/play-redirect.ts`:

```ts
import { inject, Injector } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

// Play Game: resume a game in progress, otherwise start one from Setup.
// GameService is imported lazily so the shell's initial bundle doesn't carry
// the engine and content code (about 250 kB).
export const playRedirect: CanActivateFn = async (): Promise<UrlTree> => {
  const router = inject(Router);
  const injector = inject(Injector);
  const { GameService } = await import('./game.service');
  const state = injector.get(GameService).state();
  return router.parseUrl(state && !state.result ? '/game' : '/setup');
};
```

In `projects/app/src/app/app.routes.ts`, add `import { playRedirect } from './play-redirect';`, and before the `wiki` route add:

```ts
  // Never renders: the guard always redirects to /game or /setup.
  { path: 'play', canActivate: [playRedirect], children: [] },
```

- [ ] **Step 4: Implement the header menu**

Replace `projects/app/src/app/app.html` with:

```html
<mat-toolbar color="primary" class="app-bar">
  <mat-icon aria-hidden="true">castle</mat-icon>
  <h1>{{ title() }}</h1>
  <nav class="nav">
    <a mat-button class="nav-play" routerLink="/play" [class.active]="playActive()" aria-label="Play Game">
      <mat-icon>play_arrow</mat-icon><span class="label">Play Game</span>
    </a>
    <button mat-button type="button" class="nav-wiki" [matMenuTriggerFor]="wikiMenu" [class.active]="wikiActive()" aria-label="Wiki">
      <mat-icon>menu_book</mat-icon><span class="label">Wiki</span><mat-icon class="drop">arrow_drop_down</mat-icon>
    </button>
    <mat-menu #wikiMenu="matMenu">
      @for (page of wikiPages; track page.path) {
        <a mat-menu-item [routerLink]="page.path" routerLinkActive="current">{{ page.label }}</a>
      }
    </mat-menu>
  </nav>
</mat-toolbar>
<main class="content">
  <router-outlet />
</main>
```

Replace `projects/app/src/app/app.ts` with:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Guozhan');
  protected readonly wikiPages = [
    { path: '/wiki/generals', label: 'Generals' },
    { path: '/wiki/basic', label: 'Basic Cards' },
    { path: '/wiki/equipment', label: 'Equipments' },
    { path: '/wiki/tools', label: 'Tools' },
  ];

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );
  protected readonly playActive = computed(() => /^\/(setup|game)(\/|$|\?)/.test(this.url()));
  protected readonly wikiActive = computed(() => this.url().startsWith('/wiki'));
}
```

Append to `projects/app/src/app/app.css`:

```css
.nav {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.nav a,
.nav button {
  --mat-button-text-label-text-color: var(--mat-sys-on-primary);
  color: var(--mat-sys-on-primary);
}
.nav .active {
  background: color-mix(in srgb, var(--mat-sys-on-primary) 18%, transparent);
}
.nav .drop {
  margin: 0 -4px 0 0;
}
@media (max-width: 599px) {
  .nav .label {
    display: none;
  }
  .nav a,
  .nav button {
    min-width: 0;
    padding: 0 8px;
  }
}
```

The current page's menu item gets the class `current` from `routerLinkActive`. In `projects/app/src/styles.scss` (the app's global stylesheet in `angular.json`), add:

```css
.mat-mdc-menu-item.current { font-weight: 600; background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent); }
```

The menu panel renders in the CDK overlay, outside the component, so this rule must be global.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --selectProjects app --testPathPatterns "app.spec|play-redirect"`
Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 7: Check the bundle budget (Review Focus 5)**

Run: `npx ng build app`
Expected: success with no warnings. In the "Initial chunk files" table, "Initial total" must be under 500 kB; it was 305.78 kB before this task. If it jumped by about 250 kB, something in the shell imports `GameService`, `engine` or `content` statically. Find it and remove it.

- [ ] **Step 8: Commit**

```bash
git add projects/app/src/app/play-redirect.ts projects/app/src/app/play-redirect.spec.ts projects/app/src/app/app.routes.ts projects/app/src/app/app.ts projects/app/src/app/app.html projects/app/src/app/app.css projects/app/src/app/app.spec.ts projects/app/src/styles.scss
git commit -m "feat(app): header menu with Play Game and a Wiki dropdown

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: See it in the running app

**Files:** none changed.

- [ ] **Step 1: Drive it in a browser at 1400px and at 360px wide**

With `npx ng serve` running, check each of these:
- **Header:** Setup shows Play Game (highlighted) and Wiki ▾. At 360px both show icons only and the header doesn't overflow.
- **Wiki menu:** it opens Generals, Basic Cards, Equipments and Tools. Each page shows its heading and summary:
  - 26 generals in four kingdom sections;
  - 3 basic cards;
  - 15 equipment cards in Weapons, Armor and Horses;
  - 12 tools.

  Badges and gap texts show. At 360px entries stack, the art sits above the text, and nothing scrolls sideways.
- **Resume:** start a vs-bots game, open the Wiki, then click Play Game. You're back in the same game.

Expected: all of the above, and no errors in the browser console.
