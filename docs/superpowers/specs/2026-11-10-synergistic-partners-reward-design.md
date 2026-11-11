# Synergistic Partners Reward — Design

## Intent

Some Generals are written up as belonging together (Liu Bei with Guan Yu, Lu Bu
with Diao Chan). Each General's wiki entry already lists its Synergistic
Partners, but the game does nothing with them. This change makes the pairing
matter: a player who ends up holding two Generals that are Synergistic Partners
is rewarded once, the moment the second General is revealed.

## The rule (Guozhan, Kingdom Wars deck)

> When a seat's second General is revealed, and its two Generals are Synergistic
> Partners of each other, that seat chooses one: **draw 2 cards**, or **recover
> 1 HP**.

- **Which reveal.** The reveal that leaves both of the seat's Generals revealed.
  The order (Main first or Deputy first) does not matter; every listed pair is
  mutual, so a pair is an unordered pair of General ids.
- **Every way of revealing counts.** The Start window, a trigger's reveal, and
  reveal-on-use (Roar and the like) all produce the same `GeneralRevealedEvent`;
  the reward hangs off that event, so no path is special-cased. A death reveal
  (`onDeath`) gives no reward, as for the other reveal bonuses.
- **Only the first time.** A General hidden again (Impetus for Conflicts) and
  revealed again pays nothing a second time. The existing
  `firstTimeBothRevealed` in `guozhan.ts` already encodes exactly this; reuse it.
- **Full HP.** The "recover 1 HP" option is always shown. When the seat is at
  max HP it cannot be selected (shown disabled); "draw 2 cards" is always
  selectable. The engine must reject a move that picks a disabled option, not
  only the UI.
- **Stacking.** It is independent of the Rounding bonus (odd printed HP sum draws
  1 card on the second reveal) and of First Reveal. A seat can get more than one
  on the same reveal. The reward's prompt appears after the reveal is logged,
  like the other bonuses.
- **Bots.** A bot chooses "recover 1 HP" when it is damaged, otherwise "draw 2
  cards".
- **Others see.** One Action History line, in the style of the existing lines,
  for example "Hing revealed Synergistic Partners and drew 2 cards" / "…and
  recovered 1 HP". The choice itself is not secret. No animation or sound now;
  leave room to add them later.

## The pairing data

The wiki's `synergisticPartners` is crawled free text ("Guan Yu 关羽 (Sworn
Brother)"), not ids. Leave it as it is; it feeds the wiki. Add a separate, clean
table of id pairs in content (for example
`projects/content/data/decks/kingdom-wars/synergistic-pairs.json`, builder's
call on name and place), and a typed accessor in the content project. The
engine asks the registry or mode whether two General ids are partners; it never
parses the wiki text.

The approved list, 19 unordered pairs (English id pairs; the user checked them in
Vietnamese names). Note `zhuge-liang` and `fire-zhuge-liang` are two different
Generals that share the Vietnamese name "Gia Cát Lượng", so ids, not names, are
what the table holds.

```
guan-yu | liu-bei
liu-bei | zhang-fei
gan-fu-ren | liu-bei
huang-yueying | zhuge-liang
fire-zhuge-liang | huang-yueying
fire-zhuge-liang | pang-tong
huang-zhong | wei-yan
liu-shan | zhao-yun
meng-huo | zhu-rong
cao-cao | dian-wei
cao-cao | xu-chu
cao-pi | zhen-ji
xiahou-dun | xiahou-yuan
sun-quan | zhou-tai
da-qiao | xiao-qiao
huang-gai | zhou-yu
xiao-qiao | zhou-yu
diao-chan | lu-bu
yan-liang-and-wen-chou | yuan-shao
```

A spec test should cross-check the table against the crawled lists: every id
exists, and every pair appears in both Generals' `synergisticPartners` text
(they are mutual today), so the table and the wiki cannot drift silently.

## Where it lives

- **Engine** (`projects/engine`): the choice machinery. Today `ChoiceOption` has
  no "visible but not selectable" state and `DecisionReason` has no kind for a
  mode-level reward, so both need a small, general extension (a disabled flag on
  an option that legality enforces; a reason kind or equivalent for a reward the
  mode asks). Keep it general, not reward-specific.
- **Content** (`projects/content`): the pairs data, and a trigger beside
  `revealBonusTriggers` in `modes/guozhan.ts` that, on `after:GeneralRevealedEvent`,
  checks both Generals revealed, `firstTimeBothRevealed`, not `onDeath`, and a
  listed pair, then opens the choice with options "Draw 2 Cards" and "Recover 1
  HP" (the effects are `DrawCardsEffect` and the existing heal effect).
- **Bots** (`projects/bots`): the choice rule above.
- **Protocol / server / app**: whatever carries a choice option to a client must
  carry the disabled state; the app shows a disabled button. Both the local game
  screen and the online one use the shared choice rendering; do not fork them
  (Setup and Game stay as they are).
- **Text**: English and Vietnamese, following the casing rules in `CLAUDE.md`
  (Title Case for the option labels, sentence case for the history line; Vietnamese
  is sentence case, draft status). "Synergistic Partners" is the existing term
  (`wiki.partners`); reuse the existing Vietnamese rendering.
- **Docs**: add the reward to "Reveal bonuses" in `docs/architecture/event-chain.md`,
  and to the Rules Wiki where reveal bonuses are described.

## Goals

- The rule behaves exactly as above in every reveal path.
- Rules stay in the engine; the UI only renders the choice and its disabled state.
- Adding a new pair later is a data edit, not a code change.

## Non-goals

- Animation, sound, or any effect beyond the history line (a later improvement).
- Identity deck behavior: it has no partner data and is disabled in setup. If it
  returns, its pairs are a separate decision.
- Any change to the wiki's partner display or the crawl.
- A "rule on/off" setting: this is a standing Kingdom Wars rule, not an option in
  `state.rules`. (Builder's call to revisit if replay of stored games requires
  it; see below.)

## Anti-goals

- Matching General names or the wiki text in the engine.
- Letting the UI decide whether HP recovery is allowed.
- A reward that can fire twice for one seat, or fires on a death reveal.

## Left to the builder

- Names and file locations of the data, accessor, reason kind and disabled flag.
- Whether the engine option needs a version gate so stored games, which never
  had this prompt, replay unchanged (the `judgmentNotice` rule shows the
  pattern: new behavior that changes the action sequence is stored in
  `state.rules`). Decide from how replay works today; the user wants the
  behavior on for new Kingdom Wars games.
- The exact wording of the two option labels and the history line, within the
  casing rules.
- Test layout: engine tests for the choice and disabled option, content tests for
  the trigger and data cross-check, bot tests, one simulator run to see it fire.
