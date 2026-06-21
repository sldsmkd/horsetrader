/**
 * The performance instrument (Darley, Grand Masters Part 2).
 *
 * Darley "faces the messy reality of actual hardware", and that's performance reality as
 * much as pixel reality — so she owns the *measurement*. This is one always-on frame loop
 * that times the render, collects DOM churn, learns the device's refresh ceiling, and
 * reports adherence to that frame budget. It is a standing capability, separable from any
 * one verdict it serves: the parked blur decision, mobile, a culling regression, or a new
 * heavy surface all measure against this single instrument rather than re-deriving timing.
 *
 * Collection lives here; presentation does not. The MangoHorse HUD (views/perfHud.ts) is a
 * dumb consumer that renders snapshots — see [[project_metrics_service]] for the same
 * single-source split on the data side.
 */

const SAMPLE_MS = 250; // fps integration window
const FPS_SAMPLES = 72; // fps graph history length
// Per-frame churn ring for the percentile readout (~28s @144Hz, ~68s @60Hz). The all-time
// high watermark is tracked separately so it survives the ring wrapping.
const CHURN_WINDOW = 4096;

export interface PerfSnapshot {
  /** Frames per second over the last sample window. */
  fps: number;
  /** Duration of the most recent frame, ms. */
  frameMs: number;
  /** Recent fps samples, oldest → newest, for the HUD graph. */
  fpsSamples: readonly number[];
  /** Per-frame DOM churn: 99th / 99.9th percentile and all-time high watermark. */
  churnP99: number;
  churnP999: number;
  churnMax: number;
  /** The device frame budget, ms — its refresh interval, learned from the fastest frames
   *  (the panel can't render faster than it refreshes). Adapts to real hardware rather than
   *  assuming 60 or 144. */
  budgetMs: number;
  /** The windowed fps is missing the budget by a sustained margin (a stutter, not a blip). */
  overBudget: boolean;
}

export interface PerfInstrumentOptions {
  /** Per-frame DOM churn source — read + reset once per frame. */
  drainChurn(): number;
}

export interface PerfInstrument {
  /** The latest measured snapshot, built on demand (so a verdict path can read adherence). */
  snapshot(): PerfSnapshot;
  /** Receive a fresh snapshot each sample window (~250ms). Returns an unsubscribe. The
   *  frame loop runs regardless; snapshots are only built while someone is subscribed. */
  subscribe(fn: (s: PerfSnapshot) => void): () => void;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export function perfInstrument({ drainChurn }: PerfInstrumentOptions): PerfInstrument {
  let lastFrame = performance.now();
  let lastSample = lastFrame;
  let frames = 0;
  let fps = 0;
  let frameMs = 0;
  const fpsSamples: number[] = [];

  const churn = new Float64Array(CHURN_WINDOW);
  let churnIdx = 0;
  let churnCount = 0;
  let churnMax = 0;

  // The budget = the device refresh interval, learned as the fastest frame seen (ratchets
  // down toward the panel's true ceiling). Seeded at 60Hz so a fresh load isn't "over
  // budget" before any fast frame has been observed.
  let budgetMs = 1000 / 60;
  let overBudget = false;

  const subscribers = new Set<(s: PerfSnapshot) => void>();

  const snapshot = (): PerfSnapshot => {
    const sorted = Array.from(churn.subarray(0, churnCount)).sort((a, b) => a - b);
    return {
      fps,
      frameMs,
      fpsSamples: fpsSamples.slice(),
      churnP99: percentile(sorted, 99),
      churnP999: percentile(sorted, 99.9),
      churnMax,
      budgetMs,
      overBudget,
    };
  };

  const tick = (t: number): void => {
    frameMs = t - lastFrame;
    lastFrame = t;
    frames += 1;
    // Learn the refresh ceiling from the fastest real frames (a sub-1ms reading is a tab
    // resume / clock artifact, not a true frame — ignore it).
    if (frameMs > 1 && frameMs < budgetMs) budgetMs = frameMs;

    // Drain churn every frame (even with no subscriber) so each ring entry is one frame.
    const frameChurn = drainChurn();
    churn[churnIdx] = frameChurn;
    churnIdx = (churnIdx + 1) % CHURN_WINDOW;
    if (churnCount < CHURN_WINDOW) churnCount += 1;
    if (frameChurn > churnMax) churnMax = frameChurn;

    if (t - lastSample >= SAMPLE_MS) {
      fps = (frames * 1000) / (t - lastSample);
      frames = 0;
      lastSample = t;
      fpsSamples.push(fps);
      if (fpsSamples.length > FPS_SAMPLES) fpsSamples.shift();
      // Adherence is a sustained verdict, not a per-frame one: the windowed fps falling
      // more than 10% short of the refresh ceiling is a real stutter.
      overBudget = fps > 0 && fps < (1000 / budgetMs) * 0.9;
      if (subscribers.size) {
        const s = snapshot();
        for (const fn of subscribers) fn(s);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    snapshot,
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}
