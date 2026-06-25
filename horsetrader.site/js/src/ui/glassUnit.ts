/**
 * The CSS-to-device calibration bridge (Darley, Grand Masters Part 2).
 *
 * The glass unit (`--glass-u`) and the world aperture (`--glass-aperture-h`) are
 * `calc()` / viewport-unit expressions — the honest, height-authoritative mapping
 * Darley defines in css/glass.css + css/base.css. CSS resolves them to device px
 * only when they feed a real property; reading them back with
 * `getComputedStyle().getPropertyValue()` returns the *unresolved* token
 * (`clamp(...)`, `calc(100svh - ...)`), which `parseFloat` cannot turn into px.
 *
 * So to learn the px the browser actually paints, we substitute the expression into
 * a real `width` on an off-layout probe inside the relevant cascade root and measure
 * it. Reading computed geometry is legitimate here precisely because this *is* the
 * calibration bridge between the CSS unit and the device — not business logic
 * scraping presentation. It forces a synchronous layout, so call it on view changes
 * (resize / recompute), never per frame.
 *
 * `root` selects the cascade context for the element being measured. `--glass-u`
 * itself is root-canonical; local component expressions can still depend on context.
 */
export function resolveLengthPx(root: HTMLElement, expr: string): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    `position:absolute;left:-9999px;top:0;height:0;visibility:hidden;pointer-events:none;width:${expr}`;
  root.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  root.removeChild(probe);
  return px;
}

/** The glass unit (`--glass-u`) in device px, as resolved within `root`'s cascade. */
export const glassUnitPx = (root: HTMLElement): number => resolveLengthPx(root, "var(--glass-u)");

/** The usable world aperture height (`--glass-aperture-h`, viewport − persistent
 *  chrome) in device px. Defined on `:root`, so it resolves there. */
export const apertureHeightPx = (): number =>
  resolveLengthPx(document.documentElement, "var(--glass-aperture-h)");
