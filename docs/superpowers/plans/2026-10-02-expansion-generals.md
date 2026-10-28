# Expansion Generals (Wind, Fire, Forest, Mountain) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 32 Wind, Fire, Forest and Mountain generals of the four kingdoms as playable, sourced data. Replace the placeholder Dong Zhuo with the real Forest one, cap Guozhan at 10 seats, and show the expansion in the Wiki, whose fourth tab is renamed Qun.

**Architecture:**
- **Data:** a supervised crawl script writes one JSON file per general. Kingdom and HP come from the AllGenerals spreadsheet; names, titles and skills come verbatim from each page's stripped text. The generals index is regenerated from the files on disk.
- **Game:** the existing "every general with data is playable" rule brings them into the pool. Dong Zhuo's invented skill code is deleted, and the seat cap gains a ceiling of 10.
- **Wiki:** gains an `expansion` field and chip.

**Tech Stack:** Python 3 (crawl script), TypeScript, Angular 22, Jest.

**Spec:** `docs/superpowers/specs/2026-10-02-expansion-generals-design.md`

## Global Constraints

- **The God faction is not touched:** nothing is crawled from it and nothing about it changes.
- **The 32 generals:** the (Wind)/(Fire)/(Forest)/(Mountain) entries on the four faction pages (wei, shu, wu, hero). That's Wei 8, Shu 8, Wu 7 and Qun 9.
- **Kingdom and HP** come from the AllGenerals spreadsheet `1TpJgrXqAixnPKwR9oWuEgY3FnMNCtVImLQ5rDpYmRYY`: `Alignment`, with Hero → Qun, and `Health`.
- **Page text:** name, nameZh, title, titleZh and skills come verbatim from the stripped page text. Skill text is every line up to the next skill heading or the first `Clarification`, joined with single spaces. A field the page doesn't show is left out, never guessed.
- **Ids:** the kebab-cased name. The one collision with a Base id gets an expansion prefix: `fire-zhuge-liang`. `dong-zhuo` keeps its id and is replaced by the Forest data.
- **Source fields:** each file has `source: { crawledAt: '2026-10-02', expansion: '<Wind|Fire|Forest|Mountain>', site: 'English Sanguosha (Jason Keeney and Scott Maresh)', url: '<page url>' }`.
- **Counts:**
  - pool 57;
  - tabs Wei 15 · Shu 15 · Wu 15 · Qun 12;
  - expansions Base 25 · Wind 8 · Fire 8 · Forest 8 · Mountain 8;
  - coded skills 5: xiahou-dun, sun-shangxiang, zhuge-liang, zhao-yun, huang-yueying.
- **Seat cap:** `Math.min(MAX_GUOZHAN_SEATS, Math.floor(pool / GENERALS_PER_SEAT))`, with `MAX_GUOZHAN_SEATS = 10`. Today that is 10.
- **Wiki:**
  - Generals tab keys and labels: `wei` Wei · `shu` Shu · `wu` Wu · `qun` Qun;
  - `WikiGeneral.expansion` is `'Base' | 'Wind' | 'Fire' | 'Forest' | 'Mountain'`, defaulting to `'Base'`;
  - summary: "57 generals · 5 with skills in the game".
- **Tests:** `npx jest --selectProjects <content|app|sim> --testPathPatterns <pattern>`; full suite `npx jest`; build `npx ng build app` (no warnings).
- **Commits** end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The scratchpad** for crawl artifacts is `/private/tmp/claude-503/-Users-hing-Workspace-my-sanguosha/fa6a3f8f-2141-4e69-9c34-3cc2ab986dc0/scratchpad/gen` (`$S` below).

## Review Focus

