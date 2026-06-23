/**
 * The commit modal: a **banner dossier with a planning attachment** (the write
 * half of a banner's commitment; the balance editor / oshi selector are the
 * reference modals — [[feedback_shield_vs_unfold]]). It reads top-down in the
 * player's order of questions (docs/frontend/ui.md "the plan"):
 *
 *   1. *What am I pulling for?* — banner artwork + the featured-card grid (the hero;
 *      the cards outrank the commitment control).
 *   2. *What am I planning, and what does it buy?* — YOUR PLAN: the **pity** stepper
 *      (principle 10 — you budget in guarantees) sitting beside the FORECAST chart, so
 *      the outcome reads right where the player dials it (widgets/forecast.ts — the
 *      binomial-over-pulls + spark-floor distribution, redrawn as the stepper moves).
 *   3. *What will it cost?* — RESOURCE IMPACT: predicted-available → after-commitment, a
 *      worst-case reservation (informational, never a validator — overcommitment is
 *      allowed; it just runs the carat balance negative, which the view flags red).
 *
 * It owns its draft pity in a closure and reads it back only on Save; the banner
 * behind it stays a pure read.
 */

import "./commitDossier.css";

import { h } from "../../h.ts";
import { formatBalance, formatDate } from "../../format.ts";
import { reserve, type CommitContext, type CommitAtom } from "../../select/commit.ts";
import { PITY_WASTE_ABOVE } from "../../select/aboveLane.ts";
import { forecastWidget } from "../widgets/forecast.ts";
import { pityBand } from "../widgets/pityBand.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { surfaceCancel } from "./surface.ts";
import { checkbox } from "../widgets/checkbox.ts";

export interface CommitDossierOpts {
  context: CommitContext;
  /** Commit a pity count (or `null` to clear), and whether to spend owned paid carats
   *  at full price beyond the daily window (#65). */
  onCommit: (pity: number | null, usePaid: boolean) => void;
  /** Inspect a featured card — open its detail surface (twinkle-monthly step 1).
   *  Optional: the dossier renders read-only cards when absent. */
  onInspect?: (atom: CommitAtom) => void;
  onClose: () => void;
}

const TITLE: Record<CommitContext["kind"], string> = { support: "Support Card Pickup", trainee: "Trainee Pickup" };

/** Above this many featured cards the grid would spill past two rows — a kitchen-sink
 *  rerun (all one rarity, run-to-pity-for-a-selector, so reading order is moot). Cap
 *  it at two rows and let it scroll horizontally instead of growing tall. */
const FEATURED_SCROLL_THRESHOLD = 12;
const TICKET_LABEL: Record<CommitContext["kind"], string> = { support: "Support Tickets", trainee: "Trainee Tickets" };

/** The surface header text — kind + run. The banner artwork is gone from the body
 *  (the player just clicked the banner to get here), so identity lives in the title. */
export function commitTitle(ctx: CommitContext): string {
  return `${TITLE[ctx.kind]} · ${formatDate(ctx.start)} – ${formatDate(ctx.end)}`;
}

/** One featured card: art, rarity badge, attribute pip (supports), and name. When
 *  `onInspect` is given the card body is a button opening that atom's detail
 *  surface (twinkle-monthly step 1); otherwise it's an inert block. */
function featuredCard(atom: CommitAtom, onInspect?: (atom: CommitAtom) => void): HTMLElement {
  const art = h(
    "div",
    { class: "commit-dossier__card-art" },
    atom.image
      ? h("img", { class: "commit-dossier__card-img", attr: { src: atom.image, alt: "", loading: "lazy" } })
      : h("div", { class: "commit-dossier__card-img commit-dossier__card-img--empty", attr: { "aria-hidden": "true" } }),
    h("span", { class: `commit-dossier__rarity commit-dossier__rarity--${atom.rarityTier}` }, atom.rarity),
    atom.attribute
      ? h("img", { class: "commit-dossier__attr", attr: { src: `/icons/old/${atom.attribute}.png`, alt: atom.attribute, width: 18, height: 18, loading: "lazy" } })
      : null,
  );
  const name = h("span", { class: "commit-dossier__card-name" }, atom.name);

  const body = onInspect
    ? h(
        "button",
        {
          class: "commit-dossier__card-inspect",
          attr: { type: "button", "aria-label": `Inspect ${atom.name}` },
          on: { click: () => onInspect(atom) },
        },
        art,
        name,
      )
    : null;

  return h(
    "li",
    { class: `commit-dossier__card commit-dossier__card--${atom.rarityTier}` },
    body ?? art,
    body ? null : name,
  );
}

