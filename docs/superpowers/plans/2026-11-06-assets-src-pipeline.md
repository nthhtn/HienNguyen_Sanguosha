# Asset Masters and Build Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep originals in `projects/content/assets-src/`, make `projects/content/assets/` a committed build output made by `npm run assets:build`, and fail `npm run assets:check` when it is out of date.

**Architecture:** A small Python package, `scripts/assetlib/`, plans the outputs from recipes (stdlib only), then either checks them against `assets/asset-lock.json` (hashes only) or builds them (copy, crop, sprite sheets; Pillow imported only inside the ops). The build is incremental by input hash. References in data and code drop the file extension, and `assets.ts` adds it from the recipes.

**Tech Stack:** Python 3 (local machine runs 3.9, so no `X | Y` unions or `match`), Pillow for crop and sheets only, `unittest`; TypeScript in `projects/content`; jest; npm scripts.

**Spec:** `docs/superpowers/specs/2026-11-06-assets-src-pipeline-design.md` (read it first; this plan only records the decisions it leaves open).

## Global Constraints

- Masters live in `projects/content/assets-src/`; recipes in `projects/content/asset-recipes.json`; crop boxes in `projects/content/asset-crops.json`; the lock is `projects/content/assets/asset-lock.json`.
- Commands: `npm run assets:build`, `npm run assets:check`; the check runs inside `npm run verify`.
- `assets:check` uses only Python's standard library, only compares hashes against the lock, and never re-runs the build.
- Recipes are keyed by a folder (or file) path and name the shipped extension explicitly (`"ext"`); a path uses the entry with the longest matching key.
- The build is incremental by input hash and idempotent: running it twice leaves no diff. It removes files in `assets/` that no recipe produces.
- This stage does no resizing or re-encoding. Every recipe except crop and sprite sheets is "copy" (byte for byte).
- Done when: every path under `assets/` matches today's; every file hashes the same as today's except the 49 regenerated crops, each within 5 brightness levels (mean absolute difference) of the current file and identical side by side; URLs the app requests do not change.
- `assets.ts` imports `asset-recipes.json` at build time. `angular.json` loses the `"ignore": ["effects/frames/**"]` rule. `.dockerignore` gains `projects/content/assets-src`.
- Names are kebab-case. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push or merge.

## Review Focus

1. A `.DS_Store` (or any junk file) in `assets-src/` or `assets/` must never be copied, locked, or reported as stray. Pinned in Tasks 1 and 2.
2. A master with no matching recipe must fail the build and the check by name, never be skipped silently. Pinned in Task 1.
3. A crop box outside its full image, with non-positive size, or a full card with no box (or a box with no full card) must fail by naming the card, never ship nothing. Pinned in Tasks 1 and 4.
4. Two masters in one folder with the same stem and different extensions make an extension-less reference ambiguous, so the build fails naming both. Pinned in Task 1.
5. The lock must be deterministic and merge-friendly (sorted keys, forward slashes, trailing newline, no timestamps), and the CLI must work from any working directory. Pinned in Task 2.

---

## File Structure

| Path | Responsibility |
|---|---|
| `scripts/build-assets.py` | CLI: `build` and `check`; exits 1 with messages |
| `scripts/assetlib/layout.py` | `Layout` (paths) and `default_layout()` |
| `scripts/assetlib/recipes.py` | load recipes, longest-key lookup, canonical hashing |
| `scripts/assetlib/lockfile.py` | `sha256_file`, read and write the lock |
| `scripts/assetlib/plan.py` | outputs each recipe produces, and their input hashes (stdlib only) |
| `scripts/assetlib/check.py` | compare the plan with the lock (stdlib only) |
| `scripts/assetlib/ops.py`, `sheets.py` | copy, crop, sprite sheets (Pillow imported lazily) |
| `scripts/assetlib/build.py` | incremental build, stray removal, lock write |
| `scripts/assetlib/test_*.py` | `unittest` tests, run by `npm run test:assets` |

