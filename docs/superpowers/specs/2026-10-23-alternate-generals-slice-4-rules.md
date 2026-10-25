# Alternate Generals Slice 4: Confirmed Rule Text and Audit

Date: 2026-10-23. Part of `2026-10-22-alternate-generals-engine-design.md` (slice 4: wording-only
differences). Four rulings were confirmed by the user on 2026-10-23; the rest of the audit is my
classification (a note is a real change if the Alternate text could give a different outcome from the
Default implementation; a doubtful one goes to the user).

## Confirmed by the user

- **Omitted limits stay.** The Alternate text of Resurrection (Pang Tong), Descend into Chaos (Jia Xu)
  and Rouse the Tiger (Xun Yu) does not repeat the limit; Default's stays: Resurrection and Descend
  into Chaos once per game, Rouse the Tiger once per Play Phase.
- **Descend into Chaos (Jia Xu), Alternate only (corrected 2026-10-23).** Each other living seat, in
  turn order, must play a Sha at the seat nearest to it, or lose 1 HP. "Nearest" is the least distance;
  seats tied for it are all legal. The pick is always a popup, even with a single legal target (it also
  carries the Pass option, which loses 1 HP). Default keeps "any seat in attack range", unchanged.
- **Lightning Strike (Zhang Jiao), Alternate only.** After you play or use a Shan, you may pick
  another living seat (never yourself) to judge; a spade deals it 2 thunder damage with no source.
  Default keeps "any living seat, yourself included".
- **Resurrection (Pang Tong), Alternate only.** As Default's Nirvana (once per game, when you would
  enter the dying round: discard every card in hand, equipment and judgment area, draw 3, recover to
  3 HP at most your max HP, turn face up), and also clear the Chained state. Default does not clear it.

## My calls (flag if wrong)

- Nearest seat for Alternate Descend into Chaos ignores attack range, but skips seats a Sha cannot target.
- Jia Xu himself may be a nearest seat, so he is a legal target of his own Descend into Chaos (confirmed 2026-10-25).
- Fearsome Archer (Huang Zhong): Alternate says "in your action phase", Default checks "in your turn".
  The only Sha you target outside the Play Phase on your turn is Godspeed's (Xiahou Yuan, as the turn
  starts). I read it as wording, as the note says; no variant.
- Flexibility (Zhang He): Alternate does not say whether a moved equipment may replace an occupied
  slot. Default says it may not; kept.
- Devolution (Liu Shan): Alternate does not say whose turn follows the extra turn. Default's (the seat
  after Liu Shan) is kept.

## Audit result (32 skills not yet registered)

Cleared as the Default skill, no code change: Star Gazing (观星), Warrior Saint (武圣), Fearsome Archer
(烈弓), Relish (享乐), Devolution (放权), Horsemanship and Iron Calvary (马术, 铁骑, Ma Chao), Shackle
(连环), Giant Elephant (巨象), Villainous Hero (奸雄), Scavenge (行殇), Banish (放逐), Entrenched (据守),
Envy of Heaven (天妒), Retaliation (反馈), Demonic Talent (鬼才), Rouse the Tiger (驱虎), Flexibility
(巧变), Sudden Strike (突击, Default's Raid 突袭 under another Chinese name), Stunning Beauty (倾国),
Marriage (结姻), Heavenly Scent (天香), Rosy Cheeks (红颜), Heroic Demeanor (英姿), Sow Dissension
(反间), Barrage (乱击), Dark Sorcery (鬼道), Without Equal (无双), Unmitigated Murder (完杀).
Variants: Descend into Chaos (乱武), Lightning Strike (雷击), Resurrection (涅槃).
The 22 "Nil" Generals were registered in slice 1; slice 4 only adds a guard test for them.
