/**
 * The outcome-distribution model behind the commit dossier's Forecast widget: given a
 * committed **pity** (the plan), what spread of *target copies* does it buy?
 *
 * The spark is a guarantee, not a chance: every `pullsPerPity` pulls earns one exchange
 * for a copy of the selected target, so committing `p` pity **floors** the outcome at
 * `p` copies — which is why "none" collapses to ~0 the instant any pity is committed.
 * On top of that floor, each of the `N = p × pullsPerPity` pulls independently lands the
 * target at `featuredRate`, so the random *extra* copies are Binomial(N, featuredRate).
 * Total copies are that sum shifted up by the spark floor and capped at `maxCopies` (a
 * support card's MLB / a trainee's 5★) — past the cap a copy is worthless, so the tail
 * piles into the top bar.
 */

export interface ForecastInput {
  /** Committed pity — the plan, and the spark-guaranteed copy floor. */
  pity: number;
  /** Pulls per spark exchange (the spark threshold, e.g. 200). */
  pullsPerPity: number;
  /** Per-pull probability of landing the target (the highest-tier featured card). */
  featuredRate: number;
  /** Copies past which another is dead weight — the distribution's top (≥) bar. */
  maxCopies: number;
}

/** One outcome bar: `copies` of the target with probability `prob` (0..1). The bar at
 *  `copies === maxCopies` is the ≥-cap tail; `guaranteed` marks a spark-floored copy. */
export interface OutcomeBar {
  copies: number;
  prob: number;
  guaranteed: boolean;
}

/** The full 0..maxCopies distribution for a committed pity (always `maxCopies + 1` bars). */
export function forecast(input: ForecastInput): OutcomeBar[] {
  const { pullsPerPity, featuredRate, maxCopies } = input;
  const pity = Math.max(0, Math.floor(input.pity));
  const floor = Math.min(pity, maxCopies); // spark-guaranteed copies, never past the cap
  const n = pity * pullsPerPity;

  const bars: OutcomeBar[] = [];
  let assigned = 0; // probability mass placed in the lower bars so far
  for (let copies = 0; copies <= maxCopies; copies++) {
    let prob: number;
    if (copies < floor) {
      prob = 0; // can't finish below the spark floor
    } else if (copies < maxCopies) {
      prob = binomPmf(n, featuredRate, copies - floor); // exactly `copies - floor` random extras
    } else {
      prob = 1 - assigned; // the top bar catches the whole ≥-cap tail
    }
    assigned += prob;
    bars.push({ copies, prob, guaranteed: copies > 0 && copies <= floor });
  }
  return bars;
}

/** Expected copies E[T] for a committed pity — the Forecast caption's headline number. */
export function expectedCopies(input: ForecastInput): number {
  return forecast(input).reduce((sum, bar) => sum + bar.copies * bar.prob, 0);
}

/** Binomial pmf P(X = k) for X ~ Binomial(n, p), built up by the stable pmf ratio
 *  `pmf(r)/pmf(r-1) = (n-r+1)/r · p/(1-p)` so no factorial ever overflows. */
function binomPmf(n: number, p: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  let pmf = Math.pow(1 - p, n);
  for (let r = 1; r <= k; r++) pmf *= ((n - r + 1) / r) * (p / (1 - p));
  return pmf;
}
