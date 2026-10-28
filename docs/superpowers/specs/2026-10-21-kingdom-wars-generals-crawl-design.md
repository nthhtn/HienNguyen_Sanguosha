# Kingdom Wars Deck — General Data Crawl (Design)

Date: 2026-10-21. Status: draft for review.

## Intent and why

The Kingdom Wars deck (see `2026-10-20-kingdom-wars-deck-crawl-design.md`) so far has
card data only. Its Generals will later get their own skill wording, and some
Generals' skills differ from Identity's. This step gathers Kingdom Wars' General
data from one English source and stores it in the repo, so the differences are
visible before anyone decides what to do about them. Same shape as the card
crawl: data plus a difference report, and nothing else.

Source: https://sanguoshaenglish.blogspot.com/2010/02/kw-characters.html
("KW Characters", Guozhan). The page is an index. It lists 60 Generals,
15 each under four anchors (`shu`, `wei`, `wu`, `heroes`); each General is an
image linking to its own page (for example `.../2012/08/liu-bei.html`). The
details live on those 60 pages. Heroes is the blog's name for Qun.

## Goals

- Crawl the index, follow every General link, and save each General's details.
- Store the data beside the card data, leaving Identity's data untouched.
- Extend the existing difference report with a Generals section.
- Parser tests against small saved excerpts.

## Non-goals and anti-goals

- No engine, setup-screen, server or bot changes. Nothing reads this data yet.
- No decisions: the report lists differences and resolves none.
- Do not invent HP or gender. Never guess a value the source does not state.
- Do not touch Identity's General files, the card crawl's outputs or any existing
  test.
- Do not download images or portraits.
- Comments on the blog posts (53 on the index, more on General pages) are not
  data and must not leak in. Only the post body is parsed.

## Constraints

- Python, standard library only, in `scripts/`, matching
  `crawl-kingdom-wars-deck.py` and `test_crawl_kingdom_wars_deck.py` (including the
  `scripts/fixtures/` excerpt approach). Follow redirects: the General links
  use `sanguoshaenglish.blogspot.sg` and may redirect to other blogspot
  country domains.
- Be polite to the blog: sequential fetches with a short pause, a User-Agent,
  and a local cache of fetched pages (outside the repo, or git-ignored) so a
  re-run does not re-download 60 pages.
- Deterministic output: same input pages give byte-identical files.
- Generals are in scope only from this one page. The parser should take the
  page and the force anchors as input so another list can be added later by
  naming it, as with the card crawl.

## What each General record carries

One JSON file per General under
`projects/content/data/decks/kingdom-wars/generals/<force>/<id>.json`, with ids and
file names like Identity's (`cao-cao`, `liu-bei`), and force folders `wei`,
`shu`, `wu`, `qun` (builder's call: the folder name `qun` matches Identity;
the blog's "Heroes" is recorded in `source`).

- `name` (English, as the blog titles the General), `force`.
- `title` and the skill list: each skill has `name`, `text`, as printed in
  English. A skill's Chinese name (`nameZh`, for example 仁德 from
  "Benevolence 仁德 (rén dé)") is kept when the page prints it. Ruler/lord
  skills are only recorded if the page shows one; the blog says Guozhan
  removes ruler abilities, so expect none.
- `synergisticPartners`: the partner names as printed, with their Chinese names
  and the relation text where present ("Sworn Brother"). Raw strings are fine
  if structure is brittle.
