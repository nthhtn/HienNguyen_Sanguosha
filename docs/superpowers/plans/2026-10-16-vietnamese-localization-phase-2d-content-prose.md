# Vietnamese Localization, Phase 2d (Content Prose Tables) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the prose tables in `content/src/lib/display.ts` (ability hints, skill selection texts, seat-pick prompts, choice prompts, step selection texts, compete outcomes) available in Vietnamese, and have the choice, ask and selection builders show them when the translator speaks Vietnamese. English stays byte-identical.

**Architecture:** The `content` package must not depend on the app's translator, so its display functions take an optional `locale` string (default `'en'`) and read a per-locale prose file (`content/data/locales/vi/prose.json`), falling back to the English tables per entry. The English tables stay in `display.ts` unchanged and are exported as `ENGLISH_PROSE` so a parity spec can check that the Vietnamese file covers every English entry with the same placeholders. On the app side the `Translator` gains an optional `locale`: `makeTranslator(messages, locale)` sets it, `localeOf(tr)` reads it (English when absent), and `I18n.translator` reports the live locale from its signal. The builders already hold `tr`, so they pass `localeOf(tr)` to the content functions.

**Tech Stack:** TypeScript strict, Angular 22, Jest (`content` and `app` projects), JSON module imports (`resolveJsonModule` is on).

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` ("Architecture" and "Translator-based builders"; this plan adds `locale` to the translator contract)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-2cde` on branch `feat/vietnamese-phase-2cde`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. The existing app specs for the choice and ability descriptions, and every existing `content` spec, must pass WITHOUT edits. The English tables in `display.ts` are not edited.
- `content` must stay framework-free: it may not import anything from `app` or Angular.
- Vietnamese follows the spec's glossary and is sentence case: Tướng, Sinh lực, Điền, Hóa thân, đấu điểm, Cẩm nang, Vũ khí, Trang bị, Cơ bản, người chơi, giai đoạn. The three core cards use their decided names (Sát, Thiểm, Quyết Đấu). Skill names that the English prose spells out (Collapse, Follow the Master, Alliance) stay as they are for now; they follow the content names in phase 4.
- Every English `{placeholder}` appears the same number of times in its Vietnamese entry. The builders replace only the first `{target}`, so no hint or seat-pick entry may contain it twice.
- Change only: `display.ts`, the new JSON and specs in `content`; `translator.ts`, `i18n.service.ts`, `choice-description.ts`, `ability-description.ts` and the new and extended specs in `app`. Do NOT touch `compete-result.ts` or any component (phase 3: it will pass the locale to `competeOutcomeText`).
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>` (or `--selectProjects content`). Run both projects: `npx jest --selectProjects app content`.

## Review Focus

- A locale the content has no prose for (`fr`, an empty string), and an entry missing from the Vietnamese file, fall back to the English entry; an unknown ability id gives null in every language; an id such as `constructor` gives null instead of a function.
- The Vietnamese file covers exactly the English ids in each of the six tables, with the same placeholders and the same presence of `cancel`.
- A translator built with `makeTranslator(vi)` and no locale still yields English content prose (the locale, not the catalog, picks the prose), so every earlier spec keeps its English expectations.
- `I18n.translator.locale` follows `setLocale` through the signal, so a computed that calls a builder re-runs on a language change.
- `competeOutcomeText` in Vietnamese still replaces every `{user}` and `{target}` (the Rouse the Tiger entry has `{target}` twice).

---

## File Structure

| File | Responsibility |
|---|---|
| `content/data/locales/vi/prose.json` | Vietnamese prose for the six tables, keyed like the English ones. |
| `content/src/lib/display.ts` | Display functions take `locale`; `ENGLISH_PROSE` exported; English tables unchanged. |
| `content/src/lib/prose.vi.spec.ts` | New: parity, fallbacks, Vietnamese lookups. |
| `app/src/app/i18n/translator.ts` | `locale` on `Translator`, `makeTranslator(messages, locale?)`, `localeOf`. |
| `app/src/app/i18n/i18n.service.ts` | `translator` reports the live locale. |
| `app/src/app/game-board/{choice-description,ability-description}.ts` | Pass `localeOf(tr)` to the content prose functions. |
| `app/src/app/game-board/prose.vi.spec.ts` | New: builders show Vietnamese prose. |

---

### Task 1: Locale-aware prose tables in `content`

**Files:**
- Create: `projects/content/data/locales/vi/prose.json`
- Modify: `projects/content/src/lib/display.ts`
- Test: `projects/content/src/lib/prose.vi.spec.ts` (new)

**Interfaces:**
- Consumes: nothing from the app.
- Produces: `abilityHint(id, locale?)`, `selectionText(id, locale?)`, `seatPickText(id, locale?)`, `choicePromptText(id, locale?)`, `stepSelectionText(step, locale?)`, `competeOutcomeText(id, won, names, locale?)` (all with `locale` defaulting to `'en'`); `ENGLISH_PROSE`.

- [ ] **Step 1: Write the failing spec**

`projects/content/src/lib/prose.vi.spec.ts`:

```ts
import viProse from '../../data/locales/vi/prose.json';
import { ENGLISH_PROSE, abilityHint, choicePromptText, competeOutcomeText, seatPickText, selectionText, stepSelectionText } from './display';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const ids = (table: object) => Object.keys(table).sort();

