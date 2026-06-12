/**
 * Training Pass subscription resolution. The premium-track *income* is settled
 * by the engine's `subscription.training-pass` graded claimer (core/engine/
 * streams/graded.ts); what survives here is the single source of the config
 * precedence — whether the player owns the premium track at all.
 */

import type { Config } from "../../persistence/document.ts";

/**
 * Whether the player owns the Training Pass premium track. A `true` in
 * `config.trainingPass` *is* the subscription (its presence enables the stream);
 * anything else means free-track only. The single source of that precedence,
 * mirroring `resolveDailyPack`.
 */
export function resolveTrainingPass(config: Config | undefined): boolean {
  return config?.["trainingPass"] === true;
}
