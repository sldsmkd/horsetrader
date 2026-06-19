import "./pityBand.css";

export type PityBand = "empty" | "positive" | "waste" | "unfundable";

/**
 * The shared pity-colour rule, used by both the timeline commitment badge and the
 * commit shield's pity stepper so they always agree. Precedence: unfundable (red,
 * can't afford it) always wins; then empty/0 (grey, no commitment); then waste
 * (purple) past the kind-dependent target (PITY_WASTE_ABOVE — trainee 1, support
 * 3); else positive (green, a sensible commit toward the guarantee). Apply the
 * result as a `pity-band--<band>` class.
 */
export function pityBand(pity: number, unfundable: boolean, wasteAbove: number): PityBand {
  if (unfundable) return "unfundable";
  if (pity === 0) return "empty";
  if (pity > wasteAbove) return "waste";
  return "positive";
}
