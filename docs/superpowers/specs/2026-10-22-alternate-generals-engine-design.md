# Alternate Generals in the Engine (Design)

Date: 2026-10-22. Status: draft for the user's approval. Builds on the Alternate
Generals crawl (`2026-10-21-alternate-generals-crawl-design.md`, data in
`projects/content/data/decks/alternate/generals.json`), the Alternate cards in the
engine (`2026-10-21-alternate-cards-engine-design.md`) and the General skill
system (`2026-10-05-general-skills-design.md`).

## Intent and why

The Alternate deck has 60 Generals. Today they exist only as crawled records
(the Wiki shows them); an Alternate game still deals Default's Generals and
Default's skills. This stage makes the Alternate deck's own Generals playable
with the Alternate deck's own skill rules, so choosing the Alternate deck gives
a faithful Alternate game. Default games must not change.

## What the crawl shows (counts from the data)

- 51 of the 60 Alternate Generals share an id with a Default General. Six
  Default Generals are not in Alternate (Dong Zhuo, Yu Ji, Zuo Ci, Jiang Wei,
  Deng Ai, Sun Ce); they stay out of the Alternate pool.
- 9 Generals are new to the engine: Gan Fu Ren, Yue Jin, Ding Feng, Ji Ling,
  Kong Rong, Ma Teng, Pan Feng, Tian Feng, Zou Shi (about 14 new skills, plus
  Ma Teng's Horsemanship, which exists).
- 2 Generals have a different skill in place of a Default one: Lu Xun
  (Scrutinize, a red hand card used as Amass, replaces Linked Camps) and Zhang
  Zhao and Zhang Hong (Stabilization replaces Stubborn). Guo Jia's Bequeathed
  Strategy changes from "draw two, then distribute" to "view the top two, then
  give". Zhang Liao's Sudden Strike may be Raid reworded (to check).
- About 25 Generals carry a difference note on a skill of the same Chinese name.
  Some are real rule changes (Liu Bei heals at 3 cards, Sun Quan's cap, Zhou Yu's
  order, Zhen Ji, Cai Wenji, Xun Yu's cap of 5, Zhu Rong, Huang Yueying, Sun
  Shangxiang and Diao Chan not targeting themselves). Others are rewordings that
  may or may not change timing (Empty City and Humility "cancel" rather than
  "cannot be targeted", Behind the Curtain, Banish, Resurrection, Entrenched,
  "immediately" removed).
- 22 Generals are marked "Nil" (same as Default).
- No Alternate General has a Lord skill. The crawl records "The Lord Ability
  is removed" for the seven Generals who have one in Default (Liu Bei, Cao Cao,
  Sun Quan, Yuan Shao, Zhang Jiao, Liu Shan, Cao Pi). Dong Zhuo and Sun Ce, the
  other Default Lord Generals, are not in Alternate.

## Goals

- Choosing the Alternate deck gives Alternate's General pool (60 Generals), each
  with the Alternate skills and effects, playable by humans and by
  legal-action-driven bots.
- Default games are unchanged.
- New names show in English and Vietnamese (Vietnamese as draft; the locale file
  `alternate-generals.json` already has all 9 new Generals).
- The Wiki marks an Alternate General "In game" once all its skills are
  registered (it should derive this from the registry, as it does for cards).

## Non-goals and anti-goals

- No new game modes, no other decks, no Lord abilities anywhere in Alternate.
- Bots need only to play legally and not crash; smart use of the new skills is
  not required (my call; the bots layer is not part of this request).
- Anti-goals: a central switch over General or skill ids; Alternate rules
  written inside Angular components; Default's behaviour changing; a skill
  implemented from vague text without the user confirming its rule text first.

## Decisions made with the user

1. **Variants per deck.** An Alternate General reuses a Default skill where the
   Alternate skill is the same. Where it differs, a variant skill is registered
   for that General and chosen when the deck is Alternate. (Confirmed
   2026-10-22.)
2. **No Lord abilities in Alternate.** Choosing the Alternate deck drops the
   Lord skills of those Generals. (Confirmed as correct reading of the crawl,
   2026-10-22.)
3. **Order of slices: 1, 2, 3, 4** (below; the user briefly chose 1, 4, 3, 2 and then went back to 1, 2, 3, 4). Each slice is merged and playable
   before the next starts.
4. **Rules are confirmed by the user for every vague skill.** Before a skill
   whose blog text is vague is implemented, I write exact rule text and the user
   confirms it, as was done for the Alternate cards. Clear skills do not need a
   round.

## Slices

### Slice 1: Plumbing and no Lord abilities

- The deck chooses the General pool (60 ids for Alternate; Default unchanged)
  and the skill set per General (Default skills, with per-deck overrides).
- Lord skills: the engine already ignores any skill flagged `lord`
  (`skillsInPlay` in `engine/.../generalSkills.ts`, and `triggers.ts`), in every
  deck, so no Lord skill ever works in a Kingdom War game. Alternate's
  "no Lord abilities" therefore needs no behaviour change; its Generals simply
  carry no `lord` skills. Nothing else in the engine reads the lord flag (checked
  2026-10-22). The lord-flag spec (`lordFlags.spec.ts`) must still hold.
