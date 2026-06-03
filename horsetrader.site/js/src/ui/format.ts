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
