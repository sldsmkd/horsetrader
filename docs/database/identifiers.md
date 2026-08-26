# Character and trainee identifiers

The client has separate identities for a character and for each playable trainee
version. These are observed relationships in the current Global snapshot; SQLite
does not declare them as foreign keys.

## Character

`chara_data.id` is the base character identifier. `text_data` category 6 supplies
the Global character name at `text_data.index = chara_data.id`.

For Mihono Bourbon:

| Field | Value |
| --- | ---: |
| `chara_data.id` | `1026` |
| `text_data(category=6, index=1026)` | `Mihono Bourbon` |

## Playable trainee card

`card_data.id` identifies a particular playable version and `card_data.chara_id`
points back to the base character. All 98 card rows in this snapshot have a
matching `chara_data.id`.

For 96 of those 98 rows, the decimal ID has the convenient shape
`<chara_id><two-digit variant>`:

```text
102602
^^^^ chara_id 1026
    ^^ variant 02
```

This is a useful display convention, not a safe relational rule. The special
cards `9100101` and `9101101` do not follow it. Code should join
`card_data.chara_id`, retain `card_data.id` whole, and only derive a decimal
variant when the prefix actually matches.

Global card text uses:

| Meaning | Join |
| --- | --- |
| Full trainee name | `text_data.category = 4 AND text_data.index = card_data.id` |
| Outfit title | `text_data.category = 5 AND text_data.index = card_data.id` |

All 98 cards have category 4 text in this snapshot.

Mihono Bourbon's second playable version is therefore established structurally,
not from its image filename:

| Field | Value |
| --- | --- |
| `card_data.id` | `102602` |
| `card_data.chara_id` | `1026` |
| Category 4 text | `[CODE: ICING] Mihono Bourbon` |
| Category 5 text | `[CODE: ICING]` |
| `card_data.default_rarity` | `3` |

The Gametora thumbnail name
[`chara_stand_1026_102602.png`](https://gametora.com/images/umamusume/characters/thumb/chara_stand_1026_102602.png)
uses the same character/card pair, but is corroboration rather than the source of
the mapping.

## Card rarity rows

`card_rarity_data` expands a card into rarity-specific stats and a `skill_set`.
Use `(card_id, rarity)` as the semantic lookup even though the physical primary
key is the standalone `id` column.

For card `102602`, rows `10260203`, `10260204`, and `10260205` represent rarities
3, 4, and 5. The apparent `<card_id><rarity>` encoding is again not universal:
three current rows for `card_id = 105602` use `10562303` through `10562305`.
Explicit columns outrank decimal decomposition.
