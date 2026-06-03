---
name: project_sequence_reward_type
description: "The SequenceReward type — ETL ships the value, the client owns the collection/strategies"
metadata: 
  node_type: memory
  type: project
  originSessionId: e9d6ad71-690f-4add-891b-beb43fd38872
---

`SequenceReward` (`horsetrader/models/rewards/rewards.py`, shipped 2026-06-01) is a daily-login-bonus schedule for a *single* `CounterReward` type: per login-day an `int` amount, or `None` for a day the type isn't paid. Baked under `sequence` as `{"type": <reward key>, "sequence": [...]}` with absent days as `null`; round-trips via `_sequence_from_baked` / `rewards_to_baked`. A bare `0` in curated YAML is shorthand for `None`. `total()` sums only the paying days.

**The key design boundary (client request that motivated it):** the client builds *spending strategies* as a collection of sequences it **generates itself**, reading its own running balance for affordability. That collection + overlay + affordability is **entirely clientside** — the ETL just ships the value *type* so client-generated and baked sequences share one shape. Don't model a collection/list of strategies ETL-side.

**Why nullable = absence, not `0`:** the type is fixed across a sequence, so a skip is the *absence of that type* (an unmodelled welfare-card day on the reward we bake; "this strategy doesn't act today" for client overlay). Absence is what lets the client overlay sparse strategies into one net daily delta. Both readings want `None`.

**Why single-sequence-per-event (not listable):** in practice no baked reward sequence has a second type that affects spending (N=1). So the baked shape stays a single object, NOT a list. Trigger to lift to a list: a real game-defined reward sequence with a second spending-relevant type ([[feedback_work_from_the_back]]). Until then, multi-sequence support is speculative — don't build it.

**How to apply:** this unblocks the parked spends channel in [[project_projection_engine]] — now a pure frontend task. The list/overlay/affordability logic is frontend; don't build it from an ETL session ([[project_workspace_split]]).
