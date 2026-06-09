/**
 * Supporter check — the client half of the hashed-supporter list. The ETL (for
 * now `scripts/supporters.py`) publishes `/json/supporters.json` as a flat
 * `{ <sha256-hex of the 12 account-id digits>: <username> }` map: a one-way
 * hash so the public file never carries a readable account ID (the same
 * screenshot/casual-leak stance as the Trainer ID field — not real secrecy).
 *
 * You become a supporter by matching BOTH halves of your own entry: your
 * account ID hashes to a key in the map AND the stored username equals yours.
 * Hand a friend/patron an entry (their ID + their name) and the check lights up
 * on their device only.
 *
 * Deliberately tiny and self-contained — capped at ~50 entries by design; past
 * that it gets replaced by a real account system, not grown here.
 */

const ID_DIGITS = 12;

/** Flat hashed map exactly as `supporters.json` ships it. */
export type SupporterRegistry = Record<string, string>;

/**
 * Lowercase hex SHA-256 of the digits-only ID — byte-identical to the Python
 * `hashlib.sha256(digits).hexdigest()` that wrote the file (digits are ASCII, so
 * the UTF-8 encoding matches). Returns `null` when the ID isn't 12 digits (a
 * value that could never match an entry), mirroring the trainer-card field's
 * digit normalization.
 */
export async function hashAccountId(accountId: string): Promise<string | null> {
  const digits = accountId.replace(/\D/g, "").slice(0, ID_DIGITS);
  if (digits.length !== ID_DIGITS) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(digits));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** True iff `accountId` hashes to a known key AND the stored username matches. */
export async function verifySupporter(
  registry: SupporterRegistry,
  accountId: string,
  username: string,
): Promise<boolean> {
  const key = await hashAccountId(accountId);
  if (key === null) return false;
  const name = username.trim();
  return name.length > 0 && registry[key] === name;
}

/**
 * Fetch the published map, fail-soft to empty — supporter status is a perk, not
 * load-bearing, so a missing/garbled file just means "no one's a supporter"
 * rather than a boot failure (same stance as `strings.json`).
 */
export async function loadSupporters(): Promise<SupporterRegistry> {
  try {
    const response = await fetch("/json/supporters.json");
    if (!response.ok) return {};
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
    const registry: SupporterRegistry = {};
    for (const [key, value] of Object.entries(data)) if (typeof value === "string") registry[key] = value;
    return registry;
  } catch {
    return {};
  }
}
