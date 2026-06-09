/**
 * Shared test config fixture. `createBundle` takes the baked `config.json` as a
 * first-class input (peer of events/academy); tests that build a bundle need a
 * `ConfigBundle` to hand it. The real pull-math constants so anything that reads
 * `gacha` gets game-true numbers.
 */

import type { ConfigBundle } from "../../core/bundle/config.gen.ts";

export const TEST_CONFIG: ConfigBundle = {
  reward_structures: {},
  reward_maps: {},
  gacha: {
    spark_threshold: 200,
    carats_per_pull: 150,
    paid_daily_pull: 50,
    rarity_rates: { crystal: 0.03, gold: 0.18, silver: 0.79 },
    featured_rates: { crystal: 0.0075, gold: 0.0225 },
  },
};
