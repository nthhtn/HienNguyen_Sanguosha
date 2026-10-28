# Kingdom Wars Generals Slice 3: Confirmed Rule Text

Date: 2026-10-23. Part of `2026-10-22-kingdom-wars-generals-engine-design.md` (slice 3: the 9 new
Generals). Each rule was confirmed by the user before implementation. Status: batch 1 confirmed;
batch 2 is added when confirmed.

## Batch 1 (confirmed 2026-10-23)

### Gan Fu Ren (Lady Gan)
- **Prudence (淑慎):** whenever she regains HP, once per point regained, she may pick another seat
  of her Kingdom to draw 1 card. Only exposed seats can be picked (a hidden seat has no Kingdom).
  An Ambitionist is a Kingdom of one, so there is nobody to pick.
- **Divine Wisdom (神智):** at the start of her turn she may discard all her hand cards. If the
  number discarded is at least her current HP, she regains 1 HP. With an empty hand nothing happens.

### Yue Jin, Dauntless (骁果)
At the end of another seat's turn, she may discard a Basic card from her hand. That seat then
discards an Equipment card (from hand or equipment area), or takes 1 damage from her.

### Ding Feng
- **Close Combat (短兵):** when he uses Sha, he may add one more target. It must be within physical
  distance 1 of him and within his attack range (weapon range included), and a legal Sha target.
- **Swift and Deadly (奋迅):** once per Play Phase, he discards a card and picks a seat. His distance
  to that seat counts as 1 until the end of the turn. Only his distance to it changes.

### Pan Feng, Insanity Axe (狂斧)
After his Sha damages a seat, once per damage, he may pick a card in that seat's equipment area and
either move it into his own equipment area or discard it. If his matching slot is full, a move
replaces it: his old card there is discarded.

### Tian Feng
- **Deathly Counsel (死谏):** when he loses his last hand card, he may discard 1 card of another
  seat, from its hand or equipment area (no judgment area).
- **With the Tide (随势):** compulsory. When another seat enters dying and the damage source is in his
  Kingdom, he draws 1. When another seat of his Kingdom dies, he loses 1 HP.

### Kong Rong
- **Celebrity (名士):** when he takes damage from a source that has at least one hidden General, the
  damage is reduced by 1 (minimum 0). Damage with no source is not reduced.
- **Comity (礼让):** when cards he discards or loses from hand or equipment area are about to go to the
  discard pile, he may give them to another seat instead. Cards he used that go to the discard pile
  after resolving are not covered.

## Batch 2 (confirmed 2026-10-23)

### Ma Teng, Call of Valour (雄异)
Single-use (once per game), Play Phase. Every exposed seat of his Kingdom, himself included, draws 3.
Kingdoms are counted over exposed seats only (a hidden seat is in no Kingdom; each Ambitionist is a
Kingdom of one). If his Kingdom has the fewest seats, ties included, he regains 1 HP.

### Ji Ling, Double Edged (双刃)
At the start of his Play Phase he may hold a Points Duel with another seat. If he wins, it is viewed as
him using Sha on the loser, or on another seat of the loser's Kingdom, with no range limit. That Sha
does not count toward his one-Sha-per-turn limit. If he does not win (a tie included), his Play Phase
ends. If the loser is hidden (no Kingdom), the Sha can only target the loser.

### Zou Shi
- **Femme Fatale (祸水):** in her Play Phase she may expose this General (a free voluntary reveal).
  During her turn, while she is exposed, no other seat can expose, by any means (voluntary, trigger
  asks, reveal-on-use).
- **Impetus for Conflicts (倾城):** in her Play Phase, any number of times, she discards an Equipment
  card and picks another seat with both Generals exposed. She chooses one of its Generals and hides
  it. It can later be exposed again by the normal reveal conditions (not during her turn while Femme
  Fatale holds). If the hidden General was the Main General, the seat's Kingdom comes from its
  remaining exposed General, or none if no General is exposed.
