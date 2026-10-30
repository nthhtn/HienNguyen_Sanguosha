---
name: add-general-skill
description: Use when a General's skill wording is about to be turned into a rules block, or when asked what mechanics an existing skill uses. Called by add-general before it writes the rules.
---

# Classify a General's Skill

Turn one skill's wording into a mechanics table the developer confirms before the rules block is written. Run it once per skill. Standalone use is rare: classify, stop after step 5, write no rules and touch no code.

**Violating the letter of these gates is violating their spirit.**

## Steps

1. **Take the wording** from the confirmed input sheet, or quote it as the developer gave it. Do not paraphrase.
2. **Fill the table.** Copy the table below into the reply, one row per axis. Pattern names come from [mechanics.md](mechanics.md), and you confirm each one with grep before naming it, since the code drifts. Every row ends with one of:
   - `read`: the wording settles it. Quote the words.
   - `unclear`: the wording does not settle which value the axis takes (for example "may" or "must" is missing, or it is not said whether the skill triggers or is used). Open edge cases such as ties, hidden seats or when a count is taken do not make a row `unclear`. They are answered in the rules block (step 6).
   - `gap`: no existing pattern fits. "Treat as" covers a card counting as another card. Changing who uses a card is a `gap` on the Effect row.
3. **Stop on `unclear` and `gap`.** Ask the developer one question per row, one sentence each, and wait. A `gap` question names the options you can see (new `modifiers` field, new hook, new turn flag) and which one you recommend. Nothing moves on until every row is `read` or answered.
4. **Show the table and wait for "Correct".** Corrections go back through step 2.
5. **List the per-skill tables the build will touch** (the checklist at the end of [mechanics.md](mechanics.md)), each marked needed or not.
6. **Preview the sequence** when called by add-general. **REQUIRED SUB-SKILL:** use add-general-skill-preview, which skips a skill with no events in sequence. Wait for its storyboard to be confirmed.
7. **Hand back** to add-general: the confirmed table opens the skill's rules block, with the input-sheet edge cases answered beneath it and the confirmed storyboard under that.

## Table

| Axis | Value | Code pattern | Example skill | Status |
|---|---|---|---|---|
| Activation: ignition, trigger, passive | | | | |
| Frequency: per turn, several per turn, once per game | | | | |
| Obligation: compulsory, optional | | | | |
| Target: player, card, none | | | | |
| Cards involved: cost, read, moved | | | | |
| Effect: damage, draw, judgment, other | | | | |
| Compete | | | | |
| Treat as | | | | |
| Phase | | | | |

## Rationalizations

| Thought | Reality |
|---|---|
| "The developer is in a hurry, I'll pick defaults and list them as assumptions" | An assumption list is a guess shipped past the gate. Mark `unclear` and ask. |
| "The existing code answers the edge case" | Code is what someone built, not what the developer agreed. Quote it as a suggestion and ask. |
| "The pattern is probably there" | Grep it. A name read from a comment is not a pattern. |
| "`limited` handles once per game" | It is only a flag. The author enforces it with a seat mark. |
| "One new hook is small, I'll note it and continue" | A `gap` stops the work until the developer picks how to build it. |
| "Axis not relevant, I'll skip the row" | Fill every row. "None" with the quoted words is an answer. |
| "The skill already exists, so no table" | That is add-general step 1. If the developer still wants it classified, classify it. |
