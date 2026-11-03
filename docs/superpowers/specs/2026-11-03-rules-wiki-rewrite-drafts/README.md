# Rules Wiki drafts (reference only)

Throwaway HTML drafts that the user reviewed. They hold the intended page
content, the worked examples, the scene layouts and the Vietnamese wording.
They are not product code.

- `draft-en.html` and `draft-vi.html` are self-contained pages with the images
  left out (the `IMG` map in the script is empty, so `<img data-k="…">` tags
  show nothing). The `data-k` value names the real art: a card id (`sha`,
  `wuxie`, …), a General id (`cao-cao`, `zhang-jiao`, …), a Force banner
  (`wei`, `shu`, `wu`, `qun`), `hp` (HP icon), `chain`, `fire`, `dmg`, `back`
  (card back) or `hidden` (face-down General). The product resolves these
  through the content project's asset helpers.
- Open either file in a browser to see the layout. Navigation is by the URL hash
  (`#setup`, `#turn`, …).
- The Vietnamese text is a draft and follows the terminology in
  `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`.
- Where the drafts and the engine disagree, the engine wins and the draft is wrong.