1. **A wrongly read field** would be invisible to tests: a title taken as a skill, a skill split in two, a Chinese name glued to the English one. Each of the 32 records is read against its page text in Task 1 Step 4, and the result is ledgered.
2. **A 10-seat table** must keep every tile on screen and not overlapping, at desktop and phone widths. This is checked live in Task 4, and fixed there if needed.
3. **Two generals called "Zhuge Liang"** must stay distinguishable everywhere: in the Wiki and in selection candidates (title, expansion). Pinned in Task 1 ("keeps both Zhuge Liangs apart") and checked live.
4. **Deals change when the pool changes**, so a test that assumed a particular deal could start failing for reasons unrelated to its subject. Task 2 Step 6 and Task 4 Step 2 handle these by name and never weaken an assertion silently.
5. **Dong Zhuo with HP 8** gives combined HPs up to 6 (8 + 4, halved). Anything assuming "at most 4 HP" can break; Task 4 Step 2 names it.

---

### Task 1: Crawl the 32 generals

**Files:**
- Create: 31 files under `projects/content/data/generals/{wei,shu,wu,qun}/`
- Replace: `projects/content/data/generals/qun/dong-zhuo.json`
- Modify: `projects/content/data/generals/index.ts` (regenerated imports and record; `source` gains `expansion?: string`)
- Modify: `projects/content/assets/manifest.json` (via the crawler)
- Modify: `docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md` (Dong Zhuo open item)
- Test: `projects/content/src/lib/wiki.spec.ts`, `projects/content/src/lib/registry.spec.ts`, `projects/content/src/lib/display.spec.ts`

**Interfaces:**
- Produces: `generalsData` with 57 entries. Every expansion general's `source.expansion` is set, and Base generals have none.

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/wiki.spec.ts`, in `describe('wikiGenerals')`:
- Change `expect(generals).toHaveLength(26);` to `expect(generals).toHaveLength(57);`.
- Change the Wei name list in the same test to:

```ts
    expect(generals.filter((g) => g.kingdom === 'Wei').map((g) => g.name)).toEqual([
      'Cao Cao', 'Cao Pi', 'Cao Ren', 'Deng Ai', 'Dian Wei', 'Guo Jia', 'Sima Yi', 'Xiahou Dun',
      'Xiahou Yuan', 'Xu Chu', 'Xu Huang', 'Xun Yu', 'Zhang He', 'Zhang Liao', 'Zhen Ji',
    ]);
```

Add these tests to the same `describe`:

```ts
  it('includes every Wind, Fire, Forest and Mountain general of the four kingdoms', () => {
    const ids = new Set(generals.map((g) => g.id));
    for (const id of [
      'xiahou-yuan', 'cao-ren', 'dian-wei', 'xun-yu', 'xu-huang', 'cao-pi', 'zhang-he', 'deng-ai',
      'huang-zhong', 'wei-yan', 'pang-tong', 'fire-zhuge-liang', 'meng-huo', 'zhu-rong', 'jiang-wei', 'liu-shan',
      'xiao-qiao', 'zhou-tai', 'taishi-ci', 'sun-jian', 'lu-su', 'sun-ce', 'zhang-zhao-and-zhang-hong',
      'zhang-jiao', 'yu-ji', 'yuan-shao', 'yan-liang-and-wen-chou', 'pang-de', 'dong-zhuo', 'jia-xu', 'zuo-ci', 'cai-wenji',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(generals.every((g) => g.maxHp !== null)).toBe(true);
  });

  it('keeps both Zhuge Liangs apart (Review Focus 3)', () => {
    const base = generals.find((g) => g.id === 'zhuge-liang')!;
    const fire = generals.find((g) => g.id === 'fire-zhuge-liang')!;
    expect([base.name, fire.name]).toEqual(['Zhuge Liang', 'Zhuge Liang']);
    expect(fire).toMatchObject({ kingdom: 'Shu', title: 'Sleeping Dragon', titleZh: '卧龙', maxHp: 3 });
    expect(base.title).not.toBe(fire.title);
  });

  it('replaces the placeholder Dong Zhuo with the Forest one', () => {
    const dongZhuo = generals.find((g) => g.id === 'dong-zhuo')!;
    expect(dongZhuo).toMatchObject({ kingdom: 'Qun', maxHp: 8 });
    expect(dongZhuo.skills.map((s) => s.name)).not.toContain('Tyranny');
  });

  it('copies skills verbatim from the page', () => {
    const xiahouYuan = generals.find((g) => g.id === 'xiahou-yuan')!;
    expect(xiahouYuan).toMatchObject({ name: 'Xiahou Yuan', nameZh: '夏侯渊', title: 'Running Cheetah', titleZh: '急行的猎豹', maxHp: 4 });
    expect(xiahouYuan.skills).toEqual([{
      name: 'Godspeed', nameZh: '神速',
      text: 'During his turn, Xiahou Yuan can exercise either or both of the following options to attack any character regardless of their distance from him: Skip his judgment and drawing phases. Skip his action phase and discard any equipment card.',
    }]);
  });
```

In `projects/content/src/lib/registry.spec.ts`:
- Rename the second test to "builds every data-driven general: 25 Base, 32 from the expansions (Forest Dong Zhuo replaces the placeholder)" and change `toBe(26)` to `toBe(57)`.
- In the third test, change `expect(registry.generals.get('dong-zhuo')).toMatchObject({ kingdom: 'Qun', maxHp: 4 });` to `…maxHp: 8 });`.

`projects/content/src/lib/display.spec.ts` ("returns a null title when the data has none") uses Dong Zhuo, who will have a title. Leave it for Step 6.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects content --testPathPatterns "wiki|registry"`
Expected: FAIL. The counts are 26, ids like `xiahou-yuan` are missing, and Dong Zhuo has maxHp 4.

