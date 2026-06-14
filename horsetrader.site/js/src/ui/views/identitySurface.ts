import "./identitySurface.css";

import { h } from "../h.ts";
import { playStylePresetGrid } from "./playStylePreset.ts";
import { clubRankIcon } from "./clubSelector.ts";
import type { PlayStyleKey } from "./playStylePreset.ts";
import type { ClubIdentity } from "../../core/identity/clubrank.ts";
import type { PlayStyleStrings } from "../strings.ts";

export interface IdentitySurfaceOpts {
  trainerName: string;
  trainerId: string;
  oshiName: string;
  oshiPortrait: string;
  club: ClubIdentity | null;
  playStyleKey: PlayStyleKey;
  savedPlayStyleKey: PlayStyleKey;
  playStyleStrings: PlayStyleStrings;
  onTrainerNameChange: (name: string) => void;
  onTrainerIdChange: (id: string) => void;
  onOshiSelect: () => void;
  onClubSelect: () => void;
  onPlayStylePreview: (key: PlayStyleKey) => void;
}

// Trainer ID is a 12-digit handle grouped 3-3-3-3 (display only — it's optional
// and never validated). It's also screenshot-sensitive, so the value sits behind
// a heavy blur whenever the field isn't actively being edited: clicking the
// pencil (or the field) is the deliberate reveal, and like a banking app it
// re-blurs on blur and after an idle timeout so a stray screenshot stays safe.
const ID_GROUP_LEN = 3;
const ID_GROUPS = 4;
const ID_MAX_DIGITS = ID_GROUP_LEN * ID_GROUPS;
const ID_PLACEHOLDER = "???-???-???-???";
const ID_REVEAL_MS = 15_000;

function formatTrainerId(digits: string): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += ID_GROUP_LEN) groups.push(digits.slice(i, i + ID_GROUP_LEN));
  return groups.join("-");
}

// Trainer name entry is clamped at the keystroke: at most 24 *grapheme clusters*
// (so a ZWJ emoji counts as one and never gets sliced mid-sequence), drawn from a
// safe set — letters, numbers, spaces, and emoji (pictographs + their modifiers,
// regional-indicator flag pairs, and the ZWJ/variation-selector joiners that
// compose them). Everything else — control chars, combining marks (zalgo), RTL
// overrides — is dropped, so a pasted name can't smuggle layout-breaking junk in.
const NAME_MAX_GRAPHEMES = 24;
const NAME_ALLOWED =
  /[\p{L}\p{N} \p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F]/gu;
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

function graphemes(s: string): string[] {
  return graphemeSegmenter ? [...graphemeSegmenter.segment(s)].map((seg) => seg.segment) : [...s];
}

function sanitizeTrainerName(raw: string): string {
  const kept = (raw.normalize("NFC").match(NAME_ALLOWED) ?? []).join("");
  return graphemes(kept).slice(0, NAME_MAX_GRAPHEMES).join("");
}

function identityRow(label: string, value: string, detail?: string): HTMLElement {
  return h(
    "div",
    { class: "identity-surface__row" },
    h("span", { class: "identity-surface__label" }, label),
    h(
      "span",
      { class: "identity-surface__value" },
      value,
      detail && h("span", { class: "identity-surface__detail" }, detail),
    ),
  );
}

// The club row is a single click target that opens the club shield (name + rank),
// the same spawn pattern as the oshi portrait. In a club it shows the name with the
// rank badge as a trailing chip; with no club it reads a muted "No club" and still
// opens the shield (to join).
function clubRow(opts: IdentitySurfaceOpts): HTMLElement {
  const club = opts.club;
  const body = club
    ? [
        h("span", { class: "identity-surface__club-name" }, club.name),
        h("img", {
          class: "identity-surface__club-rank",
          attr: { src: clubRankIcon(club.rank), alt: club.rank, width: 28, height: 31 },
        }),
      ]
    : [h("span", { class: "identity-surface__club-name identity-surface__club-empty" }, "No club")];
  return h(
    "div",
    { class: "identity-surface__row" },
    h("span", { class: "identity-surface__label" }, "Club"),
    h(
      "button",
      {
        class: "identity-surface__value identity-surface__club",
        attr: { type: "button", "aria-label": club ? "Edit club" : "Join a club", title: club ? "Edit club" : "Join a club" },
        on: { click: opts.onClubSelect },
      },
      ...body,
    ),
  );
}

