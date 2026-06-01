/**
 * The reward-vocab boundary: reward keys are the ETL's serialisation vocab; the
 * engine's accumulator uses its own resource dimensions. Both stream channels
 * that ingest bundle rewards (discrete events, generators) map through here, so
 * the vocab translation lives in exactly one place.
 */

/**
 * The only non-identity mapping today is bare `carats` → `carats_free`: bundle
 * rewards are gift (free) carats, and paid is a separate dimension the timeline
 * never grants. Every other reward key passes through unchanged.
 */
export function resourceOf(rewardKey: string): string {
  return rewardKey === "carats" ? "carats_free" : rewardKey;
}
