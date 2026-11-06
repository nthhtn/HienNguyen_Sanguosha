# Input sheet

Copy this table into the reply. Origin is `dev`, a source URL with the date fetched, or `empty`.

| Item | Value | Origin |
|---|---|---|
| Deck (Kingdom Wars, Identity) | | |
| Counterpart found (deck and id, or none) | | |
| Deck or decks to change | | |
| English name | | |
| Chinese name | | |
| Vietnamese name (draft) | | |
| Title (English, Chinese) | | |
| Kingdom (Wei, Shu, Wu, Qun) | | |
| Max HP | | |
| Gender | | |
| Skill 1: English name, Chinese name, wording | | |
| Skill 2 (and so on) | | |
| Skin image (the full-size original) | | |
| Death voice (the original recording) | | |

Rules for the sheet:
- A value from a source is shown as that source's text, not paraphrased. Conflicts between sources are listed, not resolved.
- An `empty` Max HP, gender or Kingdom blocks the build until the developer answers.
- A skin or voice is the original file, not a shrunk or re-encoded one: the build makes the small shipped copy, and it needs the original to do that.
- An `empty` skin or voice does not block. The General ships with the placeholder or its Kingdom's cry and the PR lists the gap.

## Edge cases to answer in each skill's rule text

- A hidden or unexposed seat: it has no Kingdom while hidden, and an Ambitionist is a Kingdom of one.
- A range that is "lifted": does the target still need to be in attack range?
- Who is the damage source, and what if there is none?
- Reveal timing: when can the skill be asked, and is it compulsory?
- Once per turn, per Play Phase, per damage, or per game?
- An empty hand, no legal target, or a full equipment slot.
