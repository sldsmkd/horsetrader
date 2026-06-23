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
const date = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateNoYear = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
const dayOnly = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" });

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

/** An ISO date (`2026-06-10`) → a compact label (`Jun 10, 2026`), formatted in UTC
 *  so the calendar day never shifts under a local timezone. */
export function formatDate(iso: string): string {
  return date.format(new Date(`${iso}T00:00:00Z`));
}

/** The family-name prefixes. Only the Matikane pair is baked run-together
 *  (`Matikanetannhauser`); Sakura/Mejiro/Symboli/Satono already carry a space. They're
 *  all listed for completeness — the split below only fires on the run-together ones. */
const FAMILY_PREFIXES = ["Matikane", "Sakura", "Mejiro", "Symboli", "Satono"];

/** Display a character's stable name: where a family prefix is run together with the
 *  given name (`Matikanetannhauser` → `Matikane Tannhauser`), split it so the only
 *  over-long names wrap at a real space and the given name reads capitalised. Names
 *  that already carry a space — or aren't a family name — pass through unchanged. */
export function formatCharacterName(name: string): string {
  for (const prefix of FAMILY_PREFIXES) {
    if (name.length <= prefix.length || !name.startsWith(prefix)) continue;
    const given = name.slice(prefix.length);
    if (given.startsWith(" ")) return name; // already spaced — leave it
    return `${prefix} ${given[0]!.toUpperCase()}${given.slice(1)}`;
  }
  return name;
}

/** The English possessive of a name: `Xelene` → `Xelene's`, a name already ending in s/S
 *  → just the apostrophe (`Kris` → `Kris'`). English-only by design — no localisation. It
 *  only ever *appends* `'`/`'s`, so whatever the player typed (emoji, other scripts) is
 *  carried verbatim, never transformed into something they didn't write. Empty in, empty out. */
export function possessive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return /[sS]$/.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

/** A closed date range → a compact label, collapsing shared parts: same month
 *  `Aug 23 – 31, 2026`, same year `Aug 23 – Sep 5, 2026`, otherwise full both ends
 *  `Dec 28, 2026 – Jan 5, 2027`. A zero-length range falls back to the single date. */
/** The month + day, no year (`Jul 2`) — for stacking the year on its own line. */
export function formatMonthDay(iso: string): string {
  return dateNoYear.format(new Date(`${iso}T00:00:00Z`));
}
/** Just the four-digit year (`2026`). */
export function formatYear(iso: string): string {
  return String(new Date(`${iso}T00:00:00Z`).getUTCFullYear());
}

export function formatDateRange(startIso: string, endIso: string): string {
  if (startIso === endIso) return formatDate(startIso);
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const startLabel = sameYear ? dateNoYear.format(start) : date.format(start);
  const endLabel = sameMonth ? `${dayOnly.format(end)}, ${date.format(end).split(", ")[1]}` : date.format(end);
  return `${startLabel} – ${endLabel}`;
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