/** Display floor, mirroring the resources surface: non-free-carat resources read a
 *  floor of 0 (you can't hold negative stock); only free carats — the overflow
 *  release valve — may read negative (project_spend_model). */
function floorDisplay(value: number, freeCarats: boolean): number {
  return freeCarats ? value : Math.max(0, value);
}

/** Write an "after" value, reddening free carats when the reservation has driven them
 *  negative — an overcommitment (you've planned more than the predicted balance
 *  covers). Other sources floor at 0, so they never redden. */
function setAfter(el: HTMLElement, value: number, freeCarats: boolean): void {
  const shown = floorDisplay(value, freeCarats);
  el.textContent = formatBalance(shown);
  el.classList.toggle("commit-dossier__impact-value--negative", shown < 0);
}

/** One Resource Impact line — icon, before → after (after re-rendered on commit). */
function impactLine(icon: string, label: string, value: HTMLElement): HTMLElement {
  const iconEl = icon.startsWith("/")
    ? h("img", { class: "commit-dossier__impact-icon", attr: { src: icon, alt: "", width: 26, height: 26 } })
    : h("span", { class: "commit-dossier__impact-icon commit-dossier__impact-icon--glyph", attr: { "aria-hidden": "true" } }, icon);
  return h(
    "div",
    { class: "commit-dossier__impact-line" },
    iconEl,
    value,
    h("span", { class: "commit-dossier__impact-label" }, label),
  );
}