describe('the Vietnamese prose file mirrors the English tables', () => {
  it('has exactly the English ids in each of the six tables', () => {
    for (const table of Object.keys(ENGLISH_PROSE) as (keyof typeof ENGLISH_PROSE)[]) {
      expect({ table, ids: ids(viProse[table]) }).toEqual({ table, ids: ids(ENGLISH_PROSE[table]) });
    }
  });

  it('keeps every placeholder of a hint, a seat pick and a choice prompt', () => {
    for (const table of ['hints', 'seatPick', 'choicePrompt'] as const) {
      const english: Record<string, string> = ENGLISH_PROSE[table];
      const vietnamese: Record<string, string> = viProse[table];
      for (const id of Object.keys(english)) {
        expect({ table, id, placeholders: placeholders(vietnamese[id]) }).toEqual({ table, id, placeholders: placeholders(english[id]) });
      }
    }
  });

  it('keeps placeholders, and the presence of a cancel label, in selection texts', () => {
    for (const table of ['selection', 'stepSelection'] as const) {
      const english: Record<string, { prompt: string; confirm: string; cancel?: string }> = ENGLISH_PROSE[table];
      const vietnamese: Record<string, { prompt: string; confirm: string; cancel?: string }> = viProse[table];
      for (const id of Object.keys(english)) {
        expect({ table, id, placeholders: placeholders(vietnamese[id].prompt) }).toEqual({ table, id, placeholders: placeholders(english[id].prompt) });
        expect({ table, id, hasCancel: 'cancel' in vietnamese[id] }).toEqual({ table, id, hasCancel: 'cancel' in english[id] });
      }
    }
  });

  it('keeps both placeholders in every compete outcome', () => {
    for (const id of Object.keys(ENGLISH_PROSE.competeOutcomes)) {
      const english = ENGLISH_PROSE.competeOutcomes[id];
      const vietnamese = viProse.competeOutcomes[id as keyof typeof viProse.competeOutcomes];
      expect({ id, won: placeholders(vietnamese.won), lost: placeholders(vietnamese.lost) }).toEqual({ id, won: placeholders(english.won), lost: placeholders(english.lost) });
    }
  });

  it('has no empty text, and no hint or seat pick with {target} twice', () => {
    const texts = [
      ...Object.values(viProse.hints), ...Object.values(viProse.seatPick), ...Object.values(viProse.choicePrompt),
      ...Object.values(viProse.selection).flatMap((t) => Object.values(t)), ...Object.values(viProse.stepSelection).flatMap((t) => Object.values(t)),
      ...Object.values(viProse.competeOutcomes).flatMap((t) => Object.values(t)),
    ];
    for (const text of texts) expect({ text, empty: text.trim() === '' }).toEqual({ text, empty: false });
    for (const text of [...Object.values(viProse.hints), ...Object.values(viProse.seatPick)]) {
      expect({ text, targets: placeholders(text).filter((p) => p === 'target').length <= 1 }).toEqual({ text, targets: true });
    }
  });
});

