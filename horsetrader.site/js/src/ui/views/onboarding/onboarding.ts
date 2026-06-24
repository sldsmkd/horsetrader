/**
 * Special Week — the first-run onboarding tour. Tazuna pops up once, walks a
 * brand-new trainer through the two inputs that make the forecast theirs (Trainer,
 * then Resources), names the payoff (banner numbers), and is gone for good. See
 * `special-week/spec.md`.
 *
 * Mechanism: a synced `firstrun` watermark (the highest stage seen). We run every
 * stage whose index exceeds it, in order, persisting per-stage so a mid-tour reload
 * resumes. The registry is **append-only** — indices ARE the order, so a stage added
 * later as `N` reaches existing users whose mark is `< N` without replaying the rest.
 *
 * Visually it's a coachmark: Tazuna's portrait + a one-line blurb in a fixed, centred
 * panel that never moves — and a green ring that highlights the live menubar button she's
 * describing. Keeping the panel put (rather than chasing each target) means it never
 * obscures the control or the content behind it; the ring does all the pointing.
 *
 * It is NOT modal and not dimmed — the page stays bright and click-through, so the player
 * can click the very button she's ringing. Doing so advances the tour AND opens the real
 * surface: she moves the ring to the next step and waits, ready, beside whatever they open.
 */

import "./onboarding.css";

import { h } from "../../h.ts";

const PORTRAIT = "/img/characters/tazuna-hayakawa_portrait.webp";

/** One step of the tour. `selector` resolves a live menubar button to spotlight at
 *  show-time; absent ⇒ a centred card (the welcome and the outro). */
interface Stage {
  index: number;
  blurb: string;
  /** Primary button label; defaults to "Next". */
  cta?: string;
  selector?: string;
}

/**
 * The fixed v1 registry — APPEND ONLY (indices are the watermark, not IDs; inserting
 * in the middle would re-trigger tours for everyone). Order is load-bearing: Trainer
 * (top-left) before Resources (top-right) — the oshi/name is the "this is mine" hook,
 * and it sweeps the spotlight in natural left-to-right reading order.
 */
const STAGES: readonly Stage[] = [
  {
    index: 1,
    blurb:
      "Horsetrader helps you plan future banners by projecting the resources you'll earn and showing whether you can afford your targets.",
    cta: "Start setup",
  },
  {
    index: 2,
    selector: ".menubar__identity",
    blurb:
      "Choose a play style to tell Horsetrader how actively you play. Click the Trainer card to set your name, oshi and detailed assumptions.",
  },
  {
    index: 3,
    selector: ".menubar__balance",
    blurb: "Now record what you have today so Horsetrader can project your future balance.",
  },
];

const OUTRO = "You're ready — click any banner number to start planning.";

/** The highest stage index — the watermark a finished/skipped run lands on. */
const MAX_STAGE = STAGES[STAGES.length - 1].index;

/** Number of tour stages — the beta-chamber dev knob reads this to offer a jump per
 *  stage (set firstrun = k-1 to make stage k the next shown). */
export const ONBOARDING_STAGE_COUNT = MAX_STAGE;

export interface OnboardingOpts {
  /** Current watermark; only stages with index > firstrun run. */
  firstrun: number;
  /** Persist the new watermark — called as each stage is passed, and on skip/finish. */
  onAdvance: (stage: number) => void;
}

export interface OnboardingHandle {
  /** Tear the overlay down now (idempotent) — used if the app unmounts mid-tour. */
  dismiss: () => void;
}

interface Step extends Stage {
  outro: boolean;
}

/**
 * Run the pending tour. Returns null (mounts nothing) when the watermark already
 * covers every stage — the common case for a returning visitor.
 */
export function runOnboarding(opts: OnboardingOpts): OnboardingHandle | null {
  if (typeof document === "undefined") return null;
  const pending = STAGES.filter((s) => s.index > opts.firstrun);
  if (pending.length === 0) return null;

  // The real stages, then a non-gated outro card that always closes the run.
  const steps: Step[] = [
    ...pending.map((s) => ({ ...s, outro: false })),
    { index: MAX_STAGE, blurb: OUTRO, cta: "Got it", outro: true },
  ];

  const spot = h("div", { class: "onboarding__spot" });
  const portrait = h("img", {
    class: "onboarding__portrait",
    attr: { src: PORTRAIT, alt: "Tazuna", width: 200, height: 280, decoding: "async" },
  });
  const blurb = h("p", { class: "onboarding__blurb" });
  const skip = h("button", { class: "onboarding__skip", attr: { type: "button" } }, "Skip");
  const primary = h("button", { class: "onboarding__next", attr: { type: "button" } }, "Next");
  const panel = h(
    "div",
    { class: "onboarding__panel" },
    portrait,
    h("div", { class: "onboarding__body" }, blurb, h("div", { class: "onboarding__actions" }, skip, primary)),
  );
  const overlay = h(
    "div",
    { class: "onboarding", attr: { role: "dialog", "aria-label": "Getting started" } },
    spot,
    panel,
  );

  let i = 0;
  let done = false;
  let detachTarget: (() => void) | null = null;

  /** Move the green ring onto the current step's live target and wire a click on that
   *  real target to advance (the player acts on what Tazuna points at). The panel itself
   *  never moves — it's fixed (centred) in CSS, so it never obscures the target or content.
   *  A targetless step (welcome / outro) simply shows no ring. */
  function place(step: Step): void {
    detachTarget?.();
    detachTarget = null;
    const target = step.selector ? document.querySelector<HTMLElement>(step.selector) : null;
    if (target) {
      const r = target.getBoundingClientRect();
      const pad = 6;
      spot.style.display = "";
      spot.style.top = `${r.top - pad}px`;
      spot.style.left = `${r.left - pad}px`;
      spot.style.width = `${r.width + pad * 2}px`;
      spot.style.height = `${r.height + pad * 2}px`;
      // Clicking the highlighted control opens its real surface (the overlay is click-through);
      // count that as taking the step, so the tour advances with the action.
      const onTargetClick = (): void => advance();
      target.addEventListener("click", onTargetClick);
      detachTarget = () => target.removeEventListener("click", onTargetClick);
    } else {
      spot.style.display = "none";
    }
  }

  function render(): void {
    const step = steps[i];
    blurb.textContent = step.blurb;
    primary.textContent = step.cta ?? "Next";
    skip.style.display = step.outro ? "none" : "";
    place(step);
  }

  function advance(): void {
    const step = steps[i];
    if (!step.outro) opts.onAdvance(step.index); // persist per-stage (resume on reload)
    i += 1;
    if (i >= steps.length) {
      finish();
      return;
    }
    render();
  }

  function finish(): void {
    if (done) return;
    done = true;
    opts.onAdvance(MAX_STAGE); // skip or natural end — the whole tour is now behind us
    detachTarget?.();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }

  const onResize = (): void => {
    if (!done) place(steps[i]);
  };
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") finish();
  };

  primary.addEventListener("click", advance);
  skip.addEventListener("click", finish);
  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", onKey);

  document.body.append(overlay);
  render();
  return { dismiss: finish };
}