function editableTrainerName(opts: IdentitySurfaceOpts): HTMLElement {
  const input = h("input", {
    class: "identity-surface__name-input",
    attr: { type: "text", value: opts.trainerName, "aria-label": "Trainer name" },
  });
  // Clamp every keystroke (and paste) to the safe set + 16-grapheme cap. `maxlength`
  // can't do this — it counts UTF-16 units, so it would slice emoji mid-sequence.
  input.addEventListener("input", () => {
    const clean = sanitizeTrainerName(input.value);
    if (clean !== input.value) {
      input.value = clean;
      input.setSelectionRange(clean.length, clean.length);
    }
  });
  const commit = (): void => {
    const name = sanitizeTrainerName(input.value).trim() || "Trainer";
    input.value = name;
    if (name !== opts.trainerName) opts.onTrainerNameChange(name);
  };
  input.addEventListener("change", commit);
  input.addEventListener("blur", commit);

  return h(
    "label",
    { class: "identity-surface__editable" },
    input,
    h(
      "button",
      {
        class: "identity-surface__edit",
        attr: { type: "button", "aria-label": "Edit trainer name", title: "Edit trainer name" },
        on: { click: () => input.focus() },
      },
      "✏️",
    ),
  );
}

function editableTrainerId(opts: IdentitySurfaceOpts): HTMLElement {
  const input = h("input", {
    class: "identity-surface__id-input",
    attr: {
      type: "text",
      inputmode: "numeric",
      autocomplete: "off",
      placeholder: ID_PLACEHOLDER,
      "aria-label": "Trainer ID (optional)",
      value: formatTrainerId(opts.trainerId),
      size: ID_MAX_DIGITS + ID_GROUPS - 1,
      readonly: true,
    },
  });

  let revealed = false;
  let timer: number | undefined;

  const clearTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  // Re-blur on idle so a revealed ID doesn't linger on screen.
  const armTimer = (): void => {
    clearTimer();
    timer = window.setTimeout(() => input.blur(), ID_REVEAL_MS);
  };
  const mask = (): void => {
    input.classList.toggle("identity-surface__id-input--masked", !revealed && /\d/.test(input.value));
  };
  const caretToEnd = (): void => input.setSelectionRange(input.value.length, input.value.length);

  const reveal = (): void => {
    revealed = true;
    input.readOnly = false;
    mask();
    input.focus();
    caretToEnd();
    armTimer();
  };

  // Reveal is always deliberate (pencil or tapping the field); a read-only field
  // can't take a caret on its own, so we drive focus ourselves.
  input.addEventListener("pointerdown", (ev) => {
    if (revealed) return;
    ev.preventDefault();
    reveal();
  });
  input.addEventListener("input", () => {
    input.value = formatTrainerId(input.value.replace(/\D/g, "").slice(0, ID_MAX_DIGITS));
    caretToEnd();
    armTimer();
  });
  input.addEventListener("blur", () => {
    clearTimer();
    revealed = false;
    input.readOnly = true;
    const digits = input.value.replace(/\D/g, "").slice(0, ID_MAX_DIGITS);
    input.value = formatTrainerId(digits);
    mask();
    if (digits !== opts.trainerId) opts.onTrainerIdChange(digits);
  });

  mask();

  return h(
    "div",
    { class: "identity-surface__row" },
    h("span", { class: "identity-surface__label" }, "ID (Optional)"),
    h(
      "span",
      { class: "identity-surface__value identity-surface__id" },
      h(
        "button",
        {
          class: "identity-surface__edit",
          attr: { type: "button", "aria-label": "Edit trainer ID", title: "Edit trainer ID" },
          on: { click: () => !revealed && reveal() },
        },
        "✏️",
      ),
      input,
    ),
  );
}

function playStyle(opts: IdentitySurfaceOpts): HTMLElement {
  return playStylePresetGrid({
    selectedKey: opts.playStyleKey,
    activeKey: opts.savedPlayStyleKey,
    strings: opts.playStyleStrings,
    onPreview: opts.onPlayStylePreview,
  });
}

export function identitySurface(opts: IdentitySurfaceOpts): HTMLElement {
  return h(
    "section",
    { class: "identity-surface" },
    h(
      "div",
      { class: "identity-surface__card" },
      h(
        "button",
        {
          class: "identity-surface__portrait",
          attr: { type: "button", "aria-label": "Choose oshi", title: "Choose oshi" },
          on: { click: opts.onOshiSelect },
        },
        h("img", { attr: { src: opts.oshiPortrait, alt: "", width: 256, height: 512 } }),
        h("span", { class: "identity-surface__portrait-edit", attr: { "aria-hidden": "true" } }, "✏️"),
      ),
      h(
        "div",
        { class: "identity-surface__details" },
        h(
          "div",
          { class: "identity-surface__title" },
          editableTrainerName(opts),
        ),
        h(
          "div",
          { class: "identity-surface__section" },
          editableTrainerId(opts),
          clubRow(opts),
          identityRow("Oshi", opts.oshiName),
        ),
      ),
    ),
    h(
      "div",
      { class: "identity-surface__playstyle" },
      h("span", { class: "identity-surface__label" }, "Play Style"),
      playStyle(opts),
    ),
  );
}
