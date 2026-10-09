# Tool Rename and Split-Portrait Seat Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the term "Trick" with "Tool" across the whole repository (stage 0). Replace the seat tile's two General thumbnails with one split-portrait avatar (stage 0b).

**Architecture:**
- **Stage 0** is a behaviour-free rename:
  - the engine's card category literal;
  - the content data and asset folders, plus the asset manifest;
  - the generated data index, scripts, tests and docs.
- **Stage 0b** is presentation only:
  - a new `SeatAvatar` component, which `SeatTile` uses;
  - a new `GeneralInfoDialog` that opens when you click an avatar half;
  - one new content export for the hidden-General art URL.

  No engine change.

**Tech Stack:** TypeScript, Angular 22 standalone components with signals, Angular Material dialogs, Jest. Python 3 runs the one-off rename script.

**Spec:** `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md` (sections "Stage 0" and "Stage 0b").

## Global Constraints

- After stage 0, `grep -rIi trick` over the repo finds no matches, with three exclusions:
  - `node_modules`, `dist`, `.angular`, `.git`;
  - the roadmap spec, whose Stage 0 section describes the rename;
  - this plan file.
- Spec and plan **file names** stay unchanged, so links keep working. Only `projects/content/src/lib/cards/tricks.spec.ts` (code) is renamed.
- Behaviour doesn't change in stage 0. The full suite (`npx jest`) passes with only renamed literals.
- UI text follows CLAUDE.md's "UI text style":
  - Title Case for names and labels.
  - Sentence case for sentences.
  - Ids are never shown.
  - "General" keeps its capital.
- The avatar keeps today's footprint: two 70×96 portraits plus a 6px gap, so the frame is **146×96**.
- Hidden General art is `/card-art/generals/unnamed.jpg`. It already ships, because `angular.json` copies all of `projects/content/assets` to `card-art/`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Another seat with one revealed and one hidden General.** The revealed half shows its art. The hidden half shows the card back and "Hidden". The halves must not swap: Main is always left. (Test in Task 3.)
- **Your own seat with hidden Generals.** The redaction leaves them unmasked, so the real art shows, dimmed, with the eye-off mark and "(hidden)". It must never show the card back. (Test in Task 3.)
- **A General id with no crawled art.** `cardArtUrl` returns null. The half must still render a captioned placeholder, never a broken `<img>`. (Test in Task 3.)
- **Clicking a hidden half of another seat.** Nothing opens, because the button is disabled. Opening it would leak that a hidden General exists by id. (Test in Task 3.)
- **The wiki Tools page after the rename.** The route data category must be `tool`, or the page renders empty. (Test in Task 1.)

---

## File Structure

**Stage 0 (Task 1: code and data, Task 2: docs)**
- Move: `projects/content/data/cards/trick/*.json` → `projects/content/data/cards/tool/`
- Move: `projects/content/assets/cards/trick/*.jpg` → `projects/content/assets/cards/tool/`
- Move: `projects/content/src/lib/cards/tricks.spec.ts` → `projects/content/src/lib/cards/tools.spec.ts`
- Modify (`trick` → `tool`, case-preserving):
  - `projects/engine/src/lib/registry/types.ts`
  - `projects/engine/src/lib/pipeline/resolve.spec.ts`
  - `projects/content/data/cards/index.ts`
  - `projects/content/assets/manifest.json`
  - `projects/content/src/lib/cards/duel.ts`
  - `projects/content/src/lib/cards/wuxie.ts`
  - `projects/content/src/lib/wiki.ts`
  - `projects/content/src/lib/wiki.spec.ts`
  - `projects/app/src/app/wiki/wiki-cards.ts`
  - `projects/app/src/app/wiki/wiki.routes.ts`
  - `projects/app/src/app/wiki/wiki-entries.spec.ts`
  - `projects/bots/src/lib/rule-based.spec.ts`
  - `scripts/assemble-content-data.py`
  - `scripts/restructure-content-data.py`
- Modify (docs): `README.md`, `CLAUDE.md`, every file under `docs/superpowers/` except the two exclusions above.