- [ ] **Step 3: Run the crawl script**

From the repo root, run the following. It fetches pages, so allow a few minutes:

```bash
S=/private/tmp/claude-503/-Users-hing-Workspace-my-sanguosha/fa6a3f8f-2141-4e69-9c34-3cc2ab986dc0/scratchpad/gen
mkdir -p $S/pages $S/text
python3 - "$S" <<'EOF'
import csv, html.parser, io, json, pathlib, re, sys, time, urllib.request

S = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path('projects/content/data/generals')
SITE = 'https://sites.google.com/site/englishsanguosha'
UA = {'User-Agent': 'Mozilla/5.0'}
FACTIONS = {'wei': 'wei', 'shu': 'shu', 'wu': 'wu', 'hero': 'qun'}
KINGDOM = {'Wei': 'wei', 'Shu': 'shu', 'Wu': 'wu', 'Hero': 'qun'}
EXPANSIONS = ('Wind', 'Fire', 'Forest', 'Mountain')

def fetch(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                body = r.read().decode('utf-8')
            if 'Error 502' not in body[:2000]:
                return body
        except Exception as e:  # transient Google errors seen during design
            err = e
        time.sleep(2 * (i + 1))
    raise RuntimeError(f'could not fetch {url}')

class Strip(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.out = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'): self.skip += 1
        if tag in ('p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'tr'): self.out.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style'): self.skip -= 1
    def handle_data(self, data):
        if not self.skip: self.out.append(data)

def content_lines(page_html):
    p = Strip(); p.feed(page_html)
    lines = [re.sub(r'\s+', ' ', l).strip() for l in ''.join(p.out).split('\n')]
    lines = [l for l in lines if l]
    start = max(i for i, l in enumerate(lines) if l == 'Other Countries') + 1
    end = next(i for i in range(start, len(lines)) if lines[i].startswith('Jason Keeney'))
    return lines[start:end]

ZH = re.compile(r'^(.*?[A-Za-z0-9.,!?\'’)\]])\s*([㐀-鿿　-〿＀-￯·…]+)$')
def split_zh(line):
    m = ZH.match(line)
    return (m.group(1).strip(), m.group(2)) if m else (line, None)

def kebab(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

# 1. The faction pages give the 32 expansion generals and their page slugs.
wanted = []
for faction, folder in FACTIONS.items():
    page = fetch(f'{SITE}/generals/{faction}')
    for exp_slug, slug in sorted(set(re.findall(r'expansions/original/(wind|fire|forest|mountain)/([a-z0-9-]+)', page))):
        wanted.append((folder, exp_slug, slug))
assert len(wanted) == 32, len(wanted)

# 2. The spreadsheet gives kingdom and HP.
sheet = list(csv.DictReader(io.StringIO(fetch('https://docs.google.com/spreadsheets/d/1TpJgrXqAixnPKwR9oWuEgY3FnMNCtVImLQ5rDpYmRYY/export?format=csv'))))
rows = {(r['Expansion'], r['Name']): r for r in sheet if r['Expansion'] in EXPANSIONS and r['Alignment'] != 'God'}

base_ids = {p.stem for p in ROOT.glob('*/*.json')} - {'dong-zhuo'}
report = []
for folder, exp_slug, slug in wanted:
    expansion = exp_slug.capitalize()
    url = f'{SITE}/expansions/original/{exp_slug}/{slug}'
    page = fetch(url)
    (S / 'pages' / f'{slug}.html').write_text(page, encoding='utf-8')
    lines = content_lines(page)
    (S / 'text' / f'{slug}.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    problems = []
    name = lines[0]
    name_en, name_zh = split_zh(lines[1])
    if name_en != name: problems.append(f'name line {lines[1]!r} does not start with {name!r}')
    title_en, title_zh = split_zh(lines[2])
    skills, current = [], None
    for line in lines[3:]:
        if line == 'Clarification': break
        head_en, head_zh = split_zh(line)
        if head_zh and re.fullmatch(r"[A-Z][A-Za-z '’-]*", head_en):
            current = {'name': head_en, 'nameZh': head_zh, 'text': []}
            skills.append(current)
        elif current is None:
            problems.append(f'text before any skill heading: {line!r}')
        else:
            current['text'].append(line)
    for s in skills:
        s['text'] = ' '.join(s['text'])
        if not s['text']: problems.append(f'skill {s["name"]!r} has no text')
    if not skills: problems.append('no skills found')
    row = rows.get((expansion, name))
    if row is None: problems.append(f'no spreadsheet row for ({expansion}, {name})')
    elif KINGDOM[row['Alignment']] != folder: problems.append(f'spreadsheet kingdom {row["Alignment"]} vs page folder {folder}')
    gid = kebab(name)
    if gid in base_ids: gid = f'{exp_slug}-{gid}'
    data = {'maxHp': int(row['Health']) if row and row['Health'].strip() else None, 'name': name, 'skills': skills,
            'source': {'crawledAt': '2026-10-02', 'expansion': expansion, 'site': 'English Sanguosha (Jason Keeney and Scott Maresh)', 'url': url}}
    if name_zh: data['nameZh'] = name_zh
    data['title'] = title_en  # line 3 is always the title; Step 4 checks it isn't a skill heading
    if title_zh: data['titleZh'] = title_zh
    if data['maxHp'] is None: problems.append('no Health in spreadsheet')
    out = ROOT / folder / f'{gid}.json'
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    report.append({'id': gid, 'folder': folder, 'slug': slug, 'problems': problems, 'record': data})

(S / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{len(report)} written; problems:')
for r in report:
    for p in r['problems']: print(f"  {r['id']}: {p}")
EOF
```

