# Alternate Generals Slice 2: Confirmed Rule Text

Date: 2026-10-22. Part of `2026-10-22-alternate-generals-engine-design.md` (slice 2: the real
rule changes and the new skills on known Generals). Each rule below was confirmed by the
user before implementation. "Default" is what the engine does today; "Alternate" is the new
rule. Status: batch 1 confirmed; later batches are added as they are confirmed.

## Batch 1 (confirmed 2026-10-22)

### Liu Bei, Benevolence (仁德)
Play Phase, any number of times: give any number of hand cards to other players. The heal
threshold is 3 cards given in the turn (Default: 2). It heals 1 HP at most once per turn.

### Sun Quan, Balance of Power (制衡)
Once per turn: discard up to X cards (hand or equipment), then draw the same number. X is the
seat's combined maximum HP (for example 3 or 4), where Default has no limit.

### Xun Yu, Eternal Loyalty (节命)
Per point of damage you take, you may pick any seat. It draws until its hand holds as many cards
as its maximum HP, but never raising the hand above 5 (so it draws until the hand equals
min(max HP, 5)). If its hand is already at or above that, it draws nothing.

### Zhu Rong, Fearsome Blade (烈刃)
After your Slash damages a seat, you may compete with it, and if you win you take one of its
cards. This only applies when the damaged seat is one the Slash was aimed at (a target of the
Slash). Damage from the Slash that reaches another seat, for example through Chains, does not
trigger it.

### Huang Yueying, Assembling Wisdom (集智) and Genius (奇才)
Assembling Wisdom: when you use a non-delayed Tool, you may draw 1 card. It does not draw for a
Tool that was converted from other cards (a Pang Tong Shackle Chains, a Zhuge Liang conversion).
A Wuxie you play still draws. A Chains Recast is not a use. Genius (compulsory): Tools you use
have no distance limit; unchanged.

## Batch 2 (confirmed 2026-10-22)

### Zhou Yu, Sow Dissension (反间) and Heroic Demeanor (英姿)
No rule change from Default for Sow Dissension: the engine already moves the card to the victim
before the damage, and Zhou Yu cannot get it back if the victim dies. Moves to slice 4 (check
only, no code). (Heroic Demeanor's "can" is audited in slice 4 with the other optionality notes.)

### Sun Shangxiang, Marriage (结姻) and Warrior Lady (枭姬)
Marriage: no change (targets only other seats; gender is read from the main General when both
are exposed, or the only exposed one). Moves to slice 4, check only.
Warrior Lady: whenever cards leave her equipment area in one instance (one move of one or more
cards), she may draw 2 cards, asked each time (a "may" skill). Two pieces leaving together draw 2
once, not 2 each. Default is compulsory and draws 2 per card.

### Zhen Ji, Goddess Luo (洛神)
At the start of her turn she may judge. On a black card she may judge again, and may stop after
any black card. A red card ends it and is discarded. Black judgment cards stay on the table (not in
her hand, so nothing can use them) until the process ends; then she acquires all the black cards.
If she dies mid-process, the cards go to the discard pile. (Default puts each black card in her
hand at once.)

### Cai Wenji, Dirge (悲歌) and Sorrow (断肠)
Dirge: unchanged from Default (a Slash damages any seat; she may discard a card; that seat judges:
hearts heal 1, diamonds draw 2, clubs the source discards 2, spades the source "stacks", which is
the engine's existing turn face down / up).
Sorrow (compulsory): when she dies, the killer loses all abilities of one of their two Generals.
Cai Wenji's side (her player) picks which: Main or Deputy. The choice is between Main and Deputy
regardless of whether they are revealed, and does not reveal either. Default silences the whole
seat. Needs per-General silencing in the engine.

### Diao Chan, Seed of Animosity (离间) and Envious Moon (闭月)
Seed of Animosity: discard a card and choose two other male seats; it is as if one used Duel on
the other. This Duel cannot be answered by Wuxie or Wuxie Kingdom (Default allows the usual Wuxie
check). Limited to once per phase; gender is read as for Marriage.
Envious Moon: at her End Phase she may draw 1 card, asked whether to draw (Default is compulsory).