describe('the display functions by locale', () => {
  it('English is the default and is unchanged', () => {
    expect(abilityHint('axe')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(abilityHint('axe', 'en')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(selectionText('bestowed-rouse')).toEqual({ prompt: 'Choose drawn cards to give away', confirm: 'Give', cancel: 'Keep the Rest' });
    expect(seatPickText('alliance')).toBe('Choose a seat to swap hands with {target}');
    expect(choicePromptText('upheaval')).toBe('Choose a seat to play a Sha at, or pass');
    expect(stepSelectionText('compete-user')).toEqual({ prompt: 'Choose a hand card to compete with', confirm: 'Compete' });
  });

  it('Vietnamese returns the Vietnamese entry', () => {
    expect(abilityHint('axe', 'vi')).toBe('Bỏ 2 lá bài để Sát của bạn trúng {target}');
    expect(selectionText('bestowed-rouse', 'vi')).toEqual({ prompt: 'Chọn các lá bài vừa rút để đưa đi', confirm: 'Đưa', cancel: 'Giữ phần còn lại' });
    expect(seatPickText('alliance', 'vi')).toBe('Chọn một người chơi để đổi bài trên tay với {target}');
    expect(choicePromptText('upheaval', 'vi')).toBe('Chọn một người chơi để ra Sát vào, hoặc bỏ qua');
    expect(stepSelectionText('compete-user', 'vi')).toEqual({ prompt: 'Chọn một lá bài trên tay để đấu điểm', confirm: 'Đấu điểm' });
  });

  it('a locale with no prose, or an empty one, falls back to English', () => {
    expect(abilityHint('axe', 'fr')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(abilityHint('axe', '')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(selectionText('kindness', 'fr')).toEqual({ prompt: 'Choose cards to give', confirm: 'Give' });
  });

  it('an unknown ability is null in every language, even one named like an object property', () => {
    for (const locale of ['en', 'vi', 'fr']) {
      expect(abilityHint('no-such-ability', locale)).toBeNull();
      expect(abilityHint('constructor', locale)).toBeNull();
      expect(selectionText('toString', locale)).toBeNull();
      expect(seatPickText('__proto__', locale)).toBeNull();
      expect(choicePromptText('hasOwnProperty', locale)).toBeNull();
      expect(stepSelectionText('valueOf', locale)).toBeNull();
      expect(competeOutcomeText('constructor', true, { user: 'A', target: 'B' }, locale)).toBeNull();
    }
  });

  it('compete outcomes replace every {user} and {target}, in both languages', () => {
    const names = { user: 'Hing', target: 'Seat 1' };
    expect(competeOutcomeText('rouse-the-tiger', true, names)).toBe("Hing will choose a seat within Seat 1's attack range; Seat 1 deals it 1 damage");
    expect(competeOutcomeText('rouse-the-tiger', true, names, 'vi')).toBe('Hing sẽ chọn một người chơi trong tầm đánh của Seat 1; Seat 1 gây cho họ 1 sát thương');
    expect(competeOutcomeText('rouse-the-tiger', false, names, 'vi')).toBe('Seat 1 gây 1 sát thương cho Hing');
    expect(competeOutcomeText('intense-edge', false, names, 'vi')).toBe('Không có gì xảy ra');
    expect(competeOutcomeText('heavens-justice', false, names, 'vi')).toBe('Hing không thể ra Sát trong lượt này');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects content --runTestsByPath projects/content/src/lib/prose.vi.spec.ts`
Expected: FAIL: `Cannot find module '../../data/locales/vi/prose.json'` (and `ENGLISH_PROSE` is not exported yet).

- [ ] **Step 3: Write the Vietnamese prose file**

`projects/content/data/locales/vi/prose.json`:

```json
{
  "hints": {
    "eight-trigrams": "Phán xét: nếu là lá đỏ, nó tính là một Thiểm",
    "gender-swords": "{target} bỏ một lá bài trên tay hoặc để bạn rút 1 lá bài",
    "axe": "Bỏ 2 lá bài để Sát của bạn trúng {target}",
    "green-dragon-blade": "Ra thêm một Sát vào {target}",
    "ice-sword": "Ngăn sát thương và thay vào đó bỏ 2 lá bài của {target}",
    "longbow": "Bỏ một Ngựa của {target}",
    "evil-hero": "Lấy lá bài đã gây sát thương cho bạn vào tay",
    "feedback": "Lấy một lá bài của {target}",
    "unyielding": "Phán xét: nếu không phải lá cơ, {target} bỏ 2 lá bài trên tay hoặc chịu 1 sát thương",
    "bestowed-rouse": "Rút 2 lá bài, rồi đưa bất kỳ lá nào trong số đó cho người khác",
    "heavens-envy": "Lấy lá phán xét vào tay",
    "devil": "Thay lá phán xét của {target} bằng một lá bài trên tay bạn",
    "river-goddess": "Phán xét: giữ mỗi lá đen và phán xét lại; gặp lá đỏ thì dừng",
    "bare-the-chest": "Rút ít hơn 1 lá bài; Sát và Quyết Đấu của bạn gây thêm 1 sát thương trong lượt này",
    "raid": "Thay vì rút bài, lấy một lá bài trên tay của 1 hoặc 2 người chơi khác",
    "brave-gesture": "Rút thêm 1 lá bài",
    "gathering-wisdom": "Rút 1 lá bài",
    "iron-cavalry": "Phán xét: nếu là lá đỏ, {target} không thể ra Thiểm chống lại Sát này",
    "astrology": "Xem các lá trên cùng của chồng bài rút và đặt lại theo thứ tự tùy ý",
    "displace": "Bỏ 1 lá bài để chuyển Sát sang một người chơi khác trong tầm đánh của bạn",
    "self-restraint": "Bỏ qua giai đoạn bỏ bài của bạn",
    "entrench": "Úp Tướng và rút 3 lá bài",
    "godspeed": "Bỏ qua các giai đoạn để dùng Sát lên bất kỳ người chơi nào, bất kể khoảng cách",
    "strong-bow": "Khiến Sát của bạn không thể bị đỡ bởi {target}",
    "fantasy": "Bỏ một lá cơ để chuyển sát thương cho người chơi khác",
    "refusing-death": "Đặt lá trên cùng của chồng bài rút dưới Tướng của bạn để còn sống",
    "lightning-strike": "Một người chơi bạn chọn phán xét: nếu là lá bích, chịu 2 sát thương",
    "dark-magic": "Thay lá phán xét của {target} bằng một lá đen, và lấy lá cũ",
    "eternal-loyalty": "Một người chơi bạn chọn rút bài đến Sinh lực tối đa",
    "nirvana": "Bỏ mọi lá bài, rút 3, hồi Sinh lực lên 3 và lật lại",
    "eight-arrays": "Phán xét: nếu là lá đỏ, nó tính là một Thiểm",
    "sudden-attack": "Bỏ một lá bài của {target}",
    "dueling-heroes": "Thay vì rút bài, phán xét và lấy lá bài đó; các lá bài màu còn lại có thể dùng làm Quyết Đấu trong lượt này",
    "unnatural-death": "Lấy toàn bộ bài của {target} vào tay",
    "exile": "Một người chơi bạn chọn lật mặt và rút bài",
    "resurgence": "Thay vì rút bài, lật các lá bài: mỗi lá cơ hồi 1 Sinh lực, các lá còn lại vào tay bạn",
    "intense-edge": "Đấu điểm với {target}; nếu thắng, lấy một lá bài của họ",
    "brave-spirit": "Một người chơi bạn chọn rút bài rồi bỏ bài",
    "charity": "Rút thêm 2 lá bài; nếu hơn 5 lá, đưa một nửa cho người chơi có ít bài nhất",
    "clever-change": "Bỏ một lá bài trên tay để bỏ qua giai đoạn này",
    "military-farm": "Phán xét: lá không phải cơ trở thành Điền dưới Tướng của bạn",
    "decentralization": "Bỏ qua giai đoạn ra bài; cuối lượt của bạn, một người chơi khác có thêm một lượt",
    "stubborn": "Trả lại một trong các lá bài đã bỏ và lấy phần còn lại",
    "lament": "Bỏ một lá bài: {target} phán xét, và lá cơ, rô, chuồn hoặc bích có hiệu lực tương ứng",
    "incarnation": "Chọn một kỹ năng của một Hóa thân của bạn",
    "instigate": "Chọn một người chơi ra Sát vào bạn, hoặc bạn bỏ một lá bài của họ",
    "direct-instruction": "Đặt một lá bài Trang bị từ tay bạn vào ô trống của người chơi khác, rồi rút 1 lá bài"
  },
  "selection": {
    "reconsider": { "prompt": "Chọn các lá bài để bỏ, rồi rút bằng số đó", "confirm": "Bỏ bài" },
    "kindness": { "prompt": "Chọn các lá bài để đưa", "confirm": "Đưa" },
    "bestowed-rouse": { "prompt": "Chọn các lá bài vừa rút để đưa đi", "confirm": "Đưa", "cancel": "Giữ phần còn lại" },
    "marriage": { "prompt": "Chọn 2 lá bài trên tay để bỏ", "confirm": "Bỏ bài" },
    "green-vesicle": { "prompt": "Chọn một lá bài trên tay để bỏ", "confirm": "Bỏ bài" },
    "sow-discord": { "prompt": "Chọn một lá bài để bỏ", "confirm": "Bỏ bài" },
    "displace": { "prompt": "Chọn một lá bài để bỏ", "confirm": "Bỏ bài" },
    "raid": { "prompt": "Chọn 1 hoặc 2 người chơi để lấy một lá bài trên tay", "confirm": "Lấy" },
    "sow-revolt": { "prompt": "Chọn một người chơi", "confirm": "Chọn" },
    "fantasy": { "prompt": "Chọn một lá cơ để bỏ", "confirm": "Bỏ bài" },
    "godspeed": { "prompt": "Chọn một lá bài Trang bị để bỏ", "confirm": "Bỏ bài" },
    "refusing-death": { "prompt": "Chọn một lá bài dưới Tướng của bạn để bỏ", "confirm": "Bỏ bài", "cancel": "Giữ lại" },
    "dark-magic": { "prompt": "Chọn một lá đen để thay lá phán xét", "confirm": "Thay thế" },
    "shackle": { "prompt": "Chọn một lá chuồn để bỏ, rồi rút 1", "confirm": "Đổi lại" },
    "assault": { "prompt": "Chọn một Vũ khí để bỏ, hoặc không chọn để mất 1 Sinh lực", "confirm": "Xác nhận" },
    "rouse-the-tiger": { "prompt": "Chọn một người chơi có nhiều Sinh lực hơn để đấu điểm", "confirm": "Chọn" },
    "heavens-justice": { "prompt": "Chọn một người chơi để đấu điểm", "confirm": "Chọn" },
    "alliance": { "prompt": "Chọn một người chơi để đổi bài trên tay", "confirm": "Chọn" },
    "brave-spirit": { "prompt": "Chọn các lá bài để bỏ", "confirm": "Bỏ bài" },
    "charity": { "prompt": "Chọn một nửa số bài trên tay để đưa đi", "confirm": "Đưa" },
    "clever-change": { "prompt": "Chọn một lá bài trên tay để bỏ và bỏ qua giai đoạn", "confirm": "Bỏ bài" },
    "pleasure": { "prompt": "Chọn một lá bài Cơ bản để bỏ, nếu không Sát không có hiệu lực", "confirm": "Bỏ bài", "cancel": "Bỏ cuộc" },
    "decentralization": { "prompt": "Chọn một lá bài trên tay để bỏ", "confirm": "Bỏ bài" },
    "lament": { "prompt": "Chọn các lá bài để bỏ", "confirm": "Bỏ bài" },
    "direct-instruction": { "prompt": "Chọn một lá bài Trang bị để đặt", "confirm": "Đặt" },
    "instigate": { "prompt": "Chọn một người chơi để ra Sát vào bạn", "confirm": "Chọn" }
  },
  "seatPick": {
    "rouse-the-tiger": "Chọn một người chơi để {target} gây sát thương",
    "exile": "Chọn một người chơi để lật mặt",
    "brave-spirit": "Chọn một người chơi để rút bài rồi bỏ bài",
    "alliance": "Chọn một người chơi để đổi bài trên tay với {target}",
    "clever-change": "Chọn một người chơi để chuyển lá bài tới",
    "decentralization": "Chọn một người chơi để có thêm một lượt",
    "direct-instruction": "Chọn một người chơi để đặt lá bài vào"
  },
  "choicePrompt": {
    "upheaval": "Chọn một người chơi để ra Sát vào, hoặc bỏ qua",
    "collapse": "Chọn cách Collapse gây tổn hại cho bạn",
    "brave-spirit": "Chọn cách rút bài và bỏ bài",
    "clever-change": "Chọn một lá bài để chuyển",
    "follow-the-master": "Chọn cách Follow the Master giúp bạn",
    "incarnation": "Chọn một kỹ năng Hóa thân",
    "stubborn": "Chọn một lá bài để trả lại; bạn lấy các lá còn lại"
  },
  "stepSelection": {
    "compete-user": { "prompt": "Chọn một lá bài trên tay để đấu điểm", "confirm": "Đấu điểm" },
    "compete-target": { "prompt": "Chọn một lá bài trên tay để đấu điểm", "confirm": "Đấu điểm" },
    "blaze-shown": { "prompt": "Chọn một lá bài trên tay để cho xem", "confirm": "Cho xem" },
    "blaze-hit": { "prompt": "Bỏ một lá cùng chất để gây 1 sát thương", "confirm": "Bỏ bài" },
    "pay": { "prompt": "Chọn các lá bài để bỏ cho Alliance", "confirm": "Bỏ bài" },
    "draw-take": { "prompt": "Chọn tối đa 2 người chơi để lấy một lá bài trên tay", "confirm": "Lấy" },
    "move-card": { "prompt": "Chọn một người chơi để chuyển một lá bài từ họ", "confirm": "Chọn" }
  },
  "competeOutcomes": {
    "heavens-justice": {
      "won": "{user} có thể ra thêm một Sát trong lượt này, ở mọi khoảng cách, thêm một mục tiêu",
      "lost": "{user} không thể ra Sát trong lượt này"
    },
    "rouse-the-tiger": {
      "won": "{user} sẽ chọn một người chơi trong tầm đánh của {target}; {target} gây cho họ 1 sát thương",
      "lost": "{target} gây 1 sát thương cho {user}"
    },
    "intense-edge": {
      "won": "{user} sẽ lấy một lá bài của {target}",
      "lost": "Không có gì xảy ra"
    }
  }
}
```

- [ ] **Step 4: Make the display functions locale-aware**

Apply this script from the worktree root (`python3 -`). Every replacement asserts its count; a wrong count means the file is not what the plan expects, so stop and ledger it.

```python
p = 'projects/content/src/lib/display.ts'
s = open(p).read()

def swap(old, new):
    global s
    assert s.count(old) == 1, (old, s.count(old))
    s = s.replace(old, new)

swap("import { generalsData } from '../../data/generals';",
     "import { generalsData } from '../../data/generals';\nimport viProse from '../../data/locales/vi/prose.json';")

swap("export function abilityHint(abilityId: string): string | null {\n  return ABILITY_HINTS[abilityId] ?? null;\n}",
     "export function abilityHint(abilityId: string, locale = 'en'): string | null {\n  return lookup(proseOf(locale)?.hints, abilityId) ?? lookup(ABILITY_HINTS, abilityId) ?? null;\n}")

swap("export function selectionText(abilityId: string): { prompt: string; confirm: string; cancel?: string } | null {\n  return SELECTION_TEXT[abilityId] ?? null;\n}",
     "export function selectionText(abilityId: string, locale = 'en'): { prompt: string; confirm: string; cancel?: string } | null {\n  return lookup(proseOf(locale)?.selection, abilityId) ?? lookup(SELECTION_TEXT, abilityId) ?? null;\n}")

swap("export function seatPickText(abilityId: string): string | null {\n  return SEAT_PICK_TEXT[abilityId] ?? null;\n}",
     "export function seatPickText(abilityId: string, locale = 'en'): string | null {\n  return lookup(proseOf(locale)?.seatPick, abilityId) ?? lookup(SEAT_PICK_TEXT, abilityId) ?? null;\n}")

swap("export function choicePromptText(abilityId: string): string | null {\n  return CHOICE_PROMPT_TEXT[abilityId] ?? null;\n}",
     "export function choicePromptText(abilityId: string, locale = 'en'): string | null {\n  return lookup(proseOf(locale)?.choicePrompt, abilityId) ?? lookup(CHOICE_PROMPT_TEXT, abilityId) ?? null;\n}")

swap("export function stepSelectionText(step: string): { prompt: string; confirm: string; cancel?: string } | null {\n  return STEP_SELECTION_TEXT[step] ?? null;\n}",
     "export function stepSelectionText(step: string, locale = 'en'): { prompt: string; confirm: string; cancel?: string } | null {\n  return lookup(proseOf(locale)?.stepSelection, step) ?? lookup(STEP_SELECTION_TEXT, step) ?? null;\n}")

swap("export function competeOutcomeText(abilityId: string, won: boolean, names: { user: string; target: string }): string | null {\n  const outcome = Object.prototype.hasOwnProperty.call(COMPETE_OUTCOMES, abilityId) ? COMPETE_OUTCOMES[abilityId] : null;",
     "export function competeOutcomeText(abilityId: string, won: boolean, names: { user: string; target: string }, locale = 'en'): string | null {\n  const outcome = lookup(proseOf(locale)?.competeOutcomes, abilityId) ?? lookup(COMPETE_OUTCOMES, abilityId);")

s = s.rstrip('\n') + """

// The English prose tables, for the parity spec and for translation tools: every
// other language's prose file must cover exactly these ids.
export const ENGLISH_PROSE = {
  hints: ABILITY_HINTS,
  selection: SELECTION_TEXT,
  seatPick: SEAT_PICK_TEXT,
  choicePrompt: CHOICE_PROMPT_TEXT,
  stepSelection: STEP_SELECTION_TEXT,
  competeOutcomes: COMPETE_OUTCOMES,
};

// One language's prose, shaped like the English tables above.
interface ProseText {
  prompt: string;
  confirm: string;
  cancel?: string;
}
interface Prose {
  hints: Record<string, string>;
  selection: Record<string, ProseText>;
  seatPick: Record<string, string>;
  choicePrompt: Record<string, string>;
  stepSelection: Record<string, ProseText>;
  competeOutcomes: Record<string, { won: string; lost: string }>;
}

// Languages other than English that have prose; any other locale reads English.
const PROSE: Record<string, Prose> = { vi: viProse };

function proseOf(locale: string): Prose | undefined {
  return Object.prototype.hasOwnProperty.call(PROSE, locale) ? PROSE[locale] : undefined;
}

// An own entry of a table: an id such as 'constructor' is not an entry.
function lookup<T>(table: Readonly<Record<string, T>> | undefined, id: string): T | undefined {
  return table && Object.prototype.hasOwnProperty.call(table, id) ? table[id] : undefined;
}
"""
open(p, 'w').write(s)
```

- [ ] **Step 5: Run the new spec, and every existing `content` spec**

Run: `npx jest --selectProjects content`
Expected: PASS everywhere, with no existing `content` spec edited. If the parity test reports a missing or extra id, the JSON in Step 3 differs from `display.ts`: fix the JSON. If it reports different placeholders, fix the Vietnamese entry.

- [ ] **Step 6: Typecheck `content`, then build it**

Run: `npx tsc -p projects/content/tsconfig.lib.json --noEmit && npx ng build content 2>&1 | tail -6`
Expected: no type errors; the library builds (the JSON import is bundled). If the build cannot resolve the JSON, stop and ledger it: the other data files are imported the same way, so this should not happen.

- [ ] **Step 7: Commit**

```bash
git add projects/content/data/locales/vi/prose.json projects/content/src/lib/display.ts projects/content/src/lib/prose.vi.spec.ts
git commit -m "feat(content): the prose tables take a locale and read Vietnamese prose

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The translator carries a locale; the builders pass it on

**Files:**
- Modify: `projects/app/src/app/i18n/translator.ts`, `projects/app/src/app/i18n/i18n.service.ts`, `projects/app/src/app/game-board/choice-description.ts`, `projects/app/src/app/game-board/ability-description.ts`, `projects/app/src/app/i18n/translator.spec.ts`, `projects/app/src/app/i18n/i18n.service.spec.ts`
- Test: `projects/app/src/app/game-board/prose.vi.spec.ts` (new)

**Interfaces:**
- Consumes: Task 1's locale-aware content functions.
- Produces: `Translator` with optional `locale`; `makeTranslator(messages, locale?)`; `localeOf(tr)`; `I18n.translator.locale`.

- [ ] **Step 1: Write the failing tests**

Append to `projects/app/src/app/i18n/translator.spec.ts`, inside its `describe('translator', ...)` block (before its closing `});`):

```ts
  it('carries the locale it was made for, and English when it says nothing', () => {
    expect(englishTranslator.locale).toBe('en');
    expect(makeTranslator({ 'nav.language': 'x' } as Messages).locale).toBe('en');
    expect(makeTranslator({ 'nav.language': 'x' } as Messages, 'vi').locale).toBe('vi');
    expect(localeOf(makeTranslator({ 'nav.language': 'x' } as Messages, 'vi'))).toBe('vi');
    expect(localeOf((key) => key)).toBe('en');
  });
```

and change the import line at the top of that file from `import { makeTranslator, englishTranslator } from './translator';` to `import { makeTranslator, englishTranslator, localeOf } from './translator';`.

Append to `projects/app/src/app/i18n/i18n.service.spec.ts`, inside its `describe('I18n', ...)` block, directly after the test `'offers a translator that follows the current language'`:

```ts
  it('reports the live locale on its translator, so a computed that uses it re-runs', async () => {
    const i18n = setup();
    expect(i18n.translator.locale).toBe('en');
    await i18n.setLocale('vi');
    expect(i18n.translator.locale).toBe('vi');
  });
```

`projects/app/src/app/game-board/prose.vi.spec.ts`:

```ts
import { Action, CardInstance, ChoiceOption, GameState, PendingChoice, PendingSelection } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { describeAsk, describeSelection } from './ability-description';
import { describeChoice } from './choice-description';

// A translator that speaks Vietnamese, and one that has the Vietnamese catalog but no locale.
const trVi = makeTranslator(vi, 'vi');
const trCatalogOnly = makeTranslator(vi);
const both = <T>(build: (translator?: typeof trVi) => T): { en: T; vi: T } => ({ en: build(), vi: build(trVi) });

const axe: CardInstance = { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 };
const equipmentOwner = { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'ax' };
const general = (skillId: string) => ({ kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId });

function state(o: { pendingChoice?: PendingChoice; pendingSelection?: PendingSelection } = {}): GameState {
  return {
    seats: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
    ],
    zones: [{ id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [axe] }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
    ...o,
  };
}

describe('an ability hint', () => {
  const ask = (targetSeatId?: string): PendingChoice => ({
    id: 'ask', seatId: 'seat-0', verb: 'use',
    reason: { kind: 'ability', owner: equipmentOwner, abilityId: 'axe', ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  });
  const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));

  it('is Vietnamese with a Vietnamese translator, with the target named', () => {
    expect(both((t) => describeAsk(state({ pendingChoice: ask('seat-1') }), 'seat-0', asked, t)!.hint)).toEqual({
      en: 'Discard 2 cards to make your Sha hit Seat 1',
      vi: 'Bỏ 2 lá bài để Sát của bạn trúng Seat 1',
    });
  });

  it('names "the target" in the viewer’s language when no seat is named', () => {
    expect(both((t) => describeAsk(state({ pendingChoice: ask() }), 'seat-0', asked, t)!.hint)).toEqual({
      en: 'Discard 2 cards to make your Sha hit the target',
      vi: 'Bỏ 2 lá bài để Sát của bạn trúng mục tiêu',
    });
  });

  it('stays English when the translator has the catalog but no locale', () => {
    expect(describeAsk(state({ pendingChoice: ask('seat-1') }), 'seat-0', asked, trCatalogOnly)!.hint).toBe('Discard 2 cards to make your Sha hit Seat 1');
  });
});

describe('a skill’s selection text', () => {
  const selection = (abilityId: string, over: Partial<PendingSelection>): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner: general(abilityId), abilityId }, of: 'cards', eligibleIds: [], min: 1, max: 2,
    then: { kind: 'give', toSeatIds: ['seat-1'] }, ...over,
  });
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const describe2 = (sel: PendingSelection, t?: typeof trVi) => describeSelection(state({ pendingSelection: sel }), 'seat-0', [template, cancel], t)!;

  it('uses the skill’s own words, button and cancel label', () => {
    expect(both((t) => { const d = describe2(selection('bestowed-rouse', {}), t); return [d.prompt, d.confirmLabel, d.cancelLabel]; })).toEqual({
      en: ['Choose drawn cards to give away', 'Give', 'Keep the Rest'],
      vi: ['Chọn các lá bài vừa rút để đưa đi', 'Đưa', 'Giữ phần còn lại'],
    });
  });

  it('a step’s text wins, and the cancel label falls back to the catalog', () => {
    const step = { kind: 'SkillStepEffect' as const, owner: general('heavens-justice'), step: 'compete-user', data: {} };
    const competing = selection('heavens-justice', { then: { kind: 'skill-step', step } });
    expect(both((t) => { const d = describe2(competing, t); return [d.prompt, d.confirmLabel, d.cancelLabel]; })).toEqual({
      en: ['Choose a hand card to compete with', 'Compete', 'Cancel'],
      vi: ['Chọn một lá bài trên tay để đấu điểm', 'Đấu điểm', 'Hủy'],
    });
  });

  it('a skill with no text of its own uses the catalog sentences', () => {
    expect(both((t) => describe2(selection('some-skill', { min: 2, max: 2, then: { kind: 'discard' } }), t).prompt)).toEqual({
      en: 'Choose 2 cards to discard',
      vi: 'Chọn 2 lá bài để bỏ',
    });
  });
});

describe('a skill’s pick prompt', () => {
  const seatOption: ChoiceOption = { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] };
  const labelOption: ChoiceOption = { id: 'pass', shows: { kind: 'label', text: 'Pass' }, effects: [] };
  const pick = (skillId: string, options: ChoiceOption[], targetSeatId?: string): PendingChoice => ({
    id: 'k', seatId: 'seat-0', verb: 'pick', options,
    reason: { kind: 'ability', owner: general(skillId), abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}) },
  });

  it('a seat pick in the skill’s own words, with its target named', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('rouse-the-tiger', [seatOption], 'seat-1') }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat for Seat 1 to damage',
      vi: 'Chọn một người chơi để Seat 1 gây sát thương',
    });
  });

  it('a seat pick with no target names "a seat" in the viewer’s language', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('rouse-the-tiger', [seatOption]) }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat for a seat to damage',
      vi: 'Chọn một người chơi để một người chơi gây sát thương',
    });
  });

  it('a mixed pick uses the skill’s fixed prompt', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('upheaval', [seatOption, labelOption]) }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat to play a Sha at, or pass',
      vi: 'Chọn một người chơi để ra Sát vào, hoặc bỏ qua',
    });
  });

  it('a skill with no text of its own uses the catalog prompt', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('some-skill', [seatOption]) }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat',
      vi: 'Chọn một người chơi',
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/translator.spec.ts projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/game-board/prose.vi.spec.ts`
Expected: FAIL: `localeOf` does not exist, `makeTranslator` ignores a locale, and the builders show English prose. If a test fails for a fixture or type reason instead, compare it with `ability-description.spec.ts` or `choice-description.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Give the translator a locale**

Replace the whole of `projects/app/src/app/i18n/translator.ts` with:

```ts
import { en } from './en';
import { format } from './format';
import type { MessageKey, MessageParams, Messages } from './messages';

// What a builder is handed to turn a key into text. I18n.translator is the live
// one; englishTranslator is every builder's default, so callers that pass none
// get today's English. `locale` names the language it speaks, for the prose that
// lives outside the catalog (the content package's per-language tables).
export type Translator = ((key: MessageKey, params?: MessageParams) => string) & { readonly locale?: string };

export const makeTranslator = (messages: Messages, locale = 'en'): Translator =>
  Object.assign((key: MessageKey, params?: MessageParams) => format(messages[key], params), { locale });

export const englishTranslator: Translator = makeTranslator(en);

// The language a translator speaks; English when it says nothing.
export const localeOf = (tr: Translator): string => tr.locale ?? 'en';
```

In `projects/app/src/app/i18n/i18n.service.ts`, replace the `translator` field (the line `readonly translator: Translator = (key, params) => this.t(key, params);` and the comment above it) with:

```ts
  // For the pure builders (history, descriptions): follows the current language.
  // `locale` is a getter over the signal, so a computed that calls a builder
  // re-runs when the language changes.
  readonly translator: Translator = Object.defineProperty((key: MessageKey, params?: MessageParams) => this.t(key, params), 'locale', {
    get: () => this.locale(),
    enumerable: true,
  });
```

- [ ] **Step 4: Pass the locale from the builders**

Apply this script from the worktree root (`python3 -`):

```python
def edit(path, steps):
    s = open(path).read()
    for old, new, count in steps:
        assert s.count(old) == count, (path, old, s.count(old))
        s = s.replace(old, new)
    open(path, 'w').write(s)

G = 'projects/app/src/app/game-board/'
edit(G + 'ability-description.ts', [
    ("import { englishTranslator, Translator } from '../i18n/translator';", "import { englishTranslator, localeOf, Translator } from '../i18n/translator';", 1),
    ("abilityHint(abilityId)", "abilityHint(abilityId, localeOf(tr))", 1),
    ("stepSelectionText(step)", "stepSelectionText(step, localeOf(tr))", 1),
    ("selectionText(selection.reason.abilityId)", "selectionText(selection.reason.abilityId, localeOf(tr))", 1),
])
edit(G + 'choice-description.ts', [
    ("import { englishTranslator, Translator } from '../i18n/translator';", "import { englishTranslator, localeOf, Translator } from '../i18n/translator';", 1),
    ("choicePromptText(choice.reason.abilityId)", "choicePromptText(choice.reason.abilityId, localeOf(tr))", 1),
    ("seatPickText(choice.reason.abilityId)", "seatPickText(choice.reason.abilityId, localeOf(tr))", 2),
])
```

(`describeAsk`, `describeSelection` and `describeChoice` all have `tr` in scope at these calls.)

- [ ] **Step 5: Run the new specs, the earlier builder specs and the parity test**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/translator.spec.ts projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/game-board/prose.vi.spec.ts projects/app/src/app/game-board/choice-description.spec.ts projects/app/src/app/game-board/choice-description.vi.spec.ts projects/app/src/app/game-board/ability-description.spec.ts projects/app/src/app/game-board/ability-description.vi.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere. The earlier `*.vi.spec.ts` files build their translator with `makeTranslator(vi)` (no locale), so their English prose expectations still hold. If an earlier spec fails, the translator default leaked a locale: check `makeTranslator`'s default.

- [ ] **Step 6: Typecheck app, content and specs, then run both projects**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app content --maxWorkers=50%`
Expected: no type errors in the app build; the spec typecheck reports only the one older `selection-dialog.spec.ts` error (anything in the new specs is yours to fix); every suite passes.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/translator.ts projects/app/src/app/i18n/translator.spec.ts projects/app/src/app/i18n/i18n.service.ts projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/game-board/choice-description.ts projects/app/src/app/game-board/ability-description.ts projects/app/src/app/game-board/prose.vi.spec.ts
git commit -m "feat(app): the translator carries a locale and the builders pass it to the content prose

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (step 2d, and the spec's "Locale-aware display" architecture row):
- The six prose tables are available in Vietnamese through locale-aware functions with per-entry English fallback: Task 1.
- The English tables are unchanged and exported for the parity check: Task 1 Step 4.
- The translator knows its language and the builders use it: Task 2.
- Existing specs unedited, English byte-identical: Task 1 Step 5 and Task 2 Steps 5 and 6.
- Not in this plan, by design: `compete-result.ts` and every component passing the locale (phase 3); card, ability and General names (phase 4); skill names that the English prose spells out (phase 4).

**Placeholder scan:** none. The full Vietnamese file, both scripts, the replacement translator and every test are shown.

**Type consistency:** `abilityHint`, `selectionText`, `seatPickText`, `choicePromptText`, `stepSelectionText` and `competeOutcomeText` take `locale` last, with the default `'en'`, matching how Task 2 and the specs call them. `Translator`'s `locale` is optional, so every plain function and earlier `makeTranslator(vi)` call still type-checks. `lookup` and `proseOf` are defined at the end of `display.ts` and called only at runtime, after module initialisation.

**Review Focus:** each line has a test: unknown locale, empty locale and unknown or object-named ids (Task 1 spec); the parity, placeholder and cancel checks (Task 1 spec); `makeTranslator(vi)` without a locale staying English (Task 2 spec "stays English when the translator has the catalog but no locale"); `I18n.translator.locale` following `setLocale` (Task 2); and `{user}` and `{target}` both replaced (Task 1 spec).