Expected: `32 written; problems:` with no problem lines, and 31 new files plus `qun/dong-zhuo.json` changed (`git status --short projects/content/data/generals`). If problems are listed, handle each in Step 4. Never delete a problem by editing the script to hide it.

- [ ] **Step 4: Read every record against its page (Review Focus 1)**

For each of the 32 entries in `$S/report.json`, open `$S/text/<slug>.txt` and check the record against the text above the first `Clarification`:
- `name` / `nameZh` match the second line exactly;
- `title` / `titleZh` match the third line;
- every skill heading became one skill, with its name and nameZh;
- every rules-text line belongs to the right skill, in order and verbatim;
- no strengths, weaknesses or clarification text leaked in;
- `maxHp` matches the spreadsheet row.

Fix any mismatch by editing that JSON file by hand from the page text, or report a page that really doesn't show a field by leaving the field out. Then append to the ledger one line per general, `Task 1: checked <id> — ok`, or `Task 1: checked <id> — fixed <what>`.

- [ ] **Step 5: Regenerate the generals index**

```bash
python3 - <<'EOF'
import pathlib, re
root = pathlib.Path('projects/content/data/generals')
index = root / 'index.ts'
src = index.read_text(encoding='utf-8')
KINGDOMS = [('wei', 'Wei'), ('shu', 'Shu'), ('wu', 'Wu'), ('qun', 'Qun')]
camel = lambda s: re.sub(r'-([a-z0-9])', lambda m: m.group(1).upper(), s)
entries = [(folder, label, p.stem) for folder, label in KINGDOMS for p in sorted((root / folder).glob('*.json'))]
imports = '\n'.join(f"import {camel(stem)}{label} from './{folder}/{stem}.json';" for folder, label, stem in entries)
record = '\n'.join(f"  '{stem}': {{ ...({camel(stem)}{label} as GeneralFileData), kingdom: '{label}' }}," for folder, label, stem in entries)
body = src[src.index('\nexport interface GeneralSkillData'):]
body = body.replace("  source: { url: string; site: string; crawledAt: string };",
                    "  source: { url: string; site: string; crawledAt: string; expansion?: string };")
head, _, _ = body.partition('export const generalsData: Record<string, GeneralData> = {')
index.write_text(imports + '\n' + head + 'export const generalsData: Record<string, GeneralData> = {\n' + record + '\n};\n', encoding='utf-8')
print(len(entries), 'generals indexed')
EOF
```