- The Alternate pool is all 60 Generals from the start. A General offers only
  the skills that are ready for the Alternate deck (Default's where the skill
  matches, a variant once registered); a skill not ready yet is simply absent,
  and a General with none plays vanilla, the fallback the engine already has.
  (Decided by the user, 2026-10-22.)
- The Wiki's "In game" marking for Alternate Generals follows the registry.

### Slice 2: Rule-changing variants and new skills on known Generals

The real rule changes (Liu Bei, Sun Quan, Zhou Yu, Zhen Ji, Cai Wenji, Xun Yu,
Zhu Rong, Huang Yueying, Sun Shangxiang, Diao Chan, and any the wording check later finds are real changes
here), plus Lu Xun, Zhang Zhao and Zhang Hong, Guo Jia, and Zhang Liao if it is a
change. Each uses the per-deck override from slice 1, and each vague one gets a
rule-text confirmation first.

### Slice 3: The 9 new Generals

Gan Fu Ren, Yue Jin, Ding Feng, Ji Ling, Kong Rong, Ma Teng, Pan Feng, Tian
Feng, Zou Shi, with their skills. Several need new engine ideas (Zou Shi blocks
other players from revealing and re-hides a revealed General; Ji Ling's Slash
from a Points Duel; Tian Feng's Kingdom-and-dying trigger; Ma Teng's single-use
skill tied to Kingdom size; Ding Feng's distance to 1). Each vague skill gets a
rule-text confirmation first (decision 4). Ordering inside the slice is the
builder's call.

### Slice 4: Wording-only differences

For each General whose note is only wording, compare the Alternate text with the
Default implementation and decide: no change (the General is simply registered
as Default's), or a real timing difference (it moves to slice 2's list, which by then is merged, so it becomes a small follow-up). Includes
the 22 "Nil" Generals and the "immediately removed" notes. Output: a list of what
was checked and what it was decided as, in the plan.

**Done (2026-10-23):** 29 skills cleared as Default's, 3 variants added (Descend into Chaos, Lightning Strike, Resurrection); all 60 Generals now play their Alternate skills. The audit list is in `2026-10-23-alternate-generals-slice-4-rules.md`.

Slice 4 also owns these skills of Generals finished in slice 2, which have no difference note of their
own and must be checked as unchanged before they are cleared: Zhuge Liang's Star Gazing (观星), Xun
Yu's Rouse the Tiger (驱虎), Zhu Rong's Giant Elephant (巨象), Zhen Ji's Stunning Beauty (倾国), Jia
Xu's Descend into Chaos (乱武) and Unmitigated Murder (完杀), plus Guo Jia's Envy of Heaven (天妒),
Sun Shangxiang's Marriage (结姻), Zhou Yu's Heroic Demeanor and Sow Dissension, and Zhang Liao's Sudden
Strike.

## Constraints

- Lord is the official term (not Ruler). Lord skills are ignored today, but they
  will be brought into the game in a later version, so Alternate Generals must
  not lose the information: the crawl records, the Lord flag and the Default
  Lord skills stay as they are, and Alternate's "no Lord skills" is expressed as
  a per-deck choice, not by deleting data. (Confirmed by the user, 2026-10-22.)
- Engine stays framework-free and executable under plain Node; state stays
  plain serializable data.
- Content is data-driven registries: a variant is its own definition, not a
  branch in the Default skill.
- UI text follows the casing rules in `CLAUDE.md`; new Vietnamese text starts as
  draft (`npm run i18n:status`).
- Each slice carries its own tests, including a Default-unchanged check.

## Calls added after the reviewer's questions (my calls unless marked)

- Who classifies a difference note: I do, in the plan. A note is a real change
  if the Alternate text could give a different outcome from the Default
  implementation in any case; a doubtful one counts as real and goes to the user
  for confirmation (decision 4). "Vague" means the exact trigger, timing, target
  or limit cannot be read from the text.
- The Wiki's "In game" marking for an Alternate General means every skill the
  Alternate record lists resolves for the Alternate deck (Default's or a variant),
  so a reused-Default General counts as in game.
- Engine changes for slice 3's new mechanics are allowed; the guard is that all
  Default tests and a Default simulation stay unchanged. Engine work for a
  mechanic is scheduled before the Generals that need it.
- Art: the assets hold no portraits for the 9 new Generals (only Zou Shi's death
  audio). They use placeholder portraits for now (decided by the user,
  2026-10-22); sourcing real art is a later, separate task.

## Left to the builder

How the per-deck override is keyed and where it lives; how the pool is chosen;
the order inside slices 3 and 2; test structure; how the "In game" marking
reads the registry.

## My calls to check

- Bots are not made smart about the new skills.
- Slice 4 runs last. If a "wording" note turns out to change real behaviour, that General gets a variant there, as in slice 2.
