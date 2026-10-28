# Vietnamese Localization, Phase 3d (App Shell, Wording Decisions, Small Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Apply the user's Vietnamese wording decisions of 2026-10-16 to the catalog and the content prose. (2) Translate the app shell that sits above every screen (the toolbar: navigation, account menu, music and sound buttons, and the title). (3) Close three small review findings from phase 3. English stays identical.

**Architecture:** Task 1 changes only Vietnamese text: the expectations in the Vietnamese specs are changed first so they fail, then `vi.ts` and `prose.json` are changed, then the spec's glossary records the terms. Task 2 applies the established pattern to `app.html` and `app.ts`: the `t` pipe in the template, `MessageKey`-typed page lists, and a `title` computed that reads the translator. Task 3 types `roleName`, adds a GameBoard test that proves the translator reaches the history, and corrects one comment.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Jest (`app` and `content` projects), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` (phase 3)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-3d` on branch `feat/vietnamese-phase-3d`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. Every existing English spec (including `app.spec.ts`, `game-board.spec.ts`, `general-selection.spec.ts`) must pass WITHOUT edits. Only the Vietnamese specs (`*.vi.spec.ts`) change, and only their Vietnamese expectations.
- The user's wording decisions (2026-10-16), all to be applied exactly:
  1. Counts as: **tính là** (judgment area title "Khu phán xét: {card} tính là {as}", badge "Tính là {card}", conversion label "Tính là {card} · {ability}"). "Dùng … làm" (use as) is unchanged.
  2. Mounts: Defensive Mount **"Tọa kỵ thủ +1"**, Offensive Mount **"Tọa kỵ công -1"**.
  3. Pile under a General (Refusing Death's wound cards): **"Lá bài Sang"**.
  4. Silenced badge: **"Mất kỹ năng"**.
  5. Combined HP: **"Tổng Sinh lực"**.
  6. Draw pile positions when arranging: **"Đầu chồng" / "Đáy chồng"**.
  7. Playing a card: **"đánh"** in buttons, labels and prompts ("Đánh Sát", button "Đánh bài"). The phase name stays "giai đoạn ra bài".
  8. Respond: **"phản hồi"** everywhere (every "đáp lại" becomes "phản hồi").
  9. Turn over: **"lật mặt"** (unchanged).
  10. Role chips and slot labels in General selection: Main = **"Chủ tướng"**, Deputy = **"Phó tướng"** (the sentences keep "Tướng chính" / "Tướng phụ").
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences.
- Jest and `tsc` do not type-check Angular templates: Tasks 2 and 3 run `npx ng build app --configuration development`. If it reports a nullable value passed to a pipe parameter, add a `!` only where an enclosing `@if` guarantees it, and ledger a ruling.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the projects: `npx jest --selectProjects app content --maxWorkers=50%`.

## Review Focus

- After Task 1 no Vietnamese string in `vi.ts` or `prose.json` still says "đáp lại" or plays a card with "ra" (apart from the phase names "ra bài"), and "Tọa kỵ", "Lá bài Sang", "Mất kỹ năng", "Tổng Sinh lực", "Đầu chồng", "Đáy chồng" and "tính là" are used as decided.
- After Task 2 the whole toolbar changes language in place: the four navigation labels and their aria labels, both menus' page names, the account menu, the sign-in link, the two toggles' labels and tooltips (both states), and the title; and English is byte-identical (the existing `app.spec.ts` passes unedited).
- The `cardPages`/`rulesPages` lists keep their paths and order; only the label becomes a key.
- After Task 3 `roleName` accepts only `'Main' | 'Deputy'` (if the strict template check shows the chip's role is wider, the plan's fallback is to keep `string` and ledger a ruling), the GameBoard test fails if the translator argument is dropped from the history computed, and the comment is accurate.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/vi.ts`, `content/data/locales/vi/prose.json` | Task 1: the Vietnamese wording. |
| `app/src/app/**/*.vi.spec.ts`, `content/src/lib/prose.vi.spec.ts` | Task 1: Vietnamese expectations follow. |
| `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` | Task 1: the glossary records the decisions. |
| `app/src/app/i18n/en.ts`, `vi.ts` | Task 2: about 30 new `nav.*` and `app.title` keys. |
| `app/src/app/app.html`, `app/src/app/app.ts` | Task 2: the toolbar through the translator. |
| `app/src/app/app.vi.spec.ts` | Task 2: new, the toolbar in Vietnamese. |
| `app/src/app/game-board/general-selection.ts`, `game-board.ts` | Task 3: typed `roleName`, comment. |
| `app/src/app/game-board/game-board.vi.spec.ts` | Task 3: new, the history in Vietnamese through the board. |

---

### Task 1: Apply the wording decisions

**Files:**
- Modify: `projects/app/src/app/i18n/vi.ts`, `projects/content/data/locales/vi/prose.json`, `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`, and every `*.vi.spec.ts` whose expectations change
- Test: the existing Vietnamese specs, edited first

**Interfaces:**
- Consumes: nothing new.
- Produces: the updated Vietnamese text.

- [ ] **Step 1: Change the Vietnamese expectations in the specs first**

Apply this script from the worktree root (`python3 -`). It rewrites only Vietnamese phrases inside the `*.vi.spec.ts` files; English expectations contain none of these phrases. It prints which files changed.

```python
import glob, re

files = sorted(glob.glob('projects/app/src/app/**/*.vi.spec.ts', recursive=True) + ['projects/content/src/lib/prose.vi.spec.ts'])

RULES = [
    # 7. play a card: "đánh" (the phase name "giai đoạn ra bài" has a lowercase "ra b" and is left alone)
    (r"\bRa (?=[A-Z])", "Đánh "),
    (r"\bRa bài", "Đánh bài"),
    (r"(?<= )ra (?=[A-Z])", "đánh "),
    (r"ra thêm một Sát", "đánh thêm một Sát"),
    (r"thể ra (Sát|Thiểm)", r"thể đánh \1"),
    (r"để ra Sát", "để đánh Sát"),
    # 8. respond: "phản hồi"
    (r"đáp lại", "phản hồi"),
    (r"Đáp lại", "Phản hồi"),
    # 1. counts as: "tính là"
    (r"Capture làm Sha", "Capture tính là Sha"),
    (r"'Làm Sha'", "'Tính là Sha'"),
    (r"'Làm Sha · ", "'Tính là Sha · "),
    # 2. mounts
    (r"Ngựa phòng thủ", "Tọa kỵ thủ +1"),
    (r"Ngựa tấn công", "Tọa kỵ công -1"),
    # 3, 4, 5
    (r"'Dưới Tướng'", "'Lá bài Sang'"),
    (r"'Không có kỹ năng'", "'Mất kỹ năng'"),
    (r"Sinh lực tổng", "Tổng Sinh lực"),
    # 10. role chips: Main / Deputy
    (r"toBe\('Chính'\)", "toBe('Chủ tướng')"),
    (r"toBe\('Phụ'\)", "toBe('Phó tướng')"),
]
ARRANGE = [(r"'Trên'", "'Đầu chồng'"), (r"'Dưới'", "'Đáy chồng'")]  # 6, only in the dialogs spec

changed = []
for path in files:
    s = open(path).read()
    t = s
    for pattern, new in RULES:
        t = re.sub(pattern, new, t)
    if path.endswith('dialogs.vi.spec.ts'):
        for pattern, new in ARRANGE:
            t = re.sub(pattern, new, t)
    if t != s:
        open(path, 'w').write(t)
        changed.append(path)
print("\n".join(changed))
```

- [ ] **Step 2: Run the Vietnamese specs to verify they fail on exactly the changed wording**

Run: `npx jest --selectProjects app content --maxWorkers=50% --testPathPattern '\.vi\.spec\.ts$'`
Expected: FAIL in the specs the script changed (the catalogs still hold the old wording), and nothing fails for any other reason. If a spec fails on something the script did not touch, stop and ledger it.

- [ ] **Step 3: Change the catalog and the prose**

Apply this script from the worktree root (`python3 -`). Each `set_vi` asserts it replaced exactly one line; each prose swap asserts its count.

```python
import re

VI = 'projects/app/src/app/i18n/vi.ts'
PROSE = 'projects/content/data/locales/vi/prose.json'

def set_vi(key, value):
    s = open(VI).read()
    pattern = re.compile(r"^  '" + re.escape(key) + r"': '.*',$", re.M)
    assert len(pattern.findall(s)) == 1, key
    open(VI, 'w').write(pattern.sub(lambda _m: f"  '{key}': '{value}',", s))

NEW = {
    # 8. respond: "phản hồi"
    'history.usedInResponse': '{seat} dùng {used} để phản hồi',
    'label.action.respond': 'Phản hồi bằng {card}',
    'response.yourTurn': 'Đến lượt bạn phản hồi',
    'response.respondTo': 'Đến lượt bạn phản hồi {card}',
    'response.answeredWith': '{seat} phản hồi bằng {card}',
    'response.waiting.answer': 'Đang chờ {seat} phản hồi {card}',
    'seat.responding': 'Đang phản hồi…',
    'respDialog.title': 'Cần phản hồi',
    'respDialog.choose': 'Chọn cách phản hồi',
    'respDialog.noSkills': 'Không có kỹ năng nào có thể phản hồi',
    'respDialog.noCards': 'Không có lá bài nào có thể phản hồi',
    'respDialog.none': 'Không phản hồi',
    # 7. play a card: "đánh"
    'label.action.play': 'Đánh {card}',
    'label.action.playTargeting': 'Đánh {card} nhắm vào {targets}',
    'response.dying.prompt': 'Đánh {peach} để cứu {who}?',
    'response.dying.promptWine': 'Đánh {peach} hoặc {wine} để cứu {who}?',
    'response.cancelIt': 'Đánh {card} để hủy?',
    'response.played': '{seat} đánh {card}',
    'response.playedAgainst': '{seat} đánh {card} nhắm vào {targets}',
    'response.playAt': 'Đánh {card} vào {target}?',
    'response.upheaval.prompt': 'Đánh {sha} vào {target}, hoặc mất 1 Sinh lực?',
    'response.instigate.prompt': 'Đánh {sha} vào {target}, hoặc bỏ một lá bài?',
    'response.waiting.playSha': 'Đang chờ {seat} đánh {sha} cho {ability}',
    'hand.play': 'Đánh bài',
    # 1. counts as: "tính là"
    'label.asCardVia': 'Tính là {card} · {ability}',
    'seat.judgmentTitleAs': 'Khu phán xét: {card} tính là {as}',
    'seat.countsAs': 'Tính là {card}',
    # 2. mounts, 3. wound pile, 4. silenced, 5. combined HP, 6. pile positions
    'slot.defensiveMount': 'Tọa kỵ thủ +1',
    'slot.offensiveMount': 'Tọa kỵ công -1',
    'seat.underGeneral': 'Lá bài Sang',
    'seat.noSkills': 'Mất kỹ năng',
    'select.combinedHp': '· Tổng Sinh lực: {hp}',
    'arrangeDialog.top': 'Đầu chồng',
    'arrangeDialog.bottom': 'Đáy chồng',
    # 10. role chips
    'select.main': 'Chủ tướng',
    'select.deputy': 'Phó tướng',
}
for key, value in NEW.items():
    set_vi(key, value)

def swap(old, new, count=1):
    s = open(PROSE).read()
    assert s.count(old) == count, (old, s.count(old))
    open(PROSE, 'w').write(s.replace(old, new))

swap('"Ra thêm một Sát vào {target}"', '"Đánh thêm một Sát vào {target}"')
swap('{target} không thể ra Thiểm chống lại Sát này', '{target} không thể đánh Thiểm chống lại Sát này')
swap('"Chọn một người chơi ra Sát vào bạn, hoặc bạn bỏ một lá bài của họ"', '"Chọn một người chơi đánh Sát vào bạn, hoặc bạn bỏ một lá bài của họ"')
swap('"Chọn một người chơi để ra Sát vào bạn"', '"Chọn một người chơi để đánh Sát vào bạn"')
swap('"Chọn một người chơi để ra Sát vào, hoặc bỏ qua"', '"Chọn một người chơi để đánh Sát vào, hoặc bỏ qua"')
swap('{user} có thể ra thêm một Sát trong lượt này', '{user} có thể đánh thêm một Sát trong lượt này')
swap('{user} không thể ra Sát trong lượt này', '{user} không thể đánh Sát trong lượt này')
```

- [ ] **Step 4: Check nothing of the old wording is left, and record the terms in the spec's glossary**

Run: `grep -nE "đáp lại|Đáp lại|Ngựa phòng thủ|Ngựa tấn công|Dưới Tướng|Sinh lực tổng" projects/app/src/app/i18n/vi.ts projects/content/data/locales/vi/prose.json`
Expected: no output. Then run: `grep -nE "(^|[^a-zà-ỹ])[Rr]a ([A-Z{]|bài|thêm)" projects/app/src/app/i18n/vi.ts projects/content/data/locales/vi/prose.json`
Expected: only the phase name line `'history.phase.Play': 'ra bài'` and the prose line `decentralization` ("Bỏ qua giai đoạn ra bài; …"). Anything else is a play verb that was missed: fix it with "đánh" and add it to the spec edits.

In `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`, add these lines to the terminology section, directly after the line that starts `- Compete (a skill's point contest)`:

```
- Wording decisions of 2026-10-16: counts as = tính là; Defensive Mount = Tọa kỵ thủ +1; Offensive Mount = Tọa kỵ công -1; the pile under a General (Refusing Death) = Lá bài Sang; silenced seat = Mất kỹ năng; Combined HP = Tổng Sinh lực; draw pile positions = Đầu chồng / Đáy chồng; playing a card = đánh (the phase stays "giai đoạn ra bài"); respond = phản hồi; turn over = lật mặt; role chips Main = Chủ tướng, Deputy = Phó tướng.
```

- [ ] **Step 5: Run the Vietnamese specs, the parity test and the whole two projects**

Run: `npx jest --selectProjects app content --maxWorkers=50%`
Expected: every suite passes, with no English expectation edited. If a Vietnamese spec still fails, compare its expectation with the new text in Step 3 and fix whichever disagrees with the user's decision (record a ruling if you change a spec rule from Step 1).

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/i18n/vi.ts projects/content/data/locales/vi/prose.json docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md $(git diff --name-only -- '*.vi.spec.ts')
git commit -m "feat(app): apply the Vietnamese wording decisions (đánh, phản hồi, tính là, Tọa kỵ, and the rest)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The app shell through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/app.html`, `projects/app/src/app/app.ts`
- Test: `projects/app/src/app/app.vi.spec.ts` (new); the existing `app.spec.ts` must pass unedited

**Interfaces:**
- Consumes: `TPipe`, `I18n`, `MessageKey`.
- Produces: the `nav.*` and `app.title` catalog keys.

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/app.vi.spec.ts`:

```ts
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Me } from 'protocol';
import { App } from './app';
import { AuthService } from './auth/auth.service';
import { I18n } from './i18n/i18n.service';
import { MUSIC_PLAYER_FACTORY } from './music.service';

const me = signal<Me | null>(null);
const loaded = signal(true);
const fakeAuth = {
  me,
  loaded,
  isRegistered: computed(() => me()?.kind === 'registered'),
  load: jest.fn(async () => me()),
  signOut: jest.fn(async () => me.set(null)),
};
const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;

describe('App shell in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    me.set(null);
    loaded.set(true);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: fakeAuth },
        { provide: MUSIC_PLAYER_FACTORY, useValue: () => ({ loop: false, volume: 1, play: () => Promise.resolve(), pause: () => undefined }) },
        provideRouter([{ path: 'setup', children: [] }, { path: 'wiki/:page', children: [] }, { path: 'wiki/rules/:page', children: [] }, { path: 'sign-in', children: [] }, { path: 'sign-up', children: [] }]),
      ],
    }).compileComponents();
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => {
    localStorage.clear();
    overlay()?.replaceChildren();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const menuItems = () => [...document.querySelectorAll('.mat-mdc-menu-panel [mat-menu-item]')].map((i) => text(i));

  it('the title, the four navigation items and their aria labels', async () => {
    const { el } = await render();
    expect(text(el.querySelector('mat-toolbar h1'))).toBe('Quốc chiến');
    expect([...el.querySelectorAll('nav.nav .label')].map((l) => text(l))).toEqual(['Chơi', 'Trực tuyến', 'Bài', 'Luật']);
    expect([...el.querySelectorAll('nav.nav > a, nav.nav > button')].map((i) => i.getAttribute('aria-label'))).toEqual(['Chơi', 'Trực tuyến', 'Bài', 'Luật']);
  });

  it('the Cards and Rules menus name their pages in Vietnamese', async () => {
    const { fixture, el } = await render();
    (el.querySelector('nav.nav button.nav-cards') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems()).toEqual(['Tướng', 'Bài cơ bản', 'Trang bị', 'Cẩm nang']);
    overlay().replaceChildren();
    (el.querySelector('nav.nav button.nav-rules') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems()).toEqual(['Tổng quan', 'Loại bài', 'Chuẩn bị', 'Cấu trúc lượt', 'Khoảng cách / Tầm', 'Phán xét']);
  });

  it('signed out, the sign-in link; as a guest, the account menu', async () => {
    const signedOut = await render();
    expect(text(signedOut.el.querySelector('a.sign-in .label'))).toBe('Đăng nhập');
    me.set({ id: 'u2', kind: 'guest', displayName: 'Guest' });
    const guest = await render();
    expect(guest.el.querySelector('button.account')!.getAttribute('aria-label')).toBe('Tài khoản');
    (guest.el.querySelector('button.account') as HTMLButtonElement).click();
    guest.fixture.detectChanges();
    await guest.fixture.whenStable();
    expect(menuItems()).toEqual(['Đang chơi với tư cách khách', 'Tạo tài khoản', 'Đăng xuất']);
  });

  it('a registered account shows its email, not the guest line', async () => {
    me.set({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { fixture, el } = await render();
    (el.querySelector('button.account') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems()).toEqual(['ann@example.com', 'Đăng xuất']);
  });

  it('the music and sound buttons, in both states, label and tooltip', async () => {
    const { fixture, el } = await render();
    const music = el.querySelector('button.music-toggle') as HTMLButtonElement;
    const effects = el.querySelector('button.effects-toggle') as HTMLButtonElement;
    expect([music.getAttribute('aria-label'), music.getAttribute('title')]).toEqual(['Tắt nhạc', 'Tắt nhạc']);
    expect([effects.getAttribute('aria-label'), effects.getAttribute('title')]).toEqual(['Tắt hiệu ứng âm thanh', 'Tắt hiệu ứng âm thanh']);
    music.click();
    effects.click();
    fixture.detectChanges();
    expect([music.getAttribute('aria-label'), music.getAttribute('title')]).toEqual(['Bật nhạc', 'Bật nhạc']);
    expect([effects.getAttribute('aria-label'), effects.getAttribute('title')]).toEqual(['Bật hiệu ứng âm thanh', 'Bật hiệu ứng âm thanh']);
  });

  it('follows a language switch in place, title included', async () => {
    const { fixture, el } = await render();
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(text(el.querySelector('mat-toolbar h1'))).toBe('Guozhan');
    expect([...el.querySelectorAll('nav.nav .label')].map((l) => text(l))).toEqual(['Play', 'Online', 'Cards', 'Rules']);
    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(text(el.querySelector('mat-toolbar h1'))).toBe('Quốc chiến');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --maxWorkers=50% --runTestsByPath projects/app/src/app/app.vi.spec.ts`
Expected: FAIL: the shell still renders English. If a test fails for a fixture reason (the `Me` shape, the menu not opening, the music toggle's initial state), compare it with `app.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'app.title': 'Guozhan',
  'nav.play': 'Play',
  'nav.online': 'Online',
  'nav.cards': 'Cards',
  'nav.rules': 'Rules',
  'nav.cards.generals': 'Generals',
  'nav.cards.basic': 'Basic Cards',
  'nav.cards.equipment': 'Equipment',
  'nav.cards.tools': 'Tools',
  'nav.rules.overview': 'Overview',
  'nav.rules.cardTypes': 'Card Types',
  'nav.rules.setup': 'Setup',
  'nav.rules.turn': 'Turn Structure',
  'nav.rules.distance': 'Distance / Range',
  'nav.rules.judgment': 'Judgment',
  'nav.account': 'Account',
  'nav.guest': 'Playing as a guest',
  'nav.createAccount': 'Create Account',
  'nav.signOut': 'Sign Out',
  'nav.signIn': 'Sign In',
  'nav.musicOff': 'Turn Music Off',
  'nav.musicOn': 'Turn Music On',
  'nav.effectsOff': 'Turn Sound Effects Off',
  'nav.effectsOn': 'Turn Sound Effects On',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'app.title': 'Quốc chiến',
  'nav.play': 'Chơi',
  'nav.online': 'Trực tuyến',
  'nav.cards': 'Bài',
  'nav.rules': 'Luật',
  'nav.cards.generals': 'Tướng',
  'nav.cards.basic': 'Bài cơ bản',
  'nav.cards.equipment': 'Trang bị',
  'nav.cards.tools': 'Cẩm nang',
  'nav.rules.overview': 'Tổng quan',
  'nav.rules.cardTypes': 'Loại bài',
  'nav.rules.setup': 'Chuẩn bị',
  'nav.rules.turn': 'Cấu trúc lượt',
  'nav.rules.distance': 'Khoảng cách / Tầm',
  'nav.rules.judgment': 'Phán xét',
  'nav.account': 'Tài khoản',
  'nav.guest': 'Đang chơi với tư cách khách',
  'nav.createAccount': 'Tạo tài khoản',
  'nav.signOut': 'Đăng xuất',
  'nav.signIn': 'Đăng nhập',
  'nav.musicOff': 'Tắt nhạc',
  'nav.musicOn': 'Bật nhạc',
  'nav.effectsOff': 'Tắt hiệu ứng âm thanh',
  'nav.effectsOn': 'Bật hiệu ứng âm thanh',
```

- [ ] **Step 4: Convert the toolbar**

Apply this script from the worktree root (`python3 -`). Every replacement asserts its count.

```python
import re

A = 'projects/app/src/app/'

def read(p):
    return open(p).read()

def swap(path, old, new, count=1):
    s = read(path)
    assert s.count(old) == count, (path, old, s.count(old))
    open(path, 'w').write(s.replace(old, new))

def add_import(path, line):
    s = read(path)
    last = list(re.finditer(r"^import[\s\S]*?;\n", s, re.M))[-1]
    open(path, 'w').write(s[:last.end()] + line + "\n" + s[last.end():])

# --- app.ts
p = A + 'app.ts'
add_import(p, "import { I18n } from './i18n/i18n.service';")
add_import(p, "import type { MessageKey } from './i18n/messages';")
add_import(p, "import { TPipe } from './i18n/t.pipe';")
swap(p, "MatMenuModule, LanguageSwitcher],", "MatMenuModule, LanguageSwitcher, TPipe],")
swap(p, "  protected readonly title = signal('Guozhan');\n", "  private readonly i18n = inject(I18n);\n  protected readonly title = computed(() => this.i18n.t('app.title'));\n")
swap(p, "import { Component, computed, inject, signal } from '@angular/core';", "import { Component, computed, inject } from '@angular/core';")
swap(p, "  protected readonly cardPages = [\n    { path: '/wiki/generals', label: 'Generals' },\n    { path: '/wiki/basic', label: 'Basic Cards' },\n    { path: '/wiki/equipment', label: 'Equipment' },\n    { path: '/wiki/tools', label: 'Tools' },\n  ];",
        "  protected readonly cardPages: { path: string; label: MessageKey }[] = [\n    { path: '/wiki/generals', label: 'nav.cards.generals' },\n    { path: '/wiki/basic', label: 'nav.cards.basic' },\n    { path: '/wiki/equipment', label: 'nav.cards.equipment' },\n    { path: '/wiki/tools', label: 'nav.cards.tools' },\n  ];")
swap(p, "  protected readonly rulesPages = [\n    { path: '/wiki/rules/overview', label: 'Overview' },\n    { path: '/wiki/rules/card-types', label: 'Card Types' },\n    { path: '/wiki/rules/setup', label: 'Setup' },\n    { path: '/wiki/rules/turn', label: 'Turn Structure' },\n    { path: '/wiki/rules/distance', label: 'Distance / Range' },\n    { path: '/wiki/rules/judgment', label: 'Judgment' },\n  ];",
        "  protected readonly rulesPages: { path: string; label: MessageKey }[] = [\n    { path: '/wiki/rules/overview', label: 'nav.rules.overview' },\n    { path: '/wiki/rules/card-types', label: 'nav.rules.cardTypes' },\n    { path: '/wiki/rules/setup', label: 'nav.rules.setup' },\n    { path: '/wiki/rules/turn', label: 'nav.rules.turn' },\n    { path: '/wiki/rules/distance', label: 'nav.rules.distance' },\n    { path: '/wiki/rules/judgment', label: 'nav.rules.judgment' },\n  ];")

# --- app.html
h = A + 'app.html'
def t(key):
    return "{{ '%s' | t }}" % key
def aria(key):
    return '[attr.aria-label]="\'%s\' | t"' % key
swap(h, 'aria-label="Play">', aria('nav.play') + '>')
swap(h, '<mat-icon>play_arrow</mat-icon><span class="label">Play</span>', '<mat-icon>play_arrow</mat-icon><span class="label">' + t('nav.play') + '</span>')
swap(h, 'aria-label="Online">', aria('nav.online') + '>')
swap(h, '<mat-icon>public</mat-icon><span class="label">Online</span>', '<mat-icon>public</mat-icon><span class="label">' + t('nav.online') + '</span>')
swap(h, 'aria-label="Cards">', aria('nav.cards') + '>')
swap(h, '<mat-icon fontSet="material-symbols-outlined">swords</mat-icon><span class="label">Cards</span>', '<mat-icon fontSet="material-symbols-outlined">swords</mat-icon><span class="label">' + t('nav.cards') + '</span>')
swap(h, 'aria-label="Rules">', aria('nav.rules') + '>')
swap(h, '<mat-icon>menu_book</mat-icon><span class="label">Rules</span>', '<mat-icon>menu_book</mat-icon><span class="label">' + t('nav.rules') + '</span>')
swap(h, 'ariaCurrentWhenActive="page">{{ page.label }}</a>', 'ariaCurrentWhenActive="page">{{ page.label | t }}</a>', 2)
swap(h, 'aria-label="Account">', aria('nav.account') + '>')
swap(h, "{{ me.kind === 'guest' ? 'Playing as a guest' : me.email }}", "{{ me.kind === 'guest' ? ('nav.guest' | t) : me.email }}")
swap(h, 'routerLink="/sign-up">Create Account</a>', 'routerLink="/sign-up">' + t('nav.createAccount') + '</a>')
swap(h, '(click)="signOut()">Sign Out</button>', '(click)="signOut()">' + t('nav.signOut') + '</button>')
swap(h, '<mat-icon>login</mat-icon><span class="label">Sign In</span>', '<mat-icon>login</mat-icon><span class="label">' + t('nav.signIn') + '</span>')
swap(h, """[attr.aria-label]="music.enabled() ? 'Turn Music Off' : 'Turn Music On'\"""", """[attr.aria-label]="(music.enabled() ? 'nav.musicOff' : 'nav.musicOn') | t\"""")
swap(h, """[attr.title]="music.enabled() ? 'Turn Music Off' : 'Turn Music On'\"""", """[attr.title]="(music.enabled() ? 'nav.musicOff' : 'nav.musicOn') | t\"""")
swap(h, """[attr.aria-label]="effects.enabled() ? 'Turn Sound Effects Off' : 'Turn Sound Effects On'\"""", """[attr.aria-label]="(effects.enabled() ? 'nav.effectsOff' : 'nav.effectsOn') | t\"""")
swap(h, """[attr.title]="effects.enabled() ? 'Turn Sound Effects Off' : 'Turn Sound Effects On'\"""", """[attr.title]="(effects.enabled() ? 'nav.effectsOff' : 'nav.effectsOn') | t\"""")
```

Notes on the script: `title` becomes a `computed` that reads the translator, so `{{ title() }}` in the template is unchanged and follows the language; `signal` is dropped from the import because nothing else in `app.ts` uses it (if `tsc` reports it is still used, keep it in the import). The `account-summary` line keeps `me.email` for a registered account.

- [ ] **Step 5: Run the new spec and the existing shell spec**

Run: `npx jest --selectProjects app --maxWorkers=50% --runTestsByPath projects/app/src/app/app.vi.spec.ts projects/app/src/app/app.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS, with `app.spec.ts` unedited. If an existing English assertion fails, a key or template differs from the old string by a character: fix the replacement, never the existing spec.

- [ ] **Step 6: Typecheck, build the app (strict templates), check the specs, then run the whole project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx ng build app --configuration development && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app content --maxWorkers=50%`
Expected: no type errors; the build completes (this proves the pipe keys, the ternary keys and `page.label | t` under strict templates); the spec typecheck reports only the one older `selection-dialog.spec.ts` error; every suite passes.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/app.html projects/app/src/app/app.ts projects/app/src/app/app.vi.spec.ts
git commit -m "feat(app): the toolbar follows the language

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Three small fixes from the phase 3 review

**Files:**
- Modify: `projects/app/src/app/game-board/general-selection.ts`, `projects/app/src/app/game-board/game-board.ts`
- Test: `projects/app/src/app/game-board/game-board.vi.spec.ts` (new)

**Interfaces:**
- Consumes: the `GameService` flow used by `game-board.spec.ts` (`startGame`, `submit`, `legalActions`, `reveal`, `activeSeatId`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

`projects/app/src/app/game-board/game-board.vi.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameService } from '../game.service';
import { I18n } from '../i18n/i18n.service';
import { MUSIC_PLAYER_FACTORY } from '../music.service';
import { GameBoard } from './game-board';

function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') gameService.submit(gameService.legalActions()[0]);
}

describe('GameBoard in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [
        provideRouter([{ path: 'setup', children: [] }]),
        { provide: MUSIC_PLAYER_FACTORY, useValue: () => ({ loop: false, volume: 1, play: () => Promise.resolve(), pause: () => undefined }) },
      ],
    }).compileComponents();
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => localStorage.clear());

  it('the action history panel reads the log in Vietnamese, so the translator reaches the history', () => {
    const gameService = TestBed.inject(GameService);
    gameService.startGame(2, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const latest = (fixture.nativeElement as HTMLElement).querySelector('app-action-history .text')!.textContent!;
    expect(latest).toMatch(/rút \d+ lá bài|đã chọn Tướng của mình/);
    expect(latest).not.toMatch(/drew|chose/);
  });
});
```

- [ ] **Step 2: Run it to verify it passes now, then prove it can fail**

Run: `npx jest --selectProjects app --maxWorkers=50% --runTestsByPath projects/app/src/app/game-board/game-board.vi.spec.ts`
Expected: PASS (the wiring already exists from phase 3a). To prove the test pins it, temporarily remove `, this.i18n.translator` from the `actionHistory(...)` call in `game-board.ts`, re-run, and expect FAIL (English "drew"/"chose"); then restore the argument and re-run to see PASS again. Ledger that you did this check.

- [ ] **Step 3: Type `roleName` and correct the comment**

Apply this script from the worktree root (`python3 -`):

```python
G = 'projects/app/src/app/game-board/'