Expected: `57 generals indexed`. `git diff projects/content/data/generals/index.ts` shows only added imports and entries (Base lines reordered alphabetically within each kingdom is fine) and the widened `source` type.

- [ ] **Step 6: Fix the display test, run the tests**

Find a general without a title: `grep -L '"title"' projects/content/data/generals/*/*.json`.
- If one exists, change `display.spec.ts`'s `generalDisplayData('dong-zhuo')` to that id.
- If none exists, replace the test with "returns the data file's title for an expansion general", asserting `generalDisplayData('fire-zhuge-liang')!.title` is `'Sleeping Dragon'`, and ledger the change as a ruling.

Run: `npx jest --selectProjects content --testPathPatterns "wiki|registry|display"`
Expected: all PASS, except the Task 2 items: `wikiGenerals`'s skills-in-game list still includes `dong-zhuo` (6 ids), and `registry.spec`'s `skillIds('dong-zhuo')` still expects Tyranny. Both pass for now, because the hand-coded Tyranny is still attached. If anything else fails, fix the data, not the test.

- [ ] **Step 7: Fetch the art**

Run: `python3 scripts/crawl-assets.py`
Expected: `Crawled <id>: …` for the new generals, and a summary of `32 crawled` or fewer. Each skip is reported with its reason; ledger any skipped ids (they keep the placeholder). `manifest.json` gains the new entries. Dong Zhuo is re-crawled now that he has a `source.url`.

- [ ] **Step 8: Close the pipeline spec's Dong Zhuo item**

In `docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md`, under open item 4's Dong Zhuo bullet, append:

```markdown
     **Resolved 2026-10-02** (see `2026-10-02-expansion-generals-design.md`):
     `qun/dong-zhuo.json` now holds the crawled Forest Dong Zhuo (HP 8 from the
     AllGenerals spreadsheet, real skills, `source.expansion: "Forest"`), and the
     invented Tyranny skill code is removed.
```

- [ ] **Step 9: Run the whole suite**

Run: `npx jest`
Expected: content passes. Failures elsewhere are expected only in the Heroes/count/seat-cap tests that Tasks 2–4 update: `wiki-pages.spec` "26 generals", the Heroes tab labels, and `game.service.spec` `maxSeats`. Ledger the failing test names for those tasks, and commit anyway only if every failure is on that list. Otherwise fix before committing.

- [ ] **Step 10: Commit**

