/* eslint-disable */
/**
 * Generated from the ETL's published JSON Schema by `npm run gen:types`.
 * DO NOT EDIT BY HAND — re-run generation when the schema changes.
 */

/**
 * Top-level shape of ``config.json`` — the non-timeline baked-config channel.
 *
 * ``reward_structures`` is a stable-key → baked-rewards map: each value is the
 * same ``Baked`` shape an event's ``rewards`` carries (the per-occurrence
 * numbers for a procedural stream the client expands on its own cadence).
 * ``reward_maps`` adds the *rank-graded* recipes: each is a rank-label →
 * baked-rewards map (e.g. Team Trials by class), the rank selected client-side.
 * ``gacha`` carries standing pull-math constants: pity/spark threshold, pull
 * cost, normal rarity rates, and normal featured pickup rates. Banner-local
 * overrides only carry exceptions to these normal rates.
 * Future baked config rides as sibling top-level keys.
 *
 * Keys are the stable-key *body* — the bucket already namespaces them, so the
 * wire drops the redundant `reward-structure-` / `reward-map-` prefix the
 * curated key carries (`reward-structure-dailies` → `dailies`).
 */
export interface ConfigBundle {
  reward_structures: {
    [k: string]: {
      [k: string]:
        | number
        | {
            [k: string]: number | string | (number | null)[];
          };
    };
  };
  reward_maps: {
    [k: string]: {
      [k: string]: {
        [k: string]:
          | number
          | {
              [k: string]: number | string | (number | null)[];
            };
      };
    };
  };
  gacha: GachaConfig;
}
/**
 * Game gacha constants consumed by planner-side pull math.
 *
 * Rates are decimal probabilities, not percentages: ``0.0075`` = 0.75%.
 * ``featured_rates`` are the normal per-atom pickup rates by UI rarity tier;
 * banner-local overrides carry exceptions when a specific pickup is compressed
 * or otherwise special.
 */
export interface GachaConfig {
  spark_threshold: number;
  carats_per_pull: number;
  paid_daily_pull: number;
  rarity_rates: {
    [k: string]: number;
  };
  featured_rates: {
    [k: string]: number;
  };
}