- `differenceFromNormal`: the "Difference from Normal SanGuoSha" text, kept raw.
- `source`: page URL, index anchor the General was listed under, crawl date.
- `nameZh`: taken from the page if it prints one; otherwise from the matched
  Identity General. Matching to Identity is by `nameZh` where the page has it,
  falling back to a normalised English name (the blog's names differ in
  spelling from Identity's in places, for example "Lady Gan"). Every match the
  fallback makes is listed in the report so a human can check it.
- `maxHp` and `gender`: **not crawled**. Where a matching Identity General
  exists they are copied from Identity's file, and the record notes that they
  came from Identity (`"hpFrom": "identity"`). Where Identity has no match they are
  absent and the General is listed as "missing HP and gender" in the report.
  Some of the 60 may be Generals Identity lacks (60 on the page, 57 in Identity).

Illustrative record shape (the builder may refine field names, but must keep
the provenance of every value explicit):

```json
{
  "id": "liu-bei", "name": "Liu Bei", "nameZh": "刘备", "force": "shu",
  "title": "The Ambitious Leader in Tumultuous Times",
  "maxHp": 4, "gender": "male", "hpFrom": "identity",
  "skills": [{ "name": "Benevolence", "nameZh": "仁德", "text": "During your action phase, ..." }],
  "synergisticPartners": ["Guan Yu 关羽 (Sworn Brother)"],
  "differenceFromNormal": "\"Benevolence\" is weakened. ...",
  "source": { "url": "...", "listedUnder": "shu", "crawledAt": "2026-10-21" }
}
```

## Difference report

Add a "Generals" section to
`projects/content/data/decks/kingdom-wars/diff-vs-identity.md`, generated by the
same script run. It lists, and does not resolve:

- Generals only in Kingdom Wars, and only in Identity;
- Generals whose force differs;
- skills present on one side only, and skills whose English name or text
  differs (both sides are English, so text is compared; compare after
  whitespace/quote normalisation so cosmetic differences do not drown real
  ones);
- Generals matched only by the English-name fallback (for checking);
- Generals with HP and gender missing.

The existing card sections of the report must come out unchanged.

## Parsing notes from reading the pages

- The post body sits in `div.post-body.entry-content`; the page is Blogger
  HTML, loosely structured, with `<br>` separated lines and bold or quoted
  labels ("Character ability:", "Synergistic Partners:", "Difference from
  Normal SanGuoSha:"). Pages were written over several years and may vary in
  label wording or order; the parser must tolerate that and report, not crash
  on, a page it cannot read fully (list it as "unparsed" with the reason).
- A General with two skills prints two "Character ability" entries; the
  parser must keep all of them in order.
- The index image link text is empty, so the General's name comes from the
  linked page, not the index.

## Tests

- Saved excerpts of the index (the four sections trimmed to a few links) and of
  two or three General pages: one single-skill, one multi-skill, one with an
  unusual layout.
- Tests: link extraction by force, skill parsing (count and order), partner
  parsing, comments excluded, Identity matching and HP/gender copy, the
  missing-HP case, report sections, and deterministic output.

## Identity's General data (what the crawl joins against)

Identity's Generals are
`projects/content/data/generals/<force>/<id>.json` (57 files). Each has `name`
(English), `nameZh`, `maxHp`, `gender`, `title`, `titleZh` and `skills`, where
every skill has English `name`, `nameZh`, `text` and, for ruler skills,
`lord: true`. Both sides are therefore English, so the skill text comparison is
meaningful. Match skills between the two sides by `nameZh` when both have it,
otherwise by normalised English name.

## Calls made by the design author (not by the user; check these)

- **Matching trust.** The `nameZh` match is trusted. The English-name fallback
  copies HP and gender only when it finds exactly one candidate; with zero or
  several it copies nothing, and the General goes to the report as unmatched.
  Every fallback match is listed for checking either way.
- **`nameZh` when unmatched.** Absent, not guessed.
- **Force.** The index anchor is the Kingdom Wars force (`heroes` is Qun). If the
  matched Identity General has a different force, that goes in the "force
  differs" list; neither value is overwritten.
- **Ids.** A General's id equals the matched Identity General's id when there is
  a match (the match decides, not the slug). Without a match, derive it from
  the page slug minus the `.html`, and drop a trailing `-lady-xxx` style
  suffix so `gan-fu-ren-lady-gan` becomes `gan-fu-ren`; the builder lists any
  other slug it had to adjust.
- **Cosmetic normalisation** for comparing skill text and names: collapse
  whitespace, unify straight and curly quotes and dashes, and trim; keep case
  and wording otherwise.
- **Unparsed pages.** A page the parser cannot read fully gets no record, is
  listed with its reason in a report section and printed as a warning, and is
  left out of every comparison. The run still finishes with exit code 0 so one
  odd page does not block the other 59, and a test asserts the listing.

## Left to the builder

Exact field names, the id derivation for Generals whose page slug is awkward
(`zhang-zhao-zhang-hong`, `yan-liang-wen-chou`, `taishi-ci`), the pause length
and cache location, and how the Generals section is organised inside the
existing report.

## Open for later (not this step)

Whether Kingdom Wars should ship its own General set at all, how its skill
differences become engine behaviour, and where HP and gender for Generals
Identity lacks will come from.