```bash
git add projects/content/data/generals projects/content/assets/manifest.json projects/content/src/lib/wiki.spec.ts projects/content/src/lib/registry.spec.ts projects/content/src/lib/display.spec.ts docs/superpowers/specs/2026-09-09-content-data-pipeline-design.md
git commit -m "feat(content): crawl the Wind, Fire, Forest and Mountain generals; real Forest Dong Zhuo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Game — drop Tyranny, cap at 10 seats

**Files:**
- Modify: `projects/content/src/lib/generals/setTwo.ts`, `projects/content/src/lib/generals/index.ts`
- Modify: `projects/content/src/lib/modes/guozhan.ts`
- Test: `projects/content/src/lib/generals/setTwo.spec.ts`, `projects/content/src/lib/registry.spec.ts`, `projects/content/src/lib/wiki.spec.ts`, `projects/content/src/lib/modes/guozhan.spec.ts`

**Interfaces:**
- Produces:
  - `export const MAX_GUOZHAN_SEATS = 10` from `guozhan.ts`, with `guozhanMaxSeats(registry) === Math.min(10, Math.floor(registry.generals.size / 5))`;
  - `GENERAL_SKILLS` holds 5 ids.

- [ ] **Step 1: Write the failing tests**

- `wiki.spec.ts` "marks exactly the generals whose skills are coded": the expected list becomes `['huang-yueying', 'sun-shangxiang', 'xiahou-dun', 'zhao-yun', 'zhuge-liang']`.
- `registry.spec.ts` "attaches hand-coded skills…": change `expect(skillIds('dong-zhuo')).toEqual(['tyranny']);` to `expect(skillIds('dong-zhuo')).toEqual([]);`.
- `guozhan.spec.ts`:
  - Change both `toBe(5)` seat-cap expectations to `toBe(10)`.
  - Change the import to also bring in `MAX_GUOZHAN_SEATS`.
  - Add, next to them:

```ts
  it('caps the table at 10 seats however large the pool grows', () => {
    const pool = (n: number) => ({ cards: new Map(), generals: new Map(Array.from({ length: n }, (_, i) => [`g${i}`, {} as never])) });
    expect(MAX_GUOZHAN_SEATS).toBe(10);
    expect(guozhanMaxSeats(pool(14))).toBe(2);
    expect(guozhanMaxSeats(pool(50))).toBe(10);
    expect(guozhanMaxSeats(pool(57))).toBe(10);
    expect(guozhanMaxSeats(pool(200))).toBe(10);
  });
```

- `setTwo.spec.ts`:
  - Delete the whole `describe('Dong Zhuo — Tyranny', …)` block.
  - In `registry()`, remove the `['dong-zhuo', asDefinition(dongZhuoGeneral)]` entry.
  - Remove `dongZhuoGeneral` from the import.
  - If `testHealSelfCard` is then unused, delete it too.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects content --testPathPatterns "wiki|registry|guozhan|setTwo"`
Expected: FAIL.
- The skills list still has `dong-zhuo`, and `skillIds('dong-zhuo')` is `['tyranny']`.
- The seat cap is 11 (57 ÷ 5), and `MAX_GUOZHAN_SEATS` is not exported.
- `setTwo.spec` may also fail to compile until Step 3.

- [ ] **Step 3: Implement**

`projects/content/src/lib/generals/setTwo.ts`: delete the `dongZhuoGeneral` export, and the `Effect` import if it becomes unused.

`projects/content/src/lib/generals/index.ts`: remove `dongZhuoGeneral` from the import and from `HAND_CODED`.

`projects/content/src/lib/modes/guozhan.ts`:

```ts
export const GENERALS_PER_SEAT = 5;
// A real Guozhan table seats at most 10.
export const MAX_GUOZHAN_SEATS = 10;

export function guozhanMaxSeats(registry: ContentRegistry): number {
  return Math.min(MAX_GUOZHAN_SEATS, Math.floor(registry.generals.size / GENERALS_PER_SEAT));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: content, engine and bots PASS. The app and sim failures should be limited to what Tasks 3–4 own: `wiki-pages.spec` (counts and the Heroes tab) and `game.service.spec` (`maxSeats` 5 → 10). Ledger the list.

- [ ] **Step 6: Deal-dependent tests (Review Focus 4)**

If any content test whose subject isn't the pool now fails because its seed deals different generals, don't loosen its assertion. Instead, pin the generals it needs explicitly (as the Guozhan spec's `seated()` helper does), and name it in the commit message.

- [ ] **Step 7: Commit**

```bash
git add projects/content/src/lib/generals projects/content/src/lib/modes/guozhan.ts projects/content/src/lib/modes/guozhan.spec.ts projects/content/src/lib/registry.spec.ts projects/content/src/lib/wiki.spec.ts
git commit -m "feat(content): drop the invented Tyranny skill; cap Guozhan at 10 seats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wiki — Qun tab and expansion chips