**Stage 0b (Task 3)**
- Modify: `projects/content/src/lib/assets.ts`, which adds `HIDDEN_GENERAL_ART_URL`
- Modify: `projects/content/src/lib/assets.spec.ts`
- Create: `projects/app/src/app/game-board/general-info-dialog.ts`, the read-only General details popup
- Create: `projects/app/src/app/game-board/general-info-dialog.spec.ts`
- Create: `projects/app/src/app/game-board/seat-avatar.ts`, the split portrait
- Create: `projects/app/src/app/game-board/seat-avatar.spec.ts`
- Modify: `projects/app/src/app/game-board/seat-tile.ts`, which uses `<app-seat-avatar>` in place of the two `<app-card-art>`
- Modify: `projects/app/src/app/game-board/seat-tile.spec.ts`

---

### Task 1: Rename Trick to Tool in code, data, assets and scripts

**Files:** every Stage 0 path above except the docs.

**Interfaces:**
- Produces: `CardDefinition['category']` is `'basic' | 'tool' | 'equipment'`, and `CardData['category']` is the same union. `wikiCards('tool')` and `wikiCardTabs('tool')` replace the `'trick'` forms. The wiki route `/wiki/tools` passes `data: { category: 'tool' }`. Data and asset paths are `cards/tool/<id>.json` and `cards/tool/<id>.jpg`.

- [ ] **Step 1: Change the tests first**

In `projects/content/src/lib/wiki.spec.ts`, replace every `wikiCards('trick')` with `wikiCards('tool')`, and `wikiCardTabs('trick')` with `wikiCardTabs('tool')`.

In `projects/content/src/lib/assets.spec.ts`, add a test under `describe('cardArtUrl', ...)`:

```ts
  it('serves Tool art from the tool folder', () => {
    expect(cardArtUrl('duel')).toBe('/card-art/cards/tool/duel.jpg');
  });
```

In `projects/app/src/app/wiki/wiki-entries.spec.ts` line 12, change `category: 'trick'` to `category: 'tool'`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/wiki.spec.ts projects/content/src/lib/assets.spec.ts projects/app/src/app/wiki`
Expected: FAIL. `wikiCards('tool')` returns `[]`, the art URL is still `/card-art/cards/trick/duel.jpg`, and the type check rejects `'tool'`.

- [ ] **Step 3: Move the folders and the spec file with git**

```bash
cd /Users/hing/Workspace/my_sanguosha
git mv projects/content/data/cards/trick projects/content/data/cards/tool
git mv projects/content/assets/cards/trick projects/content/assets/cards/tool
git mv projects/content/src/lib/cards/tricks.spec.ts projects/content/src/lib/cards/tools.spec.ts
```

- [ ] **Step 4: Replace the word, case-preserving, in the code files**

Save as `$SCRATCHPAD/rename_trick.py`. `$SCRATCHPAD` is the session scratchpad directory. Then run it with `python3`:

```python
import re, sys, pathlib
ROOT = pathlib.Path('/Users/hing/Workspace/my_sanguosha')
FILES = sys.argv[1:]
WORDS = {'tricks': 'tools', 'Tricks': 'Tools', 'TRICKS': 'TOOLS',
         'trick': 'tool', 'Trick': 'Tool', 'TRICK': 'TOOL'}
pattern = re.compile(r'tricks|Tricks|TRICKS|trick|Trick|TRICK')
for rel in FILES:
    p = ROOT / rel
    s = p.read_text(encoding='utf-8')
    t = pattern.sub(lambda m: WORDS[m.group(0)], s)
    if t != s:
        p.write_text(t, encoding='utf-8')
        print('updated', rel)
```

```bash
cd /Users/hing/Workspace/my_sanguosha
python3 "$SCRATCHPAD/rename_trick.py" \
  projects/engine/src/lib/registry/types.ts \
  projects/engine/src/lib/pipeline/resolve.spec.ts \
  projects/content/data/cards/index.ts \
  projects/content/assets/manifest.json \
  projects/content/src/lib/cards/duel.ts \
  projects/content/src/lib/cards/wuxie.ts \
  projects/content/src/lib/cards/tools.spec.ts \
  projects/content/src/lib/wiki.ts \
  projects/app/src/app/wiki/wiki-cards.ts \
  projects/app/src/app/wiki/wiki.routes.ts \
  projects/bots/src/lib/rule-based.spec.ts \
  scripts/assemble-content-data.py \
  scripts/restructure-content-data.py