def swap(path, old, new, count=1):
    s = open(path).read()
    assert s.count(old) == count, (path, old, s.count(old))
    open(path, 'w').write(s.replace(old, new))

swap(G + 'general-selection.ts', "protected roleName(role: string): string {", "protected roleName(role: 'Main' | 'Deputy'): string {")
swap(G + 'game-board.ts',
     "  // The dialogs below describe their decision in the language that is on when they open\n"
     "  // (the open* methods run untracked): a language switch changes the next dialog, not\n"
     "  // an open one.\n",
     "  // The text that describes a decision (its prompt, option labels and the Compete result's\n"
     "  // names) is built when the dialog opens, in the language then on: the open* methods run\n"
     "  // untracked. A dialog's own fixed words do follow a switch, but dialogs are modal, so the\n"
     "  // toolbar cannot be reached while one is open.\n")
```

- [ ] **Step 4: Build (strict templates) and run everything**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx ng build app --configuration development && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app content --maxWorkers=50%`
Expected: no type errors and a successful build. If the build says the chip's role is wider than `'Main' | 'Deputy'` (a `string` or `null` reaching `roleName`), revert only that change (`roleName(role: string)`), keep the comment fix, and ledger the ruling; the spec typecheck reports only the older error; every suite passes.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/general-selection.ts projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/game-board.vi.spec.ts
git commit -m "fix(app): typed roleName, a history test through the board, an accurate dialog comment

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (the user's decisions of 2026-10-16, the app shell the phase 3 audit found, and the three small review findings):
- Nine wording decisions applied exactly, with the specs changed first and the glossary updated: Task 1.
- The toolbar (navigation, menus, account, sign-in, music and sound buttons, title) follows the language, English unchanged: Task 2.
- `roleName` typed, the translator-to-history wiring pinned, the dialog comment corrected: Task 3.
- Not in this plan, by design: the Wiki and Rules pages' content, the sign-in and account pages, the online screens, the error banner text and the 11 content choice labels (a later step), and card, ability and General names (phase 4).

**Placeholder scan:** none. Every rule, key, replacement and test is shown.

**Type consistency:** the `nav.*` keys used in Task 2's script all appear in its Step 3 with the same placeholders (none) in both languages; `page.label` is a `MessageKey`, so `page.label | t` type-checks only for catalog keys; `title` stays a zero-argument function in the template.

**Review Focus:** each line has a check: the grep in Task 1 Step 4 for leftover wording; Task 2's spec for every toolbar piece in both toggle states and a live switch; and Task 3's temporary-removal check.
