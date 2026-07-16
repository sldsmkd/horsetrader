import type { Capabilities } from "./capabilities.ts";

/**
 * Device form — the one policy derivation the presentation policies share.
 *
 * contracts.md anticipated this seam: "device class falls out of CSS-px viewport extent +
 * pointer". During the Godolphin build the derivation was smeared as a copy-pasted
 * `touchFirst && ≤600` predicate across every policy; this module is the integration-phase
 * extraction. It composes Godolphin's *qualitative* capabilities with Darley's *quantitative*
 * viewport extent — which is exactly why it lives downstream of `capabilities.ts` rather than
 * inside it (capability ≠ policy).
 *
 * `spacious` deliberately bundles tablet, desktop, and fine-pointer-narrow-window: every
 * current policy treats them identically (the full glass representation fits). Split it only
 * when a policy actually needs the distinction.
 */
export type DeviceForm = "phone-portrait" | "phone-landscape" | "spacious";

/**
 * The phone cutoff: a viewport whose short edge is at or under this many CSS px, on a
 * touch-first device, gets the phone representations. CSS px are angular-normalised, so this
 * is a physical-size proxy that holds across DPRs (see contracts.md "Physical device size is
 * NOT derivable — and not needed").
 */
export const PHONE_SHORT_EDGE_MAX_PX = 600;

/**
 * Touch-first + phone extent → a phone form; anything else is spacious. A square viewport
 * ties to portrait — the phone classification is extent-based, so a phone always has an
 * orientation (the pre-extraction policies left the square case unclassified by strict
 * inequalities; this is the deliberate resolution, not an accident).
 */
export function deviceForm(
  caps: Capabilities,
  viewportWidth: number,
  viewportHeight: number,
): DeviceForm {
  const touchFirst = caps.pointer === "coarse" && caps.noHover && caps.touchPoints > 0;
  const phoneExtent = Math.min(viewportWidth, viewportHeight) <= PHONE_SHORT_EDGE_MAX_PX;
  if (!touchFirst || !phoneExtent) return "spacious";
  return viewportWidth > viewportHeight ? "phone-landscape" : "phone-portrait";
}
