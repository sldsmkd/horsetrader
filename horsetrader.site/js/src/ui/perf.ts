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

/**
 * The aggregate of one captured run (UmaMark, grand-masters/umamark.md). Per-run, NOT
 * rolling: the score the deterministic benchmark compares across a code change or a device.
 * Frame-ms is the universal spine (works everywhere incl. iOS); LoAF + heap are opportunistic
 * progressive enhancement — present on Chrome/Android, silently absent on iOS Safari, never
 * gating the headline numbers.
 */
export interface CaptureResult {
  /** Frames timed in the run (the first inter-frame gap is dropped — it spans the idle
   *  before the run began, not a rendered benchmark frame). */
  frames: number;
  /** Wall-clock span of the run, ms (a fast device finishes the fixed frame count sooner). */
  durationMs: number;
  /** Mean frames per second over the run. */
  fps: number;
  /** Per-frame render cost distribution, ms — the comparable score. */
  frameMs: { p50: number; p95: number; p99: number; max: number; mean: number };
  /** Share of frames that missed the device budget (frameMs > budgetMs), 0–100. */
  overBudgetPct: number;
  /** The device frame budget the run was scored against, ms. */
  budgetMs: number;
  /** Long Animation Frames seen during the run (Chrome/Android only) — a slow-frame
   *  autopsy. `null` where the API is unavailable (iOS Safari). */
  longFrames: { count: number; maxMs: number; totalBlockingMs: number } | null;
  /** JS heap growth over the run, MB (Chrome only — `performance.memory`). `null` elsewhere. */
  heapDeltaMb: number | null;
}

/** A capture in progress — `stop()` ends it and returns the aggregate. */
export interface Capture {
  stop(): CaptureResult;
}

export interface PerfInstrument {
  /** The latest measured snapshot, built on demand (so a verdict path can read adherence). */
  snapshot(): PerfSnapshot;
  /** Receive a fresh snapshot each sample window (~250ms). Returns an unsubscribe. The
   *  frame loop runs regardless; snapshots are only built while someone is subscribed. */
  subscribe(fn: (s: PerfSnapshot) => void): () => void;
  /**
   * Begin a per-run capture: buffer every frame's render cost (off the same frame loop the
   * rolling snapshot rides — the rolling path is untouched), plus opportunistic LoAF + heap
   * where the browser exposes them. `stop()` returns the aggregate score. One capture at a
   * time — UmaMark runs its passes sequentially, each its own capture.
   */
  capture(): Capture;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

// A run-scoped frame buffer the tick appends to while a capture is live. `skipFirst` drops
// the first reading (the inter-frame gap spanning the idle before the run started).
interface ActiveCapture {
  frames: number[];
  skipFirst: boolean;
}

// Round to 0.01 MB so a heap delta reads cleanly.
function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

// A frame counts as "over budget" only when it overshoots the refresh interval by half —
// a genuine miss (a frame ≥ ~1.5× refresh failed to make a vsync deadline), not the ±0.1ms
// jitter every vsync-locked frame carries. Without this, a perfectly smooth run reads 100%
// over, because frames sit a hair above the fastest-ever frame.
const OVER_BUDGET_MISS = 1.5;

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

  // The budget = the device refresh interval, derived from the PEAK windowed fps rather than
  // the fastest single frame. vsync caps how many frames the panel can present per second, so
  // the highest sustained fps converges on the true refresh — and a lone coalesced/catch-up
  // frame (which can read well under the refresh interval, e.g. a 4ms gap on a 144Hz panel)
  // can't spike a 250ms-windowed average, so it no longer poisons the budget. Seeded at 60Hz
  // so a fresh load isn't "over budget" before a full-speed window has been observed.
  let maxFps = 60;
  let budgetMs = 1000 / maxFps;
  let overBudget = false;

  const subscribers = new Set<(s: PerfSnapshot) => void>();
  let active: ActiveCapture | null = null;

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
    // Run capture rides the same tick (rolling path untouched): append this frame's cost,
    // dropping the first reading (it spans the pre-run idle, not a rendered frame).
    if (active) {
      if (active.skipFirst) active.skipFirst = false;
      else active.frames.push(frameMs);
    }

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
      // Learn the refresh from the peak windowed fps (vsync caps it at the true ceiling).
      if (fps > maxFps) {
        maxFps = fps;
        budgetMs = 1000 / maxFps;
      }
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
    capture(): Capture {
      const frames: number[] = [];
      active = { frames, skipFirst: true };
      const startedAt = performance.now();

      // Opportunistic LoAF autopsy — Chrome/Android only, absent on iOS Safari. Collects
      // slow-frame entries (≥~50ms) for the run; never gates the frame-ms score.
      const loaf: PerformanceEntry[] = [];
      const loafSupported =
        typeof PerformanceObserver !== "undefined" &&
        (PerformanceObserver.supportedEntryTypes ?? []).includes("long-animation-frame");
      let observer: PerformanceObserver | null = null;
      if (loafSupported) {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) loaf.push(entry);
        });
        observer.observe({ type: "long-animation-frame", buffered: false } as PerformanceObserverInit);
      }

      // Opportunistic heap delta — Chrome-only `performance.memory`.
      const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      const heapStart = memory?.usedJSHeapSize ?? null;

      return {
        stop(): CaptureResult {
          active = null;
          const durationMs = performance.now() - startedAt;
          observer?.disconnect();

          const sorted = frames.slice().sort((a, b) => a - b);
          const mean = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
          const overBudget = budgetMs > 0 ? frames.filter((f) => f > budgetMs * OVER_BUDGET_MISS).length : 0;

          const heapEnd = memory?.usedJSHeapSize ?? null;
          const longFrames = loafSupported
            ? {
                count: loaf.length,
                maxMs: loaf.reduce((m, e) => Math.max(m, e.duration), 0),
                totalBlockingMs: loaf.reduce(
                  (sum, e) => sum + ((e as { blockingDuration?: number }).blockingDuration ?? 0),
                  0,
                ),
              }
            : null;

          return {
            frames: frames.length,
            durationMs,
            fps: durationMs > 0 ? (frames.length * 1000) / durationMs : 0,
            frameMs: {
              p50: percentile(sorted, 50),
              p95: percentile(sorted, 95),
              p99: percentile(sorted, 99),
              max: sorted.length ? sorted[sorted.length - 1] : 0,
              mean,
            },
            overBudgetPct: frames.length ? (overBudget / frames.length) * 100 : 0,
            budgetMs,
            longFrames,
            heapDeltaMb: heapStart !== null && heapEnd !== null ? bytesToMb(heapEnd - heapStart) : null,
          };
        },
      };
    },
  };
}
