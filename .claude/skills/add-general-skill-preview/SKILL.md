---
name: add-general-skill-preview
description: Use when a General's skill has been classified in add-general-skill and its effect resolves in several steps (a trigger, a choice, a judgment, a card moving), or when asked for a preview video of a skill.
---

# Preview a General's Skill

Two short films per skill, one English and one Vietnamese, that play the agreed sequence of events so the developer checks the rules by watching. Each film is a scene written as plain files and rendered on this machine (the local route, chosen by the developer on 2026-11-09); the Motion artifact route in [blocks.md](blocks.md) is the alternative when the developer asks for film pages. A film shows the rule as agreed and adds none.

**Violating the letter of these gates is violating their spirit.**

## Steps

1. **Take the inputs** from the confirmed add-general-skill table: the quoted wording, the deck, the force. Every skill gets a film, passive ones included (decided 2026-11-10). A passive skill has no trigger to show, so its first beat is the situation where the skill changes the outcome (Horsemanship: a Sha aimed at a seat just out of range), then what happens because of it. The film shows the effect in play, not a description of it.
2. **Check the rule in code.** Open the skill in `projects/content/src/lib/generals/` and read what it does, since the film must not disagree with the engine. Read the deck's record too (`projects/content/data/decks/<deck>/generals/<force>/<id>.json`) for the skill's name and wording. The film uses the deck's name and wording. Where the confirmed table quotes another deck's name or wording, or the engine acts differently from it, say so and ask which one the film follows.
3. **Write the storyboard in chat**: at most 6 beats, each with the time it starts, what moves, and its caption. The first beat is the event that triggers the skill, shown briefly. Give every caption in English and in Vietnamese. Vietnamese names come from `projects/content/data/locales/vi/kingdom-wars-generals.json` and the glossary. If that file has no entry for this General yet, propose draft names and mark them draft. Under the beats put two lists: `left out` (rule parts not shown) and `made up` (ranks, seats, HP, hand sizes). Ask a real question about anything unclear and wait for "Correct" on both languages before building.
4. **Build both films**, English first, then Vietnamese on the same scene with the captions, fonts and seat tag changed as [look.md](look.md) says. Follow look.md for palette, layout, wording and length, and [blocks.md](blocks.md) for the pieces. [example-scene.js](example-scene.js) is a finished scene and [base.css](base.css) the stylesheet to start from. Write each film's files in `projects/content/preview-films/<force>/<general-id>_<skill-id>/en/` and `.../vi/`: `scenes.json`, `base.css` and `scene-demo.js`, the documents blocks.md describes, as plain files. Keep them in the repo: a correction later is an edit and a re-render. The look is fixed, so decide palette, layout, wording and length from look.md and say the choices in one line.
5. **Hand over.** The two film folders and the MP4s, the two lists from step 3, the Vietnamese marked draft, and that the films are silent. Say plainly if you did not watch them play. Corrections edit the scene file and re-render.
   - **Videos:** render each film to an MP4 with [render.mjs](render.mjs), which needs `ffmpeg` and `playwright-core` (its header says how). Run `node render.mjs <the en or vi folder> <out.mp4> --stills 0,2,4` and look at the stills (a contact sheet of them shows overlaps and clipped text early), then render the full film. Look at a contact sheet of the MP4 before keeping it. (A film made as a Motion artifact has its `modules` saved with ArtifactData `list` and `out_dir`; render.mjs reads that layout too.) Then move the files to `projects/content/assets-src/preview/<force>/<general-id>_<skill-id>_en.mp4` and `<general-id>_<skill-id>_vi.mp4`, for example `wu/zhou-tai_refuting-death_en.mp4`. `<force>` is the General's Kingdom Wars force in lower case (`wei`, `shu`, `wu` or `qun`). `<general-id>` is the General's id in the deck data (`zhou-tai`), and `<skill-id>` is the skill's name in lower-case words joined by hyphens, the key the Vietnamese locale uses (`refuting-death`). Then list the languages in `projects/content/assets-src/preview/index.json` under `<general-id>_<skill-id>` (`"zhou-tai_refuting-death": ["en", "vi"]`), since the Wiki shows a player only for a listed video. Until the files exist, list both as pending for the PR and leave them out of the index. Previews are not crawled, so they get no entry in `assets-src/manifest.json`. Keep the master as rendered (full size): `npm run assets:build` (it needs `ffmpeg`) makes the smaller copy in `assets/preview/` that the app serves, and copies `index.json`. Commit the masters, the generated files and `assets/asset-lock.json` together.
6. **Return** to add-general-skill: the confirmed storyboard goes beneath the table.

## Rationalizations

| Thought | Reality |
|---|---|
| "It is only a video, skip the storyboard" | The film is the rule made visible. A wrong beat reads as an agreed rule. Storyboard first. |
| "The engine's skill name is fine" | Players see the deck's name. Use it and report the difference. |
| "I'll fill in ranks and HP quietly" | Everything invented goes in `made up`. |
| "More elements will make it clearer" | Cut to what the sequence needs. Past films lost their dialog, title and end cards and read better. |
| "Longer so captions can be read" | A beat is about 1.5 s. One skill is 8 s at most, a chain of skills 10 s. Cut beats first. |
| "I'll use the app's purple or yellow" | Four forces only: Wei, Shu, Wu, Qun. |
| "A portrait would help the viewer" | Decided against: films carry no portraits or card art. |
| "The Vietnamese is probably right" | It is draft. Say so and take names from the glossary. |
| "English now, Vietnamese later" | Build both together. A second pass repeats the checking. |
| "The render finished, so it is right" | Look at stills or a contact sheet first. A clipped caption or an overlap renders just as cleanly. |
| "The MP4 goes in `assets-src/manifest.json`" | The manifest records crawled assets only. Add no entry. |
| "One scene per beat, like a real film" | One scene per film. Beats are windows of time inside it. |