### Task 1: Planning, lock and check (stdlib only)

**Files:**
- Create: `scripts/assetlib/__init__.py`, `layout.py`, `recipes.py`, `lockfile.py`, `plan.py`, `check.py`
- Test: `scripts/assetlib/test_plan_check.py`

**Interfaces:**
- Produces:
  - `Layout(content: Path)` with properties `src`, `out`, `recipes_file`, `crops_file`, `lock_file`; `default_layout() -> Layout` (repo root found from the file's own location); `IGNORED_NAMES = {".DS_Store"}`.
  - `load_recipes(path) -> Dict[str, dict]`; `recipe_for(recipes, rel_path: str) -> Tuple[str, dict]` (raises `NoRecipe(rel_path)`); `canonical_hash(obj) -> str`.
  - `sha256_file(path) -> str`; `read_lock(path) -> Dict[str, dict]` (empty if missing); `write_lock(path, entries) -> None`.
  - `Output(path, op, sources, recipe_key, settings)` (frozen dataclass; `path` relative to `assets/`, `sources` relative to `assets-src/`); `plan_outputs(layout) -> List[Output]` raising `PlanError`; `inputs_of(layout, output) -> dict` giving `{"sources": {path: sha}, "settings": sha}`.
  - `check(layout) -> List[str]`: one message per problem.
- Ops understood by the planner: `copy`, `master-only` (a master that never ships), `crop` (recipe fields `from`, `ext`, `quality`; outputs come from the keys of `asset-crops.json`, `"<type>/<id>": [x, y, w, h]`), `sheets` (recipe fields `from`, `map` of effect id to frames folder; emits one `sheet` output per id and one `sheets-meta` output for `effects/sheets/sheets.json`).

- [ ] **Step 1: Write the failing tests** in `test_plan_check.py` using a temp `Layout` built by a helper `make_layout(files: Dict[str, bytes], recipes: dict, crops: Optional[dict] = None)`:
  - `test_copy_recipe_plans_one_output_per_master`: masters `ui/a.png`, `ui/b.png` with recipe `"ui": {"op": "copy"}` give outputs `ui/a.png`, `ui/b.png` with `op == "copy"` and `sources == ("ui/a.png",)`.
  - `test_longest_key_wins`: keys `"generals/skins"` (`ext` png) and `"generals/skins/skins.json"` (no ext); the json file uses the second.
  - `test_junk_files_are_ignored`: a `.DS_Store` in `assets-src/ui/` yields no output.
  - `test_master_without_recipe_fails`: raises `PlanError` whose message contains the file's path.
  - `test_ambiguous_stem_fails`: `generals/skins/wei/x.png` and `x.jpg` raise `PlanError` naming both.
  - `test_copy_ext_must_match_master`: recipe `ext` `"webp"` over a `.png` master raises `PlanError` (this stage only copies).
  - `test_crop_outputs_follow_the_box_file`: crops `{"tool/duel": [1, 2, 3, 4]}`, full art `playing-cards/full/tool/duel.jpg`, recipe `"playing-cards/cropped": {"op": "crop", "from": "playing-cards/full", "ext": "jpg"}` gives output `playing-cards/cropped/tool/duel.jpg` with `settings["box"] == [1, 2, 3, 4]`.
  - `test_crop_box_without_full_art_fails` and `test_full_art_without_box_fails`: each raises `PlanError` naming the card.
  - Check tests, each starting from a built-by-hand consistent lock written with `write_lock`: `test_clean_tree_passes` (empty list); `test_edited_master_is_stale` (message contains the master path and `"stale"`); `test_changed_recipe_is_stale` (contains the recipe key); `test_hand_edited_output_is_reported` (contains the output path and `"edited"`); `test_missing_output_is_reported` (`"missing"`); `test_stray_file_is_reported` (`"stray"`); `test_junk_in_out_is_not_stray`.
  - `test_check_imports_no_pillow`: run `python3 -c "import assetlib.check, sys; sys.exit('PIL' in sys.modules)"` with `scripts` as the working directory.

- [ ] **Step 2: Run** `python3 -m unittest discover -s scripts/assetlib -t scripts -p "test_*.py"`. Expected: errors (modules missing).

- [ ] **Step 3: Implement** the modules above. Lock entry shape: `{"sources": {path: sha}, "settings": sha, "output": sha}` keyed by output path; `settings` is `canonical_hash({"op", "recipe": entry, "extra": {...}})` with the per-output extras (the box, the sheet id and folder). `write_lock` sorts keys, indents by 2, ends with `"\n"`, and uses `/` in paths. `PlanError` messages name the offending path. `check` ignores `asset-lock.json` and `IGNORED_NAMES`.

- [ ] **Step 4: Run** the same command. Expected: all pass.

- [ ] **Step 5: Commit** `feat(assets): plan outputs from recipes and check them against a lock`.

### Task 2: Incremental copy build and CLI

**Files:**
- Create: `scripts/assetlib/build.py`, `ops.py` (copy only for now), `scripts/build-assets.py`
- Modify: `package.json` (scripts)
- Test: `scripts/assetlib/test_build.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: `build(layout) -> BuildReport` (`built`, `skipped`, `removed` counts); `ops.run(layout, output) -> None` dispatching on `output.op`; CLI `python3 scripts/build-assets.py [--content <dir>] build|check` (`--content` overrides the content folder, default `projects/content`, and exists so tests can point the CLI at a temp folder); npm scripts `assets:build`, `assets:check`, `test:assets` (`python3 -m unittest discover -s scripts/assetlib -t scripts -p "test_*.py"`).

- [ ] **Step 1: Write the failing tests** (reusing `make_layout`):
  - `test_build_copies_bytes_and_writes_a_lock_that_passes_check`.
  - `test_second_build_changes_nothing`: after two builds the lock file bytes and every output's mtime are unchanged and `BuildReport.built == 0`.
  - `test_build_rewrites_only_what_changed`: editing one master gives `built == 1`.
  - `test_build_removes_stray_outputs_but_keeps_junk_policy`: a stray file in `assets/` is deleted; `.DS_Store` is neither copied nor reported.
  - `test_hand_edited_output_is_restored_on_build`.
  - `test_lock_is_deterministic`: the lock text has sorted keys, ends with a newline, and contains no `\\`.
  - `test_cli_runs_from_another_directory`: with `cwd=tempfile.gettempdir()` and `--content <tmp layout>`, `build` then `check` exit 0; after editing a master, `check` exits 1 with output naming the file and containing `npm run assets:build`.

- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** `build`: for each planned output, skip when the lock entry's `sources` and `settings` equal `inputs_of(...)` and the output exists with the locked hash; otherwise call `ops.run`; write the full lock; delete stray files and empty directories under `assets/`. `ops.run` copies with `shutil.copyfile`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat(assets): incremental build and assets:build, assets:check commands`.

### Task 3: Sprite sheets op

**Files:**
- Modify: `scripts/assetlib/ops.py`; Create: `scripts/assetlib/sheets.py`
- Test: `scripts/assetlib/test_sheets.py`

**Interfaces:**
- Consumes: `Output` with `op` `sheet` (`settings` `{"id", "folder"}`) and `sheets-meta`; Pillow.
- Produces: `sheets.build_sheet(frames_dir: Path, out_png: Path) -> dict` returning the metadata the old script computed; `ops.run` handles `sheet` and `sheets-meta`.

- [ ] **Step 1: Write the failing tests** with generated 4×4 RGBA frames: `test_sheet_grid_holds_every_frame` (7 frames give `cols == 6`, `rows == 2`, image size `(24, 8)`); `test_pop_detected_when_a_small_first_frame_grows` (`pop is True`, `lead` equals the first large frame); `test_mismatched_frame_sizes_fail`; and `test_repo_sheets_match_committed_files`: building the real frames of the repo (skipped if `assets-src/effects/frames` does not exist yet) reproduces each file in `assets/effects/sheets/` byte for byte.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Move** the logic of `scripts/build-sprite-sheets.py` (`opaque_area`, `build`, and the `sheets.json` writing, with the same JSON formatting) into `sheets.py` unchanged, taking the effect-id-to-folder map from the recipe. Do not delete the old script yet.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(assets): build sprite sheets from the pipeline`.

### Task 4: Crop op and crop boxes

**Files:**
- Modify: `scripts/assetlib/ops.py`; Create: `projects/content/asset-crops.json`
- Test: `scripts/assetlib/test_crop.py`, `scripts/assetlib/test_crop_data.py`

**Interfaces:**
- Consumes: `Output` with `op == "crop"`, `sources` `("playing-cards/full/<type>/<id>.jpg",)`, `settings["box"] == [x, y, w, h]`, recipe `quality` (default 92).
- Produces: `ops.crop_file(src: Path, dest: Path, box: List[int], quality: int) -> None`; `asset-crops.json` with 49 entries keyed `"<type>/<id>"` (for example `"tool/duel"`, `"equipment/weapon/axe"`).

- [ ] **Step 1: Write the failing tests.** `test_crop_cuts_the_box`: a 10×10 image with a marked square cropped by `[2, 3, 4, 5]` has size `(4, 5)` and the marked pixels where expected. `test_box_outside_the_image_fails` and `test_non_positive_size_fails`, each raising an error that contains the card's path. `test_crop_data_covers_every_full_card` (reads the real repo): `asset-crops.json` has exactly one key per file under `assets-src/playing-cards/full/` (skipped until Task 5 moves them; then it must run), and each box fits inside that image and has `w, h > 0`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** `crop_file` with `Image.crop` and `save(..., "JPEG", quality=quality)`; validate the box against the image size first.
- [ ] **Step 4: Recover the boxes (one-off, not committed).** In `tmp/` write a throwaway script that, for each `assets/playing-cards/cropped/**.jpg` and its full card in `assets/playing-cards/full/`, finds where the crop sits in the full image: grayscale, search at 1/4 scale for the lowest mean squared error, then refine at full scale within ±5 px. The crops are straight cuts at the same scale, so every card must match with mean squared error of at most 40 (the developer's earlier run: median 3, maximum 25). Stop and report if any card does not. Write `projects/content/asset-crops.json` (sorted keys, `[x, y, w, h]`, trailing newline).
- [ ] **Step 5: Run** the tests. Expected: PASS (the data test may still skip).
- [ ] **Step 6: Commit** `feat(assets): crop op and recorded crop boxes for the 49 playing cards`.

### Task 5: Move the masters and prove nothing changed

**Files:**
- Create: `projects/content/asset-recipes.json`, `projects/content/assets-src/` (by `git mv`), `projects/content/assets/asset-lock.json`
- Modify: `angular.json`; Delete: `scripts/build-sprite-sheets.py`

**Interfaces:**
- Consumes: Tasks 1 to 4. Produces: the repository in its final layout, with a lock that passes the check.

- [ ] **Step 1: Capture the baseline.** `mkdir -p tmp` and write the sha256 of every file under `projects/content/assets` (excluding `.DS_Store`) to `tmp/assets-before.sha256`, and copy `projects/content/assets/playing-cards/cropped` to `tmp/old-cropped`.
- [ ] **Step 2: Write `asset-recipes.json`** with exactly these entries: `README.md` copy; `manifest.json` copy; `audio` copy; `audio/death/generals` copy `ext` ogg; `effects/frames` master-only; `effects/sheets` sheets (`from` `effects/frames`, `map` `{"slash": "slash-red", "slash-fire": "fire-slash", "slash-lightning": "thunder-slash", "damage": "damage", "fire": "fire", "lightning": "lightning", "chain": "chain"}`); `effects/stills` copy; `generals/cards` copy `ext` jpg; `generals/skins` copy `ext` png; `generals/skins/skins.json` copy; `generals/special` copy; `playing-cards` copy; `playing-cards/cropped` crop (`from` `playing-cards/full`, `ext` jpg, `quality` 92); `playing-cards/full` copy `ext` jpg; `preview` master-only; `ui` copy.
- [ ] **Step 3: `git mv`** into `assets-src/`, keeping the same relative paths: `generals`, `playing-cards/full`, `playing-cards/back.jpg`, `effects/stills`, `effects/frames`, `ui`, `audio`, `manifest.json`, `README.md`. Do not move `playing-cards/cropped` or `effects/sheets`.
- [ ] **Step 4: Run** `npm run assets:build`, then `npm run assets:check`. Expected: the check prints nothing and exits 0.
- [ ] **Step 5: Prove equality.** Hash `assets/` again and compare with `tmp/assets-before.sha256`: the path lists must be identical; every hash must match except the 49 files under `playing-cards/cropped/`. For those, the mean absolute difference per card against `tmp/old-cropped` (RGB, levels 0 to 255) must be at most 5, and the two worst cards must look identical side by side with an amplified difference image (the old crops are separately encoded JPEGs, so a strict SSIM bar cannot be met even by a lossless cut). Record the largest difference in the commit message.
- [ ] **Step 6: Run** `npm run assets:build` again. Expected: `built` 0 and `git status` shows no new change.
- [ ] **Step 7: Delete** `scripts/build-sprite-sheets.py`, remove the `"ignore": ["effects/frames/**"]` line from `angular.json`, and run `npm run build:app`; the shipped `dist/app/browser/images` must have the same file set as before (compare against `tmp/assets-before.sha256` paths for images).
- [ ] **Step 8: Commit** `refactor(assets): masters in assets-src, assets generated by the build` (two commits are fine: the move, then the generated files and lock).

### Task 6: Wire the check into verify, CI and Docker

**Files:**
- Modify: `package.json`, `.github/workflows/ci.yml`, `.dockerignore`, `docs/ci-and-guardrails.md`

- [ ] **Step 1:** Put `npm run assets:check &&` first in the `verify` script (it takes seconds). In the `test` job of `ci.yml`, add a step `pip install pillow` and `npm run test:assets` before `npm run test:coverage`.
- [ ] **Step 2:** Add `projects/content/assets-src` to `.dockerignore`. If Docker is available, run `docker build -t sanguosha-assets-check .` then `docker run --rm sanguosha-assets-check ls projects/content`; expected: no `assets-src`. If Docker is not available, say so in the report.
- [ ] **Step 3: Verify** by running `npm run verify` (passes), then deliberately editing one master, running `npm run assets:check` (fails naming the file), and restoring it.
- [ ] **Step 4:** Describe the new check and the `test:assets` command in `docs/ci-and-guardrails.md`. Commit `ci(assets): run assets:check in verify and the pipeline tests in CI`.

### Task 7: Extension-less references

**Files:**
- Modify: `projects/content/src/lib/assets.ts`, `projects/content/assets-src/manifest.json`, `projects/content/assets-src/generals/skins/skins.json`, `projects/content/src/lib/assets.spec.ts`
- Rebuild: `projects/content/assets/` (copies of the two JSON files, and the lock)

**Interfaces:**
- Produces: `assetFile(path: string): string` (exported from `assets.ts`) returning `path` plus `.` plus the `ext` of the recipe with the longest key that is a prefix of `path`, or `path` unchanged when that recipe has no `ext`.

- [ ] **Step 1: Write the failing tests** in `assets.spec.ts`: `assetFile('generals/skins/wei/caocao')` is `'generals/skins/wei/caocao.png'`; `assetFile('playing-cards/full/tool/duel')` is `'playing-cards/full/tool/duel.jpg'`; `assetFile('audio/death/generals/wei/caocao')` ends in `.ogg`; `assetFile('ui/brand/logo.png')` is unchanged. Keep every existing URL test unchanged (they must keep passing). Update the new "shipped files" tests to build file paths with `assetFile`.
- [ ] **Step 2: Run** `npx jest --selectProjects content`. Expected: the new tests fail.
- [ ] **Step 3: Implement.** Import `../../asset-recipes.json` in `assets.ts`; add `assetFile`; use it in `cardArtUrl`, `croppedCardArtUrl` (swap `playing-cards/full/` for `playing-cards/cropped/` before adding the extension), `generalSkinUrl` and `generalDeathVoiceUrl`. In a throwaway `tmp/` script, strip the extension from every `localPath` in `assets-src/manifest.json` and every value in `skins.json`, preserving formatting. Run `npm run assets:build`.
- [ ] **Step 4: Run** `npx jest` (all projects) and `npm run assets:check`. Expected: all pass, and `git diff` of `assets/manifest.json` shows only removed extensions.
- [ ] **Step 5: Commit** `refactor(content): references drop the file extension, assets.ts adds it from the recipes`.

### Task 8: Skills, README and docs

**Files:**
- Modify: `.claude/skills/add-general/SKILL.md`, `.claude/skills/add-general/input-sheet.md`, `.claude/skills/add-general-skill-preview/SKILL.md`, `projects/content/assets-src/README.md`, `docs/architecture/content-and-extensibility.md`, `docs/superpowers/specs/2026-11-06-assets-restructure-design.md` (add one line pointing at this spec)

- [ ] **Step 1:** In `add-general`, step 6: the skin master goes to `assets-src/generals/skins/<force>/<pinyin>.png` and the death voice to `assets-src/audio/death/generals/<force>/<pinyin>.ogg`; the skin entry in `assets-src/generals/skins/skins.json` and the record in `assets-src/manifest.json` carry no extension; then run `npm run assets:build` and commit masters, generated files and lock together. In `input-sheet.md`, the "Skin image" row asks for the full-size original, not a shrunk file.
- [ ] **Step 2:** In `add-general-skill-preview`, preview videos go to `projects/content/assets-src/preview/<general-id>_<skill-id>_<lang>.mp4`; update the rule that mentions the manifest to name `assets-src/manifest.json`.
- [ ] **Step 3:** Rewrite the README's layout section for `assets-src/` and `assets/` (assets is generated, edit masters), add the "add a playing card" and "replace a master" flows from the spec, and update the architecture doc paragraph.
- [ ] **Step 4: Dry run.** Following the new `add-general` steps, add a temporary skin and death voice master for a made-up id (copy an existing PNG and OGG), build, run `npm run assets:check` (passes), then `git restore` and `git clean` the temporary files and rebuild so the tree is clean.
- [ ] **Step 5: Commit** `docs(assets): describe masters, the build and the new add-general steps`.

### Task 9: Whole-branch verification

- [ ] **Step 1:** `npm run verify` and `npm test` pass; `npm run test:assets` passes.
- [ ] **Step 2:** `npm run assets:build` leaves `git status` clean; `npm run assets:check` exits 0.
- [ ] **Step 3:** Demonstrate each failure on the real repo, restoring after each: edit a master; hand-edit a file in `assets/`; delete a file in `assets/`; add a stray file to `assets/`. Each makes `npm run assets:check` exit 1 with a message naming the file.
- [ ] **Step 4:** Run the real server against a fresh `dist` and request one URL per group (skin, cropped card, full card, sheet, still, banner, hp, chain, music, effect, force death cry, General death cry, voice line); each returns 200. Confirm `/images/effects/frames/…` returns 404.
- [ ] **Step 5:** Report what was verified and what could not be (Docker, if unavailable).