```

Expected: an `updated` line for each of these files. The script turns, for example:
- `import barbariansTrick from './trick/barbarians.json'` into `import barbariansTool from './tool/barbarians.json'`;
- `category: 'trick'` into `category: 'tool'`;
- `"localPath": "cards/trick/duel.jpg"` into `"localPath": "cards/tool/duel.jpg"`;
- `{ ..., trick: 'Tools' }` into `{ ..., tool: 'Tools' }`;
- the test title `'discards a trick before equipment, ...'` into `'discards a tool before equipment, ...'`.

- [ ] **Step 5: Check that nothing is left in code**

Run: `grep -rIni trick projects scripts --exclude-dir=node_modules`
Expected: no output.

Run: `find projects -ipath '*trick*' -not -path '*/node_modules/*'`
Expected: no output.

- [ ] **Step 6: Run the whole suite**

Run: `npx jest`
Expected: PASS. That is 67 suites, plus 1 new test from Step 1, so 527 tests.

- [ ] **Step 7: Build the libraries**

Run: `npm run build`
Expected: both `engine` and `content` build with no errors. This catches JSON import paths that Jest's resolver might tolerate.

- [ ] **Step 8: Commit**

```bash
git add -A projects scripts
git commit -m "refactor: rename the Trick card category to Tool in code, data and assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Rename Trick to Tool in the docs

**Files:** `README.md`, `CLAUDE.md`, and all of `docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md`. Two files are excluded:
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`
- `docs/superpowers/plans/2026-10-05-tool-rename-and-seat-avatar.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Run the same script over the docs**

```bash
cd /Users/hing/Workspace/my_sanguosha
python3 "$SCRATCHPAD/rename_trick.py" README.md CLAUDE.md $(grep -rIil trick docs \
  | grep -v 'specs/2026-10-05-all-cards-and-skills-roadmap-design.md' \
  | grep -v 'plans/2026-10-05-tool-rename-and-seat-avatar.md')
```

- [ ] **Step 2: Fix the phrases the replacement made redundant**

Run: `grep -rn "Tool (tool)\|tool (tool)\|Tools (tools)" docs README.md CLAUDE.md`

For each hit, remove the redundant part. For example, in `docs/superpowers/specs/2026-10-05-tools-design.md`, "Make every Tool (tool) card playable" becomes "Make every Tool card playable".

- [ ] **Step 3: Check the whole repository**

Run:

```bash
grep -rIil trick . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.angular --exclude-dir=.git
```

Expected output, exactly these two lines:

```
./docs/superpowers/plans/2026-10-05-tool-rename-and-seat-avatar.md
./docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md
```

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md docs
git commit -m "docs: say Tool, not Trick

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Split-portrait seat avatar and the General info popup

**Files:**
- Modify: `projects/content/src/lib/assets.ts`, `projects/content/src/lib/assets.spec.ts`
- Create: `projects/app/src/app/game-board/general-info-dialog.ts` and `.spec.ts`
- Create: `projects/app/src/app/game-board/seat-avatar.ts` and `.spec.ts`
- Modify: `projects/app/src/app/game-board/seat-tile.ts`, `projects/app/src/app/game-board/seat-tile.spec.ts`

**Interfaces:**
- Consumes:
  - `cardArtUrl(id: string): string | null` and `generalDisplayData(id): GeneralDisplayData | null` from `content`.
  - `GeneralInstance { generalDefinitionId: string; revealed: boolean }` and `SeatGenerals { main; deputy }` from `engine`.
  - `generalDisplayName(id)` from `../labels`. It returns `'Hidden General'` for `'hidden'`.
- Produces:
  - `HIDDEN_GENERAL_ART_URL: string` from `content`, equal to `'/card-art/generals/unnamed.jpg'`.
  - `GeneralInfoDialog` with `GeneralInfoDialogData { generalDefinitionId: string }`.
  - `SeatAvatar`, selector `app-seat-avatar`, with input `generals: SeatGenerals` (required). Its rendered halves are `.half[data-slot="main"]` and `.half[data-slot="deputy"]`. Stage 6 adds skill buttons under these halves.

- [ ] **Step 1: Export the hidden-art URL (test first)**

Add to `projects/content/src/lib/assets.spec.ts`:

