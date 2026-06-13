/**
 * The commit shield: a **banner dossier with a planning attachment** (the write
 * half of a banner's commitment; the balance editor / oshi selector are the
 * reference shields — [[feedback_shield_vs_unfold]]). It reads top-down in the
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

import "./commitShield.css";

import { h } from "../h.ts";
import { formatBalance, formatDate } from "../format.ts";
import { reserve, type CommitContext, type CommitAtom } from "../select/commit.ts";
import { forecastWidget } from "../widgets/forecast.ts";

export interface CommitShieldOpts {
  context: CommitContext;
  /** Commit a pity count, or `null` to clear the commitment entirely. */
  onCommit: (pity: number | null) => void;
  onClose: () => void;
}

const TITLE: Record<CommitContext["kind"], string> = { support: "Support Card Pickup", trainee: "Trainee Pickup" };

/** Above this many featured cards the grid would spill past two rows — a kitchen-sink
 *  rerun (all one rarity, run-to-pity-for-a-selector, so reading order is moot). Cap
 *  it at two rows and let it scroll horizontally instead of growing tall. */
const FEATURED_SCROLL_THRESHOLD = 12;
const TICKET_LABEL: Record<CommitContext["kind"], string> = { support: "Support Tickets", trainee: "Trainee Tickets" };

/** The overlay header text — kind + run. The banner artwork is gone from the body
 *  (the player just clicked the banner to get here), so identity lives in the title. */
export function commitTitle(ctx: CommitContext): string {
  return `${TITLE[ctx.kind]} · ${formatDate(ctx.start)} – ${formatDate(ctx.end)}`;
}

/** One featured card: art, rarity badge, attribute pip (supports), and name. */
function featuredCard(atom: CommitAtom): HTMLElement {
  return h(
    "li",
    { class: `commit-shield__card commit-shield__card--${atom.rarityTier}` },
    h(
      "div",
      { class: "commit-shield__card-art" },
      atom.image
        ? h("img", { class: "commit-shield__card-img", attr: { src: atom.image, alt: "", loading: "lazy" } })
        : h("div", { class: "commit-shield__card-img commit-shield__card-img--empty", attr: { "aria-hidden": "true" } }),
      h("span", { class: `commit-shield__rarity commit-shield__rarity--${atom.rarityTier}` }, atom.rarity),
      atom.attribute
        ? h("img", { class: "commit-shield__attr", attr: { src: `/icons/old/${atom.attribute}.png`, alt: atom.attribute, width: 18, height: 18, loading: "lazy" } })
        : null,
    ),
    h("span", { class: "commit-shield__card-name" }, atom.name),
  );
}

/** Write an "after" value, reddening it when the reservation has gone negative — an
 *  overcommitment (you've planned more than the predicted balance covers). */
function setAfter(el: HTMLElement, value: number): void {
  el.textContent = formatBalance(value);
  el.classList.toggle("commit-shield__impact-value--negative", value < 0);
}

/** One Resource Impact line — icon, before → after (after re-rendered on commit). */
function impactLine(icon: string, label: string, value: HTMLElement): HTMLElement {
  const iconEl = icon.startsWith("/")
    ? h("img", { class: "commit-shield__impact-icon", attr: { src: icon, alt: "", width: 26, height: 26 } })
    : h("span", { class: "commit-shield__impact-icon commit-shield__impact-icon--glyph", attr: { "aria-hidden": "true" } }, icon);
  return h(
    "div",
    { class: "commit-shield__impact-line" },
    iconEl,
    value,
    h("span", { class: "commit-shield__impact-label" }, label),
  );
}

