/**
 * The single formatter: a signed resource number → display text. The engine
 * holds raw signed integers (`-50`); exactly one place decides how they read
 * (sign, grouping), so the prototype's `+-50` bug — sign-prefixing an
 * already-negative value in one of many ad-hoc spots — has nowhere to recur.
 *
 * Pure, no DOM. See docs/frontend/projection.md ("formatting is a UI concern")
 * and docs/frontend/interaction.md (the primitives layer).
 */

const plain = new Intl.NumberFormat("en-US");
const signed = new Intl.NumberFormat("en-US", { signDisplay: "exceptZero" });
const date = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

const rewardLabels: Record<string, string> = {
  free_carats: "carats",
  paid_carats: "paid carats",
  pulls: "pulls",
  trainee_tickets: "trainee tickets",
  support_tickets: "support tickets",
  rainbow_crystal_shards: "rainbow shards",
  gold_crystal_shards: "gold shards",
};

const rewardIcons: Record<string, string> = {
  free_carats: "/icons/carat.png",
  paid_carats: "/icons/carat.png",
  trainee_tickets: "/icons/trainee_ticket.png",
  support_tickets: "/icons/support_ticket.png",
  rainbow_crystal_shards: "/icons/rainbow_crystal_shard.png",
  gold_crystal_shards: "/icons/gold_crystal_shard.png",
};

const rewardOrder = new Map(
  [
    "free_carats",
    "trainee_tickets",
    "support_tickets",
    "rainbow_crystal_shards",
    "gold_crystal_shards",
  ].map((key, index) => [key, index]),
);

export interface RewardLine {
  key: string;
  amount: string;
  label: string;
  icon?: string;
}

/** An ISO date (`2026-06-10`) → a compact label (`Jun 10, 26`), formatted in UTC
 *  so the calendar day never shifts under a local timezone. */
export function formatDate(iso: string): string {
  return date.format(new Date(`${iso}T00:00:00Z`));
}

/** A balance / magnitude: grouped, a minus only when negative. `1,250` · `-50` · `0`. */
export function formatBalance(amount: number): string {
  return plain.format(amount);
}

/**
 * A delta / movement: always carries its sign so a ledger entry reads as a
 * change. `+75` · `-50` · `0`. The sign is applied once, by `Intl`, from the
 * value itself — there is no separate prefix step to collide with a negative.
 */
export function formatDelta(amount: number): string {
  return signed.format(amount);
}

export function formatRewardLines(rewards: Record<string, number | undefined>): RewardLine[] {
  return Object.entries(rewards)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] !== 0)
    .sort(([a], [b]) => (rewardOrder.get(a) ?? 1000) - (rewardOrder.get(b) ?? 1000) || a.localeCompare(b))
    .map(([key, amount]) => {
      const icon = rewardIcons[key];
      return {
        key,
        amount: formatBalance(amount),
        label: rewardLabels[key] ?? key.replaceAll("_", " "),
        ...(icon ? { icon } : {}),
      };
    });
}
