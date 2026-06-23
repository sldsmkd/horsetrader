import "./clubSelector.css";

import { h } from "../../h.ts";
import { pressedGroup } from "../widgets/pressedGroup.ts";
import { surfaceActions } from "./surfaceActions.ts";
import { surfaceCancel } from "./surface.ts";
import { CLUB_RANK_TIERS, DEFAULT_CLUB_RANK } from "../../../core/identity/clubrank.ts";
import { CLUB_NAME_MAX, normaliseName } from "../../../core/persistence/validate.ts";
import type { ClubRankTier } from "../../../core/identity/clubrank.ts";

// The modal badge per rank. The icon ladder runs club_rank_01 (D) → _11 (SS),
// but the reward map — and so `CLUB_RANK_TIERS` — starts at D+, so _01 is unused
// (D earns nothing). Keyed by tier rather than computed off the index so a
// reorder of the ladder can't silently slide every badge.
const CLUB_RANK_ICON: Record<ClubRankTier, string> = {
  "D+": "/icons/club_rank_02.webp",
  C: "/icons/club_rank_03.webp",
  "C+": "/icons/club_rank_04.webp",
  B: "/icons/club_rank_05.webp",
  "B+": "/icons/club_rank_06.webp",
  A: "/icons/club_rank_07.webp",
  "A+": "/icons/club_rank_08.webp",
  S: "/icons/club_rank_09.webp",
  "S+": "/icons/club_rank_10.webp",
  SS: "/icons/club_rank_11.webp",
};

/** The badge asset for a resolved club rank — the trainer sheet and the modal share it. */
export function clubRankIcon(tier: ClubRankTier): string {
  return CLUB_RANK_ICON[tier];
}

export interface ClubSelectorOpts {
  /** The current membership to seed from, or `null` when the trainer isn't in a club. */
  club: { name: string; rank: ClubRankTier } | null;
  onCommit: (club: { name: string; rank: ClubRankTier }) => void;
  onLeave: () => void;
  onClose: () => void;
}

/**
 * The club modal: a single modal that edits both halves of the club identity —
 * the free-text name and the rank badge (a `reward_maps.club-rank` selector). Same
 * shape as the oshi selector (a grid of pressable badges + an OK that commits and
 * closes), with a name field on top. When already in a club a Leave action clears
 * membership; a fresh join seeds the name blank and the rank at the default tier.
 */
export function clubSelector(opts: ClubSelectorOpts): HTMLElement {
  const inClub = opts.club !== null;
  const initialRank = opts.club?.rank ?? DEFAULT_CLUB_RANK;
  let selectedRank = initialRank;
  const buttons = new Map<ClubRankTier, HTMLButtonElement>();
  const setPressed = pressedGroup(buttons, "club-selector__option--selected");

  const name = h("input", {
    class: "club-selector__name",
    attr: {
      type: "text",
      value: opts.club?.name ?? "",
      placeholder: "Club name",
      "aria-label": "Club name",
      autocomplete: "off",
    },
  });
  // Clamp every keystroke (and paste) to the safe set + grapheme cap via the shared
  // name normaliser — the same path as the trainer name. `maxlength` can't do this:
  // it counts UTF-16 units, so it would slice an emoji mid-sequence.
  name.addEventListener("input", () => {
    const clean = normaliseName(name.value, CLUB_NAME_MAX);
    if (clean !== name.value) {
      name.value = clean;
      name.setSelectionRange(clean.length, clean.length);
    }
  });
  const commit = (): void => {
    opts.onCommit({ name: name.value.trim() || "Club", rank: selectedRank });
    opts.onClose();
  };
  // Enter = "I'm done": commit the membership, the same as clicking OK/Join.
  name.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  });

  const optionButton = (tier: ClubRankTier): HTMLButtonElement => {
    const selected = tier === selectedRank;
    return h(
      "button",
      {
        class: `club-selector__option${selected ? " club-selector__option--selected" : ""}`,
        attr: { type: "button", "aria-pressed": String(selected) },
        on: {
          click: () => {
            selectedRank = tier;
            setPressed(tier);
          },
        },
      },
      h("img", { class: "club-selector__icon", attr: { src: CLUB_RANK_ICON[tier], alt: "", width: 72, height: 80 } }),
      h("span", { class: "club-selector__rank" }, tier),
    );
  };

  const grid = h(
    "div",
    { class: "club-selector__grid", attr: { role: "group", "aria-label": "Club rank" } },
    ...CLUB_RANK_TIERS.map((tier) => {
      const button = optionButton(tier);
      buttons.set(tier, button);
      return button;
    }),
  );
  const leaveButton = h(
    "button",
    {
      class: "club-selector__leave",
      attr: { type: "button" },
      on: {
        click: () => {
          opts.onLeave();
          opts.onClose();
        },
      },
    },
    "Leave club",
  );

  return h(
    "section",
    { class: "club-selector" },
    h("h2", { class: "club-selector__title" }, inClub ? "Edit Club" : "Join Club"),
    h(
      "label",
      { class: "club-selector__field" },
      h("span", { class: "club-selector__label" }, "Club name"),
      name,
    ),
    grid,
    surfaceActions(
      ...(inClub ? [leaveButton] : []),
      // Esc backs out while name + rank still match the membership as opened; an edited
      // name or a re-picked rank is pending, so Esc holds.
      surfaceCancel({
        class: "club-selector__cancel",
        onCancel: opts.onClose,
        escSafe: () => name.value === name.defaultValue && selectedRank === initialRank,
      }),
      h(
        "button",
        {
          class: "club-selector__ok",
          attr: { type: "button" },
          on: { click: commit },
        },
        inClub ? "OK" : "Join",
      ),
    ),
  );
}