```ts
import { cardArtUrl, HIDDEN_GENERAL_ART_URL } from './assets';
// ...
describe('HIDDEN_GENERAL_ART_URL', () => {
  it('points at the General card back that ships with the content assets', () => {
    expect(HIDDEN_GENERAL_ART_URL).toBe('/card-art/generals/unnamed.jpg');
  });
});
```

Change the file's first import line to the one above. Don't add a second import.

Run: `npx jest projects/content/src/lib/assets.spec.ts`
Expected: FAIL, with "HIDDEN_GENERAL_ART_URL" undefined.

Add to `projects/content/src/lib/assets.ts`:

```ts
// The face-down General card, shown for a General another seat hasn't revealed.
// Not in the manifest (it isn't a crawled item), but it ships with the assets.
export const HIDDEN_GENERAL_ART_URL = '/card-art/generals/unnamed.jpg';
```

`projects/content/src/public-api.ts` already has `export * from "./lib/assets"`, so nothing else is needed.

Run: `npx jest projects/content/src/lib/assets.spec.ts`
Expected: PASS.

- [ ] **Step 2: Write the General info popup test**

Create `projects/app/src/app/game-board/general-info-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GeneralInfoDialog } from './general-info-dialog';

function render(generalDefinitionId: string): HTMLElement {
  TestBed.configureTestingModule({
    imports: [GeneralInfoDialog],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: { generalDefinitionId } }],
  });
  const fixture = TestBed.createComponent(GeneralInfoDialog);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('GeneralInfoDialog', () => {
  it('shows the General’s name, title, art and each skill with its text', () => {
    const el = render('guan-yu');
    expect(el.querySelector('h2')!.textContent).toContain('Guan Yu');
    expect(el.textContent).toContain('Bearded Gentleman');
    expect((el.querySelector('app-card-art img') as HTMLImageElement).getAttribute('src')).toBe('/card-art/generals/shu/guan-yu.jpg');
    const skills = [...el.querySelectorAll('.skills li')].map((li) => li.textContent!.trim());
    expect(skills).toHaveLength(1);
    expect(skills[0]).toContain('Fighting Saint');
    expect(skills[0]).toContain('Guan Yu can use any red card as an attack.');
  });

  it('falls back to a readable name and an empty-state line for an unknown General', () => {
    const el = render('no-such-general');
    expect(el.querySelector('h2')!.textContent).toContain('No Such General');
    expect(el.textContent).toContain('No skills listed');
    expect(el.textContent).not.toContain('no-such-general');
  });
});
```

Run: `npx jest projects/app/src/app/game-board/general-info-dialog.spec.ts`
Expected: FAIL with "Cannot find module './general-info-dialog'".

- [ ] **Step 3: Implement the General info popup**

Create `projects/app/src/app/game-board/general-info-dialog.ts`:

