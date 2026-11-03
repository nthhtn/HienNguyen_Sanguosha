# Bot names

## Intent

Bots are named by position today: offline "Seat N" (`projects/content/src/lib/modes/guozhan.ts`), online "Bot N" (`projects/server/src/rooms/room.ts`, `roomService.ts`). A table of "Bot 1, Bot 2, Bot 3" feels lifeless. Give each bot a name of a Three Kingdoms-era figure so a game reads like a table of characters. A bot's name is always shown with a "Bot: " prefix ("Bot: Zhou Cang", "Bot: Chu Thương") so it can never be mistaken for a person.

## Goals

- Every bot, offline and online, gets a figure's name drawn at random from a fixed pool, with no repeat within one game or room.
- The name is shown in the viewer's language: English, or Hán-Việt in Vietnamese. Two players in one online room can read the same bot in different languages.
- Names live in content data files, like Generals and cards, not in code.

## Non-goals

- A name never implies a force. "Zhou Cang" does not make a bot Shu. The pool is flat, has no force field, and nothing in the UI colours, groups or reasons by it. A bot's force comes only from the Generals it is dealt.
- No bot personalities, avatars or per-name behaviour.
- Past saved games keep their "Bot N" and "Seat N" names. Do not migrate or rename them.
- Human players are untouched.

## Anti-goals

- A bot name that is also a General in any deck (Kingdom Wars or Identity). The pool below was checked against both rosters; keep it that way if the pool or the decks change (a test should assert it).
- Showing a raw id ("zhou-cang"). Ids are never shown.

## The pool (32, confirmed by the user)

Grouped by force only so the list is readable. Store it flat.

| English | Vietnamese (draft) |
|---|---|
| Mi Zhu | Mi Trúc |
| Ma Liang | Mã Lương |
| Guan Ping | Quan Bình |
| Zhou Cang | Chu Thương |
| Xu Shu | Từ Thứ |
| Yan Yan | Nghiêm Nhan |
| Deng Zhi | Đặng Chi |
| Jian Yong | Giản Ung |
| Cheng Yu | Trình Dục |
| Cao Zhang | Tào Chương |
| Cao Zhi | Tào Thực |
| Cao Xiu | Tào Hưu |
| Wen Pin | Văn Sính |
| Man Chong | Mãn Sủng |
| Chen Qun | Trần Quần |
| Han Hao | Hàn Hạo |
| Zhu Ran | Chu Nhiên |
| Zhu Huan | Chu Hoàn |
| Lu Fan | Lã Phạm |
| Lu Kang | Lục Kháng |
| Zhuge Jin | Gia Cát Cẩn |
| Yu Fan | Ngu Phiên |
| Bu Zhi | Bộ Chất |
| Zhuge Ke | Gia Cát Khác |
| Liu Biao | Lưu Biểu |
| Gongsun Zan | Công Tôn Toản |
| Tao Qian | Đào Khiêm |
| Zhang Xiu | Trương Tú |
| Zhang Bao | Trương Bảo |
| Liu Zhang | Lưu Chương |
| Han Sui | Hàn Toại |
| Zhang Lu | Trương Lỗ |

The Vietnamese names start as drafts for a native speaker to review (`npm run i18n:status`), per the project's localization rules. Names are proper nouns: capitalised word by word in both languages.

## How it works (decided with the user)

- **Content file.** The pool is a data file in `projects/content/data/` with English and Vietnamese names, following how General and card names and their Vietnamese locale files are stored. Ids are kebab-case (`zhou-cang`).
- **Draw.** Each game or room picks distinct ids at random. Offline: when the game is set up. Online: when a bot is added to a room, avoiding ids already used by that room's other bots.
- **Server hands out an id.** Online, a bot's stored and transmitted name must let the client resolve it per viewer, so two clients can show it in different languages. Persistence, the shared `protocol` project and the game's player list carry the id (or an equivalent reference); each client translates it.
- **Prefix.** Every bot name is shown as `Bot: ` plus the figure's name, in both languages (the prefix is not translated). The pool files and the id hold the plain name and id; the prefix is added at display time and in the stored fallback `name`.
- **Display.** `seatName` (`projects/app/src/app/labels.ts`) and `playerLabel` (`projects/app/src/app/online/game-labels.ts`) resolve a bot's name id into the viewer's language and add the prefix. The old "(Bot)" / "(máy)" tag is no longer added to bots that have a name id.
- **Old data.** A bot name that is not a pool id (an old "Bot 1" or "Seat N") displays as stored, as today.

## Human names and bots (decided with the user)

The `Bot: ` prefix keeps a bot's stored `name` ("Bot: Zhou Cang") from ever equalling a person's name, so `Room.nameTaken` and the database's `room_players_current_name` index stay as they are. A person's display name may not start with `Bot:` (case-insensitive, any spacing after the colon), enforced in `normalizeDisplayName`, so nobody can pose as a bot. A person may use the plain figure's name ("Zhou Cang", "Chu Thương").

## Calls made by the author (not yet checked with the user; change freely)

- **Dedicated field.** A bot's name reference is a dedicated optional field (for example `botNameId`, the plain id with no prefix) next to `name`, not an id packed into `name`. `name` is the English fallback with the prefix, `Bot: Zhou Cang`, derived from the id when the bot is drawn. Resolution happens only when the player's `kind` is `'bot'` and the field is set, so a human named "zhou-cang" is never mistaken for a bot. A protocol, database (with a migration) and engine `Player` type change is acceptable. `name` keeps a readable English fallback for old clients and old data.
- **Offline draw.** The draw happens in the setup code once the human seats are known, not inside the game's RNG, and uses its own seeded stream. Existing seeds, simulations and replays must stay byte-identical.
- **Vietnamese drafts.** A pool name with no Vietnamese entry falls back to English. Draft status is reported by `npm run i18n:status` as it is for other drafts; it is a warning, not a failure.
- **Surfaces.** Every place that reads a player's `name` directly (lobby member list, room members mapping, `lastGame.seats`, results screens, My Games) must resolve it per viewer. If any of them turns out to be server-rendered text instead of data, flag it in the plan with a client-side resolution path.

## Left to the builder

- The exact name of the field and how it stays backwards compatible with old saved games and replays.
- Where the draw lives so offline, server and tests share one function.
- What happens if a room has more bots than pool names (the pool is larger than any seat count, so this is only a safety net).
- Whether the lobby, Action History, results screens and tests need updating beyond `seatName` and `playerLabel`.

## Constraints

- Engine stays framework-free and serializable; no Angular or browser dependency in the draw.
- UI text rules in `CLAUDE.md` apply. A new data file must not become a central conditional.
- Work on a branch; the agent never merges or pushes to `main`. `npm run verify` and the tests must pass.