export function commitDossier(opts: CommitDossierOpts): HTMLElement {
  const { context: ctx } = opts;
  let pity = ctx.committedPity ?? 0;
  // The paid-spend opt-in (#65): off by default (keep the frugal discount-only model),
  // seeded from the stored commitment so re-opening a paid plan stays paid.
  let usePaid = ctx.committedUsePaid;

  // YOUR PLAN — the stepper read-backs.
  const pityValue = h("span", { class: "commit-dossier__pity-value" }, String(pity));
  // The pity box wears the shared pity-band fill (grey/green/purple/red), same rule
  // as the timeline commitment badge — recoloured as pity changes in render().
  const pityBox = h("div", { class: "commit-dossier__pity" }, pityValue);
  const committedLabel = h("span", { class: "commit-dossier__plan-heading" });
  const reservedLabel = h("p", { class: "commit-dossier__reserved" });

  // RESOURCE IMPACT — the "after" column, re-rendered as pity changes.
  const afterFree = h("span", { class: "commit-dossier__impact-value" });
  const afterPaid = h("span", { class: "commit-dossier__impact-value" });
  const afterTickets = h("span", { class: "commit-dossier__impact-value" });
  const afterGiftPulls = h("span", { class: "commit-dossier__impact-value" });

  // FORECAST — the target-copy distribution, redrawn as pity changes.
  const forecast = forecastWidget({ pullsPerPity: ctx.sparkThreshold, featuredRate: ctx.featuredRate, maxCopies: ctx.maxCopies }, ctx.kind);

  const render = (): void => {
    pityValue.textContent = String(pity);
    committedLabel.textContent = `${formatBalance(pity)} PITY COMMITTED`;
    reservedLabel.textContent = `${formatBalance(pity * ctx.sparkThreshold)} pulls reserved for this banner`;
    const after = reserve(ctx, pity, usePaid);
    setAfter(afterFree, after.freeCarats, true);
    setAfter(afterPaid, after.paidCarats, false);
    setAfter(afterTickets, after.tickets, false);
    setAfter(afterGiftPulls, after.freePulls, false);
    pityBox.className = `commit-dossier__pity pity-band--${pityBand(pity, after.freeCarats < 0, PITY_WASTE_ABOVE[ctx.kind])}`;
    forecast.update(pity);
  };

  const step = (delta: number): void => {
    pity = Math.max(0, pity + delta);
    render();
  };

  // The paid-spend opt-in: by default paid carats only leave through the daily discount
  // window; ticking this spends owned paid carats at full price toward the target before
  // free carats surge negative (#65). Re-renders the Resource Impact "after" column.
  const paidToggle = checkbox({
    title: "Spend paid carats at full price",
    checked: usePaid,
    locked: false,
    onToggle: (checked) => {
      usePaid = checked;
      render();
    },
  });

  render();

  return h(
    "section",
    { class: "commit-dossier" },

    // Title hero — kind + run, self-rendered (the window title bar is dropped like
    // the other surfaces; Cancel handles dismissal).
    h(
      "header",
      { class: "commit-dossier__mast" },
      h("h2", { class: "commit-dossier__title" }, TITLE[ctx.kind]),
      h("p", { class: "commit-dossier__dates" }, `${formatDate(ctx.start)} – ${formatDate(ctx.end)}`),
    ),

    // FEATURED CARDS: the hero answer to "what am I pulling for?" (the banner
    // artwork is gone — the player just clicked it).
    h(
      "div",
      { class: "commit-dossier__featured" },
      h("span", { class: "commit-dossier__section-label" }, "Featured"),
      h(
        "ul",
        { class: `commit-dossier__cards${ctx.atoms.length > FEATURED_SCROLL_THRESHOLD ? " commit-dossier__cards--scroll" : ""}` },
        ...ctx.atoms.map((atom) => featuredCard(atom, opts.onInspect)),
      ),
    ),

    // 3 — YOUR PLAN + FORECAST, side by side: the outcome the pity buys reads right
    // where the player is dialling it (and it reclaims the vertical space).
    h(
      "div",
      { class: "commit-dossier__plan-row" },
      h(
        "div",
        { class: "commit-dossier__plan" },
        h("span", { class: "commit-dossier__section-label" }, "Your Plan"),
        committedLabel,
        h(
          "div",
          { class: "commit-dossier__stepper" },
          h("button", { class: "commit-dossier__step", attr: { type: "button", "aria-label": "Less pity" }, on: { click: () => step(-1) } }, "−"),
          pityBox,
          h("button", { class: "commit-dossier__step", attr: { type: "button", "aria-label": "More pity" }, on: { click: () => step(1) } }, "+"),
        ),
        reservedLabel,
      ),
      h(
        "div",
        { class: "commit-dossier__forecast" },
        h("span", { class: "commit-dossier__section-label" }, "Forecast"),
        forecast.el,
      ),
    ),

    // 4 — RESOURCE IMPACT: predicted-available → after-commitment.
    h(
      "div",
      { class: "commit-dossier__impact" },
      h("span", { class: "commit-dossier__section-label" }, "Resource Impact"),
      h(
        "p",
        { class: "commit-dossier__impact-copy" },
        "Horsetrader looks at what you should have on this banner's last day, then sets your plan aside from the first day so later banners cannot spend it twice.",
      ),
      paidToggle,
      h(
        "div",
        { class: "commit-dossier__impact-grid" },
        h(
          "div",
          { class: "commit-dossier__impact-col" },
          h("span", { class: "commit-dossier__impact-heading" }, "Predicted Available"),
          impactLine("🎁", "Gift Pulls", h("span", { class: "commit-dossier__impact-value" }, formatBalance(floorDisplay(ctx.freePulls, false)))),
          impactLine("/icons/carat.png", "Carats", h("span", { class: "commit-dossier__impact-value" }, formatBalance(floorDisplay(ctx.freeCarats, true)))),
          impactLine(`/icons/${ctx.kind}_ticket.png`, TICKET_LABEL[ctx.kind], h("span", { class: "commit-dossier__impact-value" }, formatBalance(floorDisplay(ctx.tickets, false)))),
          impactLine("/icons/carat.png", "Paid Carats", h("span", { class: "commit-dossier__impact-value" }, formatBalance(floorDisplay(ctx.paidCarats, false)))),
        ),
        h("span", { class: "commit-dossier__impact-arrow", attr: { "aria-hidden": "true" } }, "→"),
        h(
          "div",
          { class: "commit-dossier__impact-col" },
          h("span", { class: "commit-dossier__impact-heading" }, "After Commitment"),
          impactLine("🎁", "Gift Pulls", afterGiftPulls),
          impactLine("/icons/carat.png", "Carats", afterFree),
          impactLine(`/icons/${ctx.kind}_ticket.png`, TICKET_LABEL[ctx.kind], afterTickets),
          impactLine("/icons/carat.png", "Paid Carats", afterPaid),
        ),
      ),
    ),

    // Save writes the pity through to the commitments map; 0 clears it.
    surfaceActions(
      surfaceCancel({
        class: "commit-dossier__cancel",
        onCancel: opts.onClose,
        // Pristine ⇒ Esc backs out; a dialled-but-unsaved pity/paid draft is a pending
        // decision, so Esc holds and Cancel stays the deliberate way out.
        escSafe: () => pity === (ctx.committedPity ?? 0) && usePaid === ctx.committedUsePaid,
      }),
      h(
        "button",
        {
          class: "commit-dossier__save",
          attr: { type: "button" },
          on: {
            click: () => {
              opts.onCommit(pity === 0 ? null : pity, usePaid);
              opts.onClose();
            },
          },
        },
        "Save Plan",
      ),
    ),
  );
}
