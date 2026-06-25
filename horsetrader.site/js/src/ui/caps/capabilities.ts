/**
 * Device capabilities — the reliable half of Godolphin's substrate (Grand Masters Part 3).
 *
 * Godolphin owns modality-as-orientation, and the discipline is *capability ≠ state*: the
 * device's current orientation is the flaky half (sensor/lock/permission), so we refuse it;
 * its *capabilities* — "coarse pointer? can it hover?" — are the reliable, feature-detectable
 * half, so policy keys off these. This module is that half: the qualitative `matchMedia`
 * answers, detected at startup and re-queried on change, never polled.
 *
 * Orthogonal to **Darley's facts** (`glassUnit.ts`): she reads the *quantitative* px ("how
 * big" — glass-u, aperture, fit-zoom); these are *qualitative* ("can it"). Policy is the
 * function `capabilities → mode↔orientation binding` and lives downstream of both; it is not
 * here. This file only reports what the device is, not what we do about it.
 *
 * Deliberately NOT here yet: safe-area presence (needs a layout-forcing `env()` probe and
 * reads 0/0/0/0 until index.html gains `viewport-fit=cover`, an app-wide change — see the
 * Godolphin seam in contracts.md), and device *class* (phone/tablet/desktop), which is a
 * policy derivation over these capabilities plus Darley's viewport extent. Keep this module
 * to the cheap, synchronous, reactive reads; let policy compose them.
 */

/** The qualitative, feature-detectable device capabilities policy keys off. */
export interface Capabilities {
  /**
   * Primary pointer character. `coarse` ⇒ touch/stylus is the main input (fat targets, no
   * hover-only affordances); `fine` ⇒ mouse/trackpad. The binary cut the whole policy turns
   * on; a rare pointerless device (`pointer: none`) folds into `fine` — harmless here.
   */
  pointer: "coarse" | "fine";
  /** *Any* available pointer is coarse — catches hybrids (touch laptop) that a mouse-primary
   *  `pointer` would hide. Useful evidence that touch is available, but target sizing follows
   *  the primary `pointer` so a mouse-first hybrid keeps fine controls. */
  anyCoarse: boolean;
  /** The primary input can hover. `false` ⇒ swap hover-only affordances for tap. */
  hover: boolean;
  /** *No* available input can hover — the strong "this is a touch device" signal. */
  noHover: boolean;
  /** Concurrent touch points; 0 on a pure-mouse device. Complements `coarse` for touch sizing. */
  touchPoints: number;
}

/** The four media queries the capabilities derive from. Named so the wiring and the pure
 *  mapping agree on exactly one source of truth. */
export const CAP_QUERIES = {
  pointerCoarse: "(pointer: coarse)",
  anyCoarse: "(any-pointer: coarse)",
  hover: "(hover: hover)",
  anyHover: "(any-hover: hover)",
} as const;

export type GlassPointer = "fine" | "coarse";

/** Discrete glass-target policy: size for the primary pointer, not any attached pointer. */
export function glassPointer(caps: Capabilities): GlassPointer {
  return caps.pointer;
}

/**
 * Pure mapping: media-query answers + touch-point count → a capability snapshot. Split out
 * from the live wiring so it is testable under `node --test` (no DOM): a guard can feed the
 * matcher an iPhone / desktop profile and assert the mapping against F11's measured truth.
 */
export function readCapabilities(match: (query: string) => boolean, touchPoints: number): Capabilities {
  return {
    pointer: match(CAP_QUERIES.pointerCoarse) ? "coarse" : "fine",
    anyCoarse: match(CAP_QUERIES.anyCoarse),
    hover: match(CAP_QUERIES.hover),
    noHover: !match(CAP_QUERIES.anyHover),
    touchPoints,
  };
}

/** Field-wise equality, so the store only notifies on a genuine capability change. */
function same(a: Capabilities, b: Capabilities): boolean {
  return (
    a.pointer === b.pointer &&
    a.anyCoarse === b.anyCoarse &&
    a.hover === b.hover &&
    a.noHover === b.noHover &&
    a.touchPoints === b.touchPoints
  );
}

/** A live, reactive view of the device's capabilities. Detect once, re-read on change. */
export interface CapabilityStore {
  /** The current snapshot (synchronous — already detected). */
  get(): Capabilities;
  /** Observe changes (e.g. a mouse plugged into a tablet). Returns an unsubscribe. */
  subscribe(fn: (caps: Capabilities) => void): () => void;
}

/**
 * Build the live store: detect at startup, then re-query when a `matchMedia` answer flips
 * (docking a mouse, attaching a touchscreen). Reactive via the `change` event, NOT polled —
 * the capabilities are stable enough that an event is the right cadence. `touchPoints` has no
 * media query, so it is re-read on the same change ticks (a cheap `navigator` read).
 */
export function createCapabilities(): CapabilityStore {
  const mqls = Object.fromEntries(
    Object.entries(CAP_QUERIES).map(([name, query]) => [name, window.matchMedia(query)]),
  ) as Record<keyof typeof CAP_QUERIES, MediaQueryList>;

  const read = (): Capabilities =>
    readCapabilities((q) => window.matchMedia(q).matches, navigator.maxTouchPoints);

  let current = read();
  const subs = new Set<(caps: Capabilities) => void>();

  const onChange = () => {
    const next = read();
    if (same(current, next)) return;
    current = next;
    for (const fn of subs) fn(current);
  };
  for (const mql of Object.values(mqls)) mql.addEventListener("change", onChange);

  return {
    get: () => current,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