**Files:**
- Modify: `projects/content/src/lib/wiki.ts`
- Modify: `projects/app/src/app/wiki/wiki-general-entry.ts`
- Test: `projects/content/src/lib/wiki.spec.ts`, `projects/app/src/app/wiki/wiki-pages.spec.ts`, `projects/app/src/app/wiki/wiki-entries.spec.ts`

**Interfaces:**
- Produces:
  - `WikiGeneral.expansion: 'Base' | 'Wind' | 'Fire' | 'Forest' | 'Mountain'`;
  - the generals tab key and label `qun` / `Qun` replace `heroes` / `Heroes`;
  - `WikiGeneralEntry` renders `.expansion-tag`.

- [ ] **Step 1: Write the failing tests**

`wiki.spec.ts`:
- Replace "splits generals into Wei, Shu, Wu and Heroes" with:

```ts
  it('splits generals into Wei, Shu, Wu and Qun', () => {
    const tabs = wikiGeneralTabs();
    expect(summary(tabs)).toEqual([['wei', 'Wei', 15], ['shu', 'Shu', 15], ['wu', 'Wu', 15], ['qun', 'Qun', 12]]);
    expect(tabs[3].entries.every((g) => g.kingdom === 'Qun')).toBe(true);
    expect(tabs[0].entries[0].name).toBe('Cao Cao');
  });
```

- Add, inside `describe('wikiGenerals')`:

```ts
  it('tags every general with its expansion', () => {
    const count = (e: string) => generals.filter((g) => g.expansion === e).length;
    expect([count('Base'), count('Wind'), count('Fire'), count('Forest'), count('Mountain')]).toEqual([25, 8, 8, 8, 8]);
    expect(generals.find((g) => g.id === 'cao-cao')!.expansion).toBe('Base');
    expect(generals.find((g) => g.id === 'dong-zhuo')!.expansion).toBe('Forest');
  });
```

`wiki-pages.spec.ts`, in "shows Generals in Wei, Shu, Wu and Heroes tabs, opening on Wei":
- rename it to "…Wei, Shu, Wu and Qun tabs…";
- the summary becomes `'57 generals · 5 with skills in the game'`;
- the labels become `['Wei (15)', 'Shu (15)', 'Wu (15)', 'Qun (12)']`;
- the selected tab becomes `'Wei (15)'`;
- the entry count becomes 15.

`wiki-entries.spec.ts`:
- add `expansion: 'Base'` to the `caoCao` fixture;
- add `expect(el.querySelector('.expansion-tag')!.textContent!.trim()).toBe('Base');` to "shows names, title, kingdom, HP and skills";
- add the test below.

```ts
  it('shows an expansion general’s expansion', () => {
    expect(renderGeneral({ ...caoCao, id: 'cao-pi', expansion: 'Forest' }).querySelector('.expansion-tag')!.textContent!.trim()).toBe('Forest');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects content --testPathPatterns wiki && npx jest --selectProjects app --testPathPatterns wiki`
Expected: FAIL. The tab is still `heroes`, `expansion` is undefined, and there is no `.expansion-tag`.

- [ ] **Step 3: Implement**

`projects/content/src/lib/wiki.ts`:
- In `WikiGeneral`, add `expansion: 'Base' | 'Wind' | 'Fire' | 'Forest' | 'Mountain';`.
- In `wikiGenerals`'s map, add `expansion: (data.source.expansion ?? 'Base') as WikiGeneral['expansion'],`.
- In `generalTabs`, replace the heroes rule and its comment with:

```ts
    { key: 'qun', label: 'Qun', holds: (g) => g.kingdom === 'Qun' },
```

