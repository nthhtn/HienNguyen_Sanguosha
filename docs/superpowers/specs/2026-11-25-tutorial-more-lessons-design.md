# Tutorial: more lessons and groups

Five more Tutorial lessons for beginners who have finished the basics, and tabs that group all ten lessons.

## Intent

- **Who.** A beginner who has finished the five lessons in `2026-11-25-tutorial-design.md`.
- **Why.** The first five lessons cover the basics, but the Wiki's Equipment, Tools, Wuxie, Delayed Tools, Judgment and Chains pages are things a beginner cannot try there.
- **What success looks like.**
  - A beginner can wear Equipment and knows what a Weapon, an Armor and a Mount do.
  - They can play a Tool on a seat and know that a Tool can be answered.
  - They can cancel a Tool with Wuxie, and cancel a Wuxie with another.
  - They know a Delayed Tool waits for its holder's Judgment Phase, and can read a Judgment.
  - They know a chained seat passes fire and thunder damage on.

## Goals

- **Five lessons.** Same pattern as lessons 1 to 5: Data, a state recipe, spotlight steps and scripted bots, played headlessly against the real engine.
  1. **Equipment:** Wear a Weapon, an Armor and a Mount, see the attack range, and see a Mount change which seat a Sha reaches.
  2. **Tools:** Play Steal on one bot and Break on another, and see that a Tool is answered before it takes effect.
  3. **Wuxie:** A bot plays Break on the beginner, the beginner cancels it with Wuxie, the bot cancels that Wuxie, and the beginner cancels that.
  4. **Delayed Tools and Judgment:** Place Starvation on a bot, then watch its Judgment Phase with a fixed draw pile so the verdict is not left to chance.
  5. **Chains:** Chain two bots, hit one with a Fire Attack, and watch the damage pass to the other.
- **Groups.** The Tutorial page shows the lessons in tabs.
  - **Basics:** Your Generals, Allegiance, Turn Structure, Sha and Shan, Damage and Recovery.
  - **Cards:** Equipment, Tools, Wuxie.
  - **Special Effects:** Delayed Tools and Judgment, Chains.
- **Both languages.** Every new string is a catalog key in English and Vietnamese (Vietnamese as draft).
- **Phones.** The lessons and the tabs work on the phone board.

## Non-goals

- **More groups or lessons.** Free play with hints, per-General guides and practice puzzles stay in `docs/deferrals.md`.
- **Engine and content changes.** No rule is added or changed.
- **A new progress model.** Progress is still the set of finished lesson ids.

## Anti-goals

- **Wrong rules.** A lesson that teaches something the engine does not do is a failure. Each lesson must play headlessly to the end.
- **Luck.** A step that depends on a random draw is a failure. Judgments and draws are fixed by the recipe.
- **A trap.** Exit stays on screen at every step, and the board stays locked to the highlighted control.

## Constraints

- **Layering.** Lesson data lives in `projects/app/src/app/tutorial/lessons/`. The UI never decides legality, and scripted bots only pick from `getLegalActions`.
- **No dev code in production.** Lessons use `scenario-kit`, not `dev/`.
- **UI text style.** `CLAUDE.md` casing rules apply: Tab labels are Title Case ("Basics", "Cards", "Special Effects"), instructions are sentences, and Vietnamese is sentence case.
- **Card ids.** The content ids are the source of truth (`peach`, not "Tao").

## Approaches

- **A. Lessons as data in the existing pattern, a `group` field on each lesson, and Material tabs on the page (chosen).**
  - Trade-off: The page and the lesson type change a little, and the new lessons need new anchors on the equipment area, the judgment area and the judgment popup.
- **B. One long list with section headings.** Less work, but ten lessons in one scroll is the problem the tabs solve. Rejected.
- **C. Separate pages per group.** More routes and a heavier Home and toolbar for no gain. Rejected.

## Design

### Groups

- **Data.** A lesson has `group: LessonGroupId` (`'basics' | 'cards' | 'effects'`). A `LESSON_GROUPS` list gives each group its title key and keeps the order.
- **Tabs.** One Material tab per group; its label shows the finished count, for example "Basics (3 of 5)".
- **Default tab.** The first tab with an unfinished lesson, or the first tab when all are done.
- **Next Lesson.** Still the next lesson in list order, across tabs.
- **Back to Lessons.** Returns to the tab of the lesson that just ended.
- **Phone.** The tab row scrolls sideways when it does not fit.

### The lessons

- **Equipment.** A recipe where the beginner holds one Weapon, one Armor and one Minus Mount in the Play Phase. Steps ring the card, its Play button, then the equipment area where it appears. A last step shows a Sha reaching a seat that was out of range.
- **Tools.** The beginner holds Steal and Break. Steal on the neighbour takes a card; Break on another seat discards one. The text names the Wuxie check without teaching it yet.
- **Wuxie.** A bot plays Break on the beginner at the start of the lesson. The beginner holds two Wuxie. The response window opens, the beginner plays one, a scripted bot plays a Wuxie on it, and the beginner plays the second. The last step shows the Break cancelled.
- **Delayed Tools and Judgment.** The beginner plays Starvation on a bot. The draw pile is stacked so the judgment is a known suit. The bot's Judgment Phase is shown, then the judgment popup, then the result (skip or keep the Draw Phase).
- **Chains.** The beginner holds two Chains and a Fire Attack. Chains on two bots, then Fire Attack on one. The damage passes and both chains break.
- **Wording.** Steps condense the Rules pages (`rules.response.*`, `rules.chains.*`, `rules.judgment.*`, `rules.cardTypes.*`) and note the source key beside each text key.

## Testing

- **Lessons run headlessly.** `lessons.spec.ts` already covers every registered lesson: It plays to the end, every key exists in both languages, every target is a known anchor id.
- **Groups.** Specs for the grouping helper (counts, default tab) and for the page (tabs shown, counts shown, Back returns to the right tab).
- **Anchors.** Board specs for the new anchors on the desktop and phone boards.
- **Browser check.** A look at desktop and phone widths, as for the first five lessons.

## Left to the builder

- **Exact cards and seeds.** Which Weapon, Armor, Mount and seed each lesson uses, chosen against the engine.
- **Step wording and Vietnamese drafts.**
- **Anchor placement.** Where on the seat tile and the phone board the new anchors sit.

## Decisions from the conversation

- **Groups and order.** Basics, Cards, Special Effects, with the lessons as listed above (approved).
- **One PR.** One branch, one commit per lesson, the grouping as its own commit.