export function commitShield(opts: CommitShieldOpts): HTMLElement {
  const { context: ctx } = opts;
  let pity = ctx.committedPity ?? 0;

  // YOUR PLAN — the stepper read-backs.
  const pityValue = h("span", { class: "commit-shield__pity-value" }, String(pity));
  const committedLabel = h("span", { class: "commit-shield__plan-heading" });
  const reservedLabel = h("p", { class: "commit-shield__reserved" });

  // RESOURCE IMPACT — the "after" column, re-rendered as pity changes.
  const afterFree = h("span", { class: "commit-shield__impact-value" });
  const afterPaid = h("span", { class: "commit-shield__impact-value" });
  const afterTickets = h("span", { class: "commit-shield__impact-value" });
  const afterGiftPulls = h("span", { class: "commit-shield__impact-value" });

  // FORECAST — the target-copy distribution, redrawn as pity changes.
  const forecast = forecastWidget({ pullsPerPity: ctx.sparkThreshold, featuredRate: ctx.featuredRate, maxCopies: ctx.maxCopies }, ctx.kind);

  const render = (): void => {
    pityValue.textContent = String(pity);
    committedLabel.textContent = `${formatBalance(pity)} PITY COMMITTED`;
    reservedLabel.textContent = `${formatBalance(pity * ctx.sparkThreshold)} pulls reserved for this banner`;
    const after = reserve(ctx, pity);
    setAfter(afterFree, after.freeCarats);
    setAfter(afterPaid, after.paidCarats);
    setAfter(afterTickets, after.tickets);
    setAfter(afterGiftPulls, after.freePulls);
    forecast.update(pity);
  };

  const step = (delta: number): void => {
    pity = Math.max(0, pity + delta);
    render();
  };

  render();

  return h(
    "section",
    { class: "commit-shield" },

    // FEATURED CARDS: the hero answer to "what am I pulling for?" (identity now
    // lives in the overlay title; the artwork is gone — the player just clicked it).
    h(
      "div",
      { class: "commit-shield__featured" },
      h("span", { class: "commit-shield__section-label" }, "Featured"),
      h(
        "ul",
        { class: `commit-shield__cards${ctx.atoms.length > FEATURED_SCROLL_THRESHOLD ? " commit-shield__cards--scroll" : ""}` },
        ...ctx.atoms.map(featuredCard),
      ),
    ),

    // 3 — YOUR PLAN + FORECAST, side by side: the outcome the pity buys reads right
    // where the player is dialling it (and it reclaims the vertical space).
    h(
      "div",
      { class: "commit-shield__plan-row" },
      h(
        "div",
        { class: "commit-shield__plan" },
        h("span", { class: "commit-shield__section-label" }, "Your Plan"),
        committedLabel,
        h(
          "div",
          { class: "commit-shield__stepper" },
          h("button", { class: "commit-shield__step", attr: { type: "button", "aria-label": "Less pity" }, on: { click: () => step(-1) } }, "−"),
          h("div", { class: "commit-shield__pity" }, pityValue),
          h("button", { class: "commit-shield__step", attr: { type: "button", "aria-label": "More pity" }, on: { click: () => step(1) } }, "+"),
        ),
        reservedLabel,
      ),
      h(
        "div",
        { class: "commit-shield__forecast" },
        h("span", { class: "commit-shield__section-label" }, "Forecast"),
        forecast.el,
      ),
    ),

    // 4 — RESOURCE IMPACT: predicted-available → after-commitment.
    h(
      "div",
      { class: "commit-shield__impact" },
      h("span", { class: "commit-shield__section-label" }, "Resource Impact"),
      h(
        "div",
        { class: "commit-shield__impact-grid" },
        h(
          "div",
          { class: "commit-shield__impact-col" },
          h("span", { class: "commit-shield__impact-heading" }, "Predicted Available"),
          impactLine("🎁", "Gift Pulls", h("span", { class: "commit-shield__impact-value" }, formatBalance(ctx.freePulls))),
          impactLine("/icons/carat.png", "Carats", h("span", { class: "commit-shield__impact-value" }, formatBalance(ctx.freeCarats))),
          impactLine(`/icons/${ctx.kind}_ticket.png`, TICKET_LABEL[ctx.kind], h("span", { class: "commit-shield__impact-value" }, formatBalance(ctx.tickets))),
          impactLine("/icons/carat.png", "Paid Carats", h("span", { class: "commit-shield__impact-value" }, formatBalance(ctx.paidCarats))),
        ),
        h("span", { class: "commit-shield__impact-arrow", attr: { "aria-hidden": "true" } }, "→"),
        h(
          "div",
          { class: "commit-shield__impact-col" },
          h("span", { class: "commit-shield__impact-heading" }, "After Commitment"),
          impactLine("🎁", "Gift Pulls", afterGiftPulls),
          impactLine("/icons/carat.png", "Carats", afterFree),
          impactLine(`/icons/${ctx.kind}_ticket.png`, TICKET_LABEL[ctx.kind], afterTickets),
          impactLine("/icons/carat.png", "Paid Carats", afterPaid),
        ),
      ),
    ),

    // Save writes the pity through to the commitments map; 0 clears it.
    h(
      "footer",
      { class: "commit-shield__actions" },
      h("button", { class: "commit-shield__cancel", attr: { type: "button" }, on: { click: opts.onClose } }, "Cancel"),
      h(
        "button",
        {
          class: "commit-shield__save",
          attr: { type: "button" },
          on: {
            click: () => {
              opts.onCommit(pity === 0 ? null : pity);
              opts.onClose();
            },
          },
        },
        "Save Plan",
      ),
    ),
  );
}