`projects/app/src/app/wiki/wiki-general-entry.ts`:
- In the template's `.meta` paragraph, add after the kingdom tag:

```html
          <span class="expansion-tag">{{ general().expansion }}</span>
```

- Add to its styles:

```css
    .expansion-tag { padding: 0 8px; border-radius: 8px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects content --testPathPatterns wiki && npx jest --selectProjects app --testPathPatterns wiki`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/wiki.ts projects/content/src/lib/wiki.spec.ts projects/app/src/app/wiki/wiki-general-entry.ts projects/app/src/app/wiki/wiki-pages.spec.ts projects/app/src/app/wiki/wiki-entries.spec.ts
git commit -m "feat(wiki): rename the Heroes tab to Qun; show each general's expansion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: App, sim, and a 10-seat table

**Files:**
- Test: `projects/app/src/app/game.service.spec.ts` (`maxSeats`)
- Possibly modify: `projects/app/src/app/game-board/round-table.ts` (see Step 4)
- Possibly modify: `projects/sim/src/property.spec.ts` (time budget)

- [ ] **Step 1: Update the seat cap expectation**

`game.service.spec.ts` "exposes the mode’s seat cap": change `toBe(5)` to `toBe(10)`.

Run: `npx jest --selectProjects app --testPathPatterns game.service`
Expected: PASS.

- [ ] **Step 2: Run the whole suite**

Run: `npx jest`
Expected: PASS. The property test now covers 2–10 seats (9 table sizes × 15 seeds × 2 bot kinds). If it runs past its 180 s timeout, raise the timeout to the observed duration × 2 and note it in the commit.

For any other failure:
- **A test whose deal changed:** pin its generals rather than loosen its assertion (Review Focus 4).
- **A test assuming at most 4 HP:** for example the pass-and-play discard test's "4 dealt + 2 drawn = 6 cards against at most 4 HP". The Forest Dong Zhuo can give 6 combined HP. Seat that test's generals explicitly, or pick a seed whose first seat has at most 4 HP, and say which in the commit (Review Focus 5).

Name every such test in the commit message.

- [ ] **Step 3: Check a 10-seat table live (Review Focus 2)**

With `npx ng serve --port 4300` running, start a 10-seat vs-bots game at 1400, 1024 and 360px wide. For each, record:
- `document.documentElement.scrollWidth` against the viewport width;
- the left and right extent of every `app-round-table .seat` against `main.content`;
- whether any two seat tiles' rectangles intersect.

Also check that selection shows both Zhuge Liangs distinguishably if dealt (their titles differ), and screenshot each width.

Expected: no horizontal overflow, every tile inside the content area, and no two tiles overlapping. If that holds, go to Step 5.

- [ ] **Step 4: If tiles overlap or overflow, shrink them for big tables**

In `projects/app/src/app/game-board/round-table.ts`:
- add `[class.crowded]="state().seats.length > 6"` on the `.table` element;
- add the CSS below, after the existing container rules, so a crowded table's tiles shrink a further 25% at every width.

```css
    /* More than six seats crowd the rim: shrink every tile a further 25%. */
    .table.crowded .seat { scale: 0.75; }
```

`scale` composes with the existing `transform: … scale(…)`. Re-run Step 3's measurements until they pass. If 0.75 isn't enough, lower it in 0.05 steps and record the value used. Add a unit test in `round-table.spec.ts` asserting that a 7-seat state renders `.table.crowded` and a 6-seat state doesn't.

- [ ] **Step 5: Run the whole suite and the build, then commit**

Run: `npx jest && npx ng build app`
Expected: PASS; build clean.

```bash
git add projects/app projects/sim
git commit -m "feat(app): up to 10 seats at the table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(List any pinned or adjusted tests from Step 2 in the commit body.)

- [ ] **Step 6: Wiki live check**

With the dev server still running, open `/wiki/generals` and each of its four tabs at 1400px and 360px. Expected:
- Wei (15) · Shu (15) · Wu (15) · Qun (12);
- every entry shows an expansion chip;
- new generals show their art (or the labelled placeholder for any skipped in Task 1 Step 7);
- no console errors.
