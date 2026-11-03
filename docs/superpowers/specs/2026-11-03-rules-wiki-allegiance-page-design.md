# Rules Wiki: the Allegiance page

Date: 2026-11-03. Status: approved by the user in conversation (rule text and scenes).
Extends `2026-11-03-rules-wiki-rewrite-design.md`: one more rules page, built on the same scene components.

## Intent

The Rules Wiki never explained Ambitionists or allegiance, although the engine has them and the Overview and Setup pages lean on the idea ("plays for a Force", "a killer who has not revealed a General"). Players asking "why did my seat become an Ambitionist?" or "why did the game not end when only Wei seats were left?" find no answer. This page gives them one, in the same style as the other rules pages: short rules, each shown with a scene from the real art.

## Scope

- A new page **Allegiance** at `rules/allegiance`, in the Rules menu right after **Setup**.
- One new sentence on the Overview, with a link to the page.
- Guozhan only. Identity mode will have its own rules later and may differ.
- English and Vietnamese together. The Vietnamese is a draft for native review. The page title is "Phe phái" (new wording, flagged for review); "Dã tâm gia" for Ambitionist already exists in the app.

## Rule text (Guozhan)

Every rule below is taken from the engine; the sources are `projects/content/src/lib/modes/guozhan.ts`, `projects/content/src/lib/shared/kingdom.ts`, `projects/engine/src/lib/pipeline/resolve.ts` (`withAllegiance`), `projects/engine/src/lib/domain/types.ts`, and the tests in `projects/content/src/lib/modes/guozhan.spec.ts` (sections "Ambitionists").

1. A seat's allegiance is decided **once**, at the moment its first General is shown: by revealing it, or by the death reveal. It never changes afterward. Until then the seat has none.
2. There are two kinds. A **Kingdom** seat plays for the Force of its revealed General. An **Ambitionist** plays alone, as a group of one, for no Force.
3. **The cap.** A Force may hold at most half the table, rounded down. Dead seats still count; an Ambitionist holds no slot. A seat that reveals into a Force already at its cap becomes an Ambitionist; otherwise it is a Kingdom seat. The cap is 4 at 8 seats, 3 at 6 seats, 1 at 2 seats. A hidden seat that dies in a full Force also becomes an Ambitionist, through the death reveal.
4. **Force effects ignore Ambitionists.** An Ambitionist is never "the same Force" as anyone, and the printed Force of its General does not count.
5. **Kill reward.** Killing an Ambitionist draws the killer 3 cards. An Ambitionist killer is never penalized: it never discards its hand.
6. **Winning.** A Force wins when every survivor has chosen that Force. A hidden survivor, or an Ambitionist, keeps the game going. The last survivor wins alone; an Ambitionist who is last wins with no Force.

(The Qun ruling of the user applies throughout: Qun is a Force like the others.)

## Scenes (static, real art)

1. **Two Kinds of Allegiance:** a Kingdom seat beside an Ambitionist seat, the Ambitionist with the game's Ambitionist mark and the label "Ambitionist" in place of a Force.
2. **The Cap:** a 6-seat table, cap 3: three Wei seats reveal and are Kingdom seats; a fourth seat reveals a Wei General and becomes an Ambitionist. A line says dead seats still count.
3. **Killing an Ambitionist:** the killer, an Ambitionist seat that is out, and 3 drawn cards.
4. **Winning:** three outcomes side by side: a Force wins, the game goes on (a Kingdom seat and an Ambitionist), a sole survivor wins alone.

## Non-goals

- No engine change. Characterization tests may be added to pin claims the existing tests do not.
- No Glossary entries yet (the Glossary stays at twelve terms).
- No interactive scene.

## Left to the builder

Component and key names, scene layout details, where inside the Overview's Winning list the new sentence goes, and the exact order of seats in the scenes.