```ts
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { generalDisplayData } from 'content';
import { generalDisplayName } from '../labels';
import { CardArt } from './card-art';

export interface GeneralInfoDialogData {
  generalDefinitionId: string;
}

// Read-only General details (art, title, skills), opened from a seat's avatar.
@Component({
  selector: 'app-general-info-dialog',
  imports: [MatDialogModule, MatButtonModule, CardArt],
  template: `
    <h2 mat-dialog-title>{{ name }}</h2>
    <mat-dialog-content class="content">
      <app-card-art size="large" [id]="data.generalDefinitionId" [label]="name" />
      <div class="details">
        @if (display?.title; as title) {
          <div class="title">{{ title }}</div>
        }
        @if (display?.skills?.length) {
          <ul class="skills">
            @for (skill of display!.skills; track skill.name) {
              <li><strong>{{ skill.name }}</strong> {{ skill.text }}</li>
            }
          </ul>
        } @else {
          <p class="empty">No skills listed.</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: flex; gap: 16px; align-items: flex-start; }
    .details { flex: 1; min-width: 0; }
    .title { font-style: italic; color: #666; margin-bottom: 8px; }
    .skills { padding-left: 1.1em; margin: 0; }
    .skills li { margin-bottom: 6px; }
    .empty { color: #666; }
    @media (max-width: 480px) { .content { flex-direction: column; align-items: center; } }
  `,
})
export class GeneralInfoDialog {
  protected readonly data = inject<GeneralInfoDialogData>(MAT_DIALOG_DATA);
  protected readonly display = generalDisplayData(this.data.generalDefinitionId);
  protected readonly name = this.display?.name ?? generalDisplayName(this.data.generalDefinitionId);
}
```

Run: `npx jest projects/app/src/app/game-board/general-info-dialog.spec.ts`
Expected: PASS. If the unknown-General test fails on the name, check that `generalDisplayName('no-such-general')` title-cases the id (`titleCaseId` in `labels.ts`). It should give "No Such General".

- [ ] **Step 4: Write the avatar tests**

Create `projects/app/src/app/game-board/seat-avatar.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { SeatGenerals } from 'engine';
import { SeatAvatar } from './seat-avatar';

function render(generals: SeatGenerals): HTMLElement {
  const fixture = TestBed.createComponent(SeatAvatar);
  fixture.componentRef.setInput('generals', generals);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const half = (el: HTMLElement, slot: 'main' | 'deputy') => el.querySelector(`.half[data-slot="${slot}"]`) as HTMLButtonElement;
const src = (h: Element) => (h.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ?? null;

describe('SeatAvatar', () => {
  afterEach(() => document.querySelector('.cdk-overlay-container')?.replaceChildren());

  it('puts the Main General on the left and the Deputy on the right, in one frame', () => {
    const el = render({
      main: { generalDefinitionId: 'guan-yu', revealed: true },
      deputy: { generalDefinitionId: 'zhang-fei', revealed: true },
    });
    const halves = [...el.querySelectorAll('.frame > .half')];
    expect(halves.map((h) => h.getAttribute('data-slot'))).toEqual(['main', 'deputy']);
    expect(src(halves[0])).toBe('/card-art/generals/shu/guan-yu.jpg');
    expect(src(halves[1])).toBe('/card-art/generals/shu/zhang-fei.jpg');
    expect(half(el, 'main').querySelector('.caption')!.textContent!.trim()).toBe('Guan Yu');
    expect(half(el, 'deputy').querySelector('.caption')!.textContent!.trim()).toBe('Zhang Fei');
  });

  it('shows the card back and “Hidden” for another seat’s hidden General, keeping Main left (Review Focus 1)', () => {
    const el = render({
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'zhao-yun', revealed: true },
    });
    expect(src(half(el, 'main'))).toBe('/card-art/generals/unnamed.jpg');
    expect(half(el, 'main').querySelector('.caption')!.textContent!.trim()).toBe('Hidden');
    expect(src(half(el, 'deputy'))).toBe('/card-art/generals/shu/zhao-yun.jpg');
    expect(el.textContent).not.toContain('hidden');
  });

  it('shows your own hidden General’s real art, dimmed, with an eye-off mark (Review Focus 2)', () => {
    const el = render({
      main: { generalDefinitionId: 'cao-cao', revealed: false },
      deputy: { generalDefinitionId: 'zhen-ji', revealed: true },
    });
    const main = half(el, 'main');
    expect(src(main)).toBe('/card-art/generals/wei/cao-cao.jpg');
    expect(main.classList).toContain('own-hidden');
    expect(main.querySelector('mat-icon')!.textContent!.trim()).toBe('visibility_off');
    expect(main.querySelector('.caption')!.textContent!.trim()).toBe('Cao Cao (hidden)');
    expect(half(el, 'deputy').classList).not.toContain('own-hidden');
  });

  it('renders a captioned placeholder, not a broken image, for a General with no art (Review Focus 3)', () => {
    const el = render({
      main: { generalDefinitionId: 'no-such-general', revealed: true },
      deputy: { generalDefinitionId: 'zhen-ji', revealed: true },
    });
    const main = half(el, 'main');
    expect(main.querySelector('img')).toBeNull();
    expect(main.querySelector('.placeholder')).not.toBeNull();
    expect(main.querySelector('.caption')!.textContent!.trim()).toBe('No Such General');
  });

  it('opens the General’s info from a known half, and nothing from another seat’s hidden half (Review Focus 4)', async () => {
    const el = render({
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'guan-yu', revealed: true },
    });
    expect(half(el, 'main').disabled).toBe(true);
    half(el, 'main').click();
    await new Promise((r) => setTimeout(r));
    expect(document.querySelector('.cdk-overlay-container app-general-info-dialog')).toBeNull();

    expect(half(el, 'deputy').getAttribute('aria-label')).toBe('Info: Guan Yu');
    half(el, 'deputy').click();
    await new Promise((r) => setTimeout(r));
    const info = document.querySelector('.cdk-overlay-container app-general-info-dialog')!;
    expect(info.textContent).toContain('Fighting Saint');
  });
});
```

Run: `npx jest projects/app/src/app/game-board/seat-avatar.spec.ts`
Expected: FAIL with "Cannot find module './seat-avatar'".

- [ ] **Step 5: Implement the avatar**

Create `projects/app/src/app/game-board/seat-avatar.ts`:

```ts
import { Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { GeneralInstance, SeatGenerals } from 'engine';
import { cardArtUrl, generalDisplayData, HIDDEN_GENERAL_ART_URL } from 'content';
import { generalDisplayName } from '../labels';
import { GeneralInfoDialog, GeneralInfoDialogData } from './general-info-dialog';

const HIDDEN_ID = 'hidden';

interface AvatarHalf {
  slot: 'main' | 'deputy';
  id: string;
  // Another seat's General that hasn't been revealed: only the card back is known.
  masked: boolean;
  // The viewer's own General that is still face-down to everyone else.
  ownHidden: boolean;
  url: string | null;
  caption: string;
  name: string;
}

function toHalf(slot: 'main' | 'deputy', general: GeneralInstance): AvatarHalf {
  const id = general.generalDefinitionId;
  if (id === HIDDEN_ID) {
    return { slot, id, masked: true, ownHidden: false, url: HIDDEN_GENERAL_ART_URL, caption: 'Hidden', name: 'Hidden General' };
  }
  const name = generalDisplayData(id)?.name ?? generalDisplayName(id);
  const ownHidden = !general.revealed;
  return { slot, id, masked: false, ownHidden, url: cardArtUrl(id), caption: ownHidden ? `${name} (hidden)` : name, name };
}

// One seat's Generals as a single split portrait: Main left, Deputy right.
// The frame takes the force colour from the enclosing tile's --force.
@Component({
  selector: 'app-seat-avatar',
  imports: [MatIconModule],
  template: `
    <div class="frame">
      @for (h of halves(); track h.slot) {
        <button
          type="button"
          class="half"
          [attr.data-slot]="h.slot"
          [class.own-hidden]="h.ownHidden"
          [disabled]="h.masked"
          [attr.aria-label]="h.masked ? h.name : 'Info: ' + h.name"
          (click)="openInfo(h)"
        >
          @if (h.url; as url) {
            <img [src]="url" [alt]="h.name" />
          } @else {
            <span class="placeholder"></span>
          }
          @if (h.ownHidden) {
            <mat-icon class="eye-off" aria-hidden="true">visibility_off</mat-icon>
          }
          <span class="caption">{{ h.caption }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .frame {
      display: flex;
      width: 146px;
      height: 96px;
      border: 2px solid var(--force, var(--force-none));
      border-radius: 10px;
      overflow: hidden;
      box-sizing: border-box;
      background: #f1ece2;
    }
    .half {
      position: relative;
      flex: 1;
      min-width: 0;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      display: block;
    }
    .half + .half { border-left: 1px solid rgb(0 0 0 / 35%); }
    .half:disabled { cursor: default; }
    .half:focus-visible { outline: 2px solid #1565c0; outline-offset: -2px; }
    img, .placeholder { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .placeholder { background: #e0d8c6; }
    .own-hidden img { filter: brightness(0.6) saturate(0.6); }
    .eye-off { position: absolute; top: 3px; right: 3px; font-size: 16px; width: 16px; height: 16px; color: #fff; }
    .caption {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 2px 2px;
      font-size: 0.62em;
      line-height: 1.15;
      color: #fff;
      background: linear-gradient(transparent, rgb(0 0 0 / 70%));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class SeatAvatar {
  readonly generals = input.required<SeatGenerals>();

  protected readonly halves = computed(() => [toHalf('main', this.generals().main), toHalf('deputy', this.generals().deputy)]);

  private readonly dialog = inject(MatDialog);

  protected openInfo(h: AvatarHalf): void {
    if (h.masked) return;
    this.dialog.open<GeneralInfoDialog, GeneralInfoDialogData>(GeneralInfoDialog, {
      data: { generalDefinitionId: h.id },
      width: 'min(92vw, 520px)',
    });
  }
}
```

Run: `npx jest projects/app/src/app/game-board/seat-avatar.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Update the seat tile tests to expect the avatar**

In `projects/app/src/app/game-board/seat-tile.spec.ts`, make these changes:

1. In `'shows the seat name, hidden kingdom and generals, HP and hand count'`, replace `expect(text).toContain('Hidden General');` with:

```ts
    expect(el.querySelectorAll('app-seat-avatar .half')).toHaveLength(2);
    expect(el.querySelector('app-seat-avatar .half[data-slot="main"] .caption')!.textContent!.trim()).toBe('Hidden');
```

2. In `'renders portraits for revealed generals'`, replace the two `portrait` lines with:

```ts
    const portrait = el.querySelector('app-seat-avatar .half[data-slot="main"] img') as HTMLImageElement;
    expect(portrait.getAttribute('src')).toBe('/card-art/generals/shu/zhao-yun.jpg');
```

3. In `'shows a placeholder for a seat still choosing generals'`, replace the `app-card-art` assertion with:

```ts
    expect(el.querySelector('app-seat-avatar')).toBeNull();
```

4. In `'draws general portraits at normal size and equipment slots at small size'`, replace the first `expect` with:

```ts
    expect(el.querySelector('app-seat-avatar .frame')).not.toBeNull();
```

Run: `npx jest projects/app/src/app/game-board/seat-tile.spec.ts`
Expected: FAIL. The tile still renders `<app-card-art>`, so `app-seat-avatar` isn't found.

- [ ] **Step 7: Use the avatar in the seat tile**

In `projects/app/src/app/game-board/seat-tile.ts`:

- Imports: replace `import { CardArt } from './card-art';` with `import { SeatAvatar } from './seat-avatar';`. In the `imports` array, replace `CardArt` with `SeatAvatar`.
- Template: replace the whole `@if (seat().generals; as generals) { ... }` block inside `<div class="generals">` with:

```html
        @if (seat().generals; as generals) {
          <app-seat-avatar [generals]="generals" />
        } @else {
          <span class="choosing">Choosing Generals…</span>
        }
```

- Class: delete `protected readonly generalDisplayName = generalDisplayName;`. Remove `generalDisplayName` from the `../labels` import if nothing else in the file uses it.
- Leave `.generals { ... min-height: 96px; ... }` as it is, so a choosing seat keeps the same height.

Run: `npx jest projects/app/src/app/game-board/seat-tile.spec.ts projects/app/src/app/game-board/seat-avatar.spec.ts projects/app/src/app/game-board/round-table.spec.ts projects/app/src/app/game-board/game-board.spec.ts`
Expected: PASS. If `round-table.spec.ts` or `game-board.spec.ts` query `.generals app-card-art`, change them to `app-seat-avatar .half img` and keep the same expectations.

- [ ] **Step 8: Run the whole suite and the app build**

Run: `npx jest`
Expected: PASS. All suites, plus 3 new spec files.

Run: `npx ng build app`
Expected: build succeeds with no new warnings about component styles budget. If the `anyComponentStyle` budget in `angular.json` warns for `seat-avatar.ts`, trim comments from the styles. Don't raise the budget.

- [ ] **Step 9: Look at it running**

Run the app (`npm start`). Start a 5-seat game and finish General selection. Check:
- Your tile shows your two Generals in one frame. Main is left, and hidden ones are dimmed with the eye-off mark.
- Bot tiles show card backs captioned "Hidden".
- At 10 seats, tiles don't overlap any more than before.
- Clicking a known half opens the General info popup.

Fix any layout issue before committing.

- [ ] **Step 10: Commit**

```bash
git add projects/content/src/lib/assets.ts projects/content/src/lib/assets.spec.ts \
  projects/app/src/app/game-board/general-info-dialog.ts projects/app/src/app/game-board/general-info-dialog.spec.ts \
  projects/app/src/app/game-board/seat-avatar.ts projects/app/src/app/game-board/seat-avatar.spec.ts \
  projects/app/src/app/game-board/seat-tile.ts projects/app/src/app/game-board/seat-tile.spec.ts
git add -u projects/app
git commit -m "feat(app): split-portrait seat avatar, Main left and Deputy right, with General info

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
