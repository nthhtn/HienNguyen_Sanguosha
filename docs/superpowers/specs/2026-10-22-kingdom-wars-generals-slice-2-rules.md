# Kingdom Wars Generals Slice 2: Confirmed Rule Text

Date: 2026-10-22. Part of `2026-10-22-kingdom-wars-generals-engine-design.md` (slice 2: the real
rule changes and the new skills on known Generals). Each rule below was confirmed by the
user before implementation. "Dynasty Wars" is what the engine does today; "Kingdom Wars" is the new
rule. Status: batch 1 confirmed; later batches are added as they are confirmed.

## Batch 1 (confirmed 2026-10-22)

### Liu Bei, Benevolence (仁德)
Play Phase, any number of times: give any number of hand cards to other players. The heal
threshold is 3 cards given in the turn (Dynasty Wars: 2). It heals 1 HP at most once per turn.

### Sun Quan, Balance of Power (制衡)
Once per turn: discard up to X cards (hand or equipment), then draw the same number. X is the
seat's combined maximum HP (for example 3 or 4), where Dynasty Wars has no limit.

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
No rule change from Dynasty Wars for Sow Dissension: the engine already moves the card to the victim
before the damage, and Zhou Yu cannot get it back if the victim dies. Moves to slice 4 (check
only, no code). (Heroic Demeanor's "can" is audited in slice 4 with the other optionality notes.)

### Sun Shangxiang, Marriage (结姻) and Warrior Lady (枭姬)
Marriage: no change (targets only other seats; gender is read from the main General when both
are exposed, or the only exposed one). Moves to slice 4, check only.
Warrior Lady: whenever cards leave her equipment area in one instance (one move of one or more
cards), she may draw 2 cards, asked each time (a "may" skill). Two pieces leaving together draw 2
once, not 2 each. Dynasty Wars is compulsory and draws 2 per card.

### Zhen Ji, Goddess Luo (洛神)
At the start of her turn she may judge. On a black card she may judge again, and may stop after
any black card. A red card ends it and is discarded. Black judgment cards stay on the table (not in
her hand, so nothing can use them) until the process ends; then she acquires all the black cards.
If she dies mid-process, the cards go to the discard pile. (Dynasty Wars puts each black card in her
hand at once.)

### Cai Wenji, Dirge (悲歌) and Sorrow (断肠)
Dirge: unchanged from Dynasty Wars (a Slash damages any seat; she may discard a card; that seat judges:
hearts heal 1, diamonds draw 2, clubs the source discards 2, spades the source "stacks", which is
the engine's existing turn face down / up).
Sorrow (compulsory): when she dies, the killer loses all abilities of one of their two Generals.
Cai Wenji's side (her player) picks which: Main or Deputy. The choice is between Main and Deputy
regardless of whether they are revealed, and does not reveal either. Dynasty Wars silences the whole
seat. Needs per-General silencing in the engine.

### Diao Chan, Seed of Animosity (离间) and Envious Moon (闭月)
Seed of Animosity: discard a card and choose two other male seats; it is as if one used Duel on
the other. This Duel cannot be answered by Wuxie or Wuxie Kingdom (Dynasty Wars allows the usual Wuxie
check). Limited to once per phase; gender is read as for Marriage.
Envious Moon: at her End Phase she may draw 1 card, asked whether to draw (Dynasty Wars is compulsory).

## Batch 3 (confirmed 2026-10-22)

### Lu Xun, Scrutinize (度勢), replacing Linked Camps
Play Phase: he may use a red hand card as Amass (a conversion, no per-turn limit). All Amass
rules apply unchanged (Kingdom members, draw 2 then discard 2 each, a Wuxie per target).

### Zhang Zhao and Zhang Hong, Stabilization (固政), replacing Stubborn
At the end of another seat's Discard Phase, they may give one of the cards that seat discarded
that phase back to it from the discard pile; if they do, they acquire all the other cards it
discarded that phase. It works with exactly 1 discarded card (they give it back and acquire
nothing). Dynasty Wars needs 2 or more.

### Guo Jia, Bequeathed Strategy (遗计)
After each point of damage he suffers he may look at the top 2 cards of the draw pile (he does not
draw them), give one to a player, then give the remaining one to a player. Each recipient may be
any player, including Guo Jia himself and the same player twice. Only he sees the cards.

### Zhang Liao, Sudden Strike (突击)
Same as Raid (take one hand card at random from each of one to two other seats in place of
drawing). Moves to slice 4, check only.

### Zhuge Liang's Empty City (空城), Lu Xun's Humility (谦逊), Jia Xu's Behind the Curtain (帷幕)
Today these seats cannot be chosen as a target. In Kingdom Wars they can be chosen, and the card is
cancelled for them (it has no effect on that seat and is wasted). Empty City: Slash and Duel
against Zhuge Liang while he has no hand cards. Humility: Steal and Capture. Behind the Curtain:
the black Tools it covers today. The card still counts as used (for example a cancelled Slash still
counts toward the once-per-turn limit) — my call, as a use happens before it is cancelled.
These three are real changes and belong to slice 2, not slice 4.

Implementation note (Task 8): Empty City reads Zhuge Liang's hand when the Slash or Duel is aimed at him; the card is then cancelled for him. A hidden Kingdom Wars owner of these skills is asked whether to reveal, as Dynasty Wars' Behind the Curtain is.

Implementation note (Task 9): Bequeathed Strategy reads the top 2 cards of the draw pile as they are; it does not reshuffle the discard pile to make up 2. With 1 card he gives that one; with 0 nothing happens.

Implementation note (Task 13): Sorrow's choice is only between the killer's Generals whose skills are still active. If one of the killer's Generals is already silenced, only the other is offered; if both are (or the whole seat is silenced), Sorrow asks nothing. Which slot lost its skills is public; which General it is stays hidden.
