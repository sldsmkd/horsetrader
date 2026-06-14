import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PLAY_STYLE_MACHINE_INITIAL,
  previewedPlayStyle,
  reducePlayStyleMachine,
} from "./playStyleMachine.ts";
import type { PlayStyleMachineState } from "./playStyleMachine.ts";

const saved = "focused";

test("identity menu toggles the whole identity family", () => {
  const open = reducePlayStyleMachine(PLAY_STYLE_MACHINE_INITIAL, { type: "toggle-identity" }, saved);
  assert.deepEqual(open, { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null });

  const withPlayStyle: PlayStyleMachineState = { overlay: "playstyle", stagedPlayStyle: "casual", stagedPlayStyleSettings: null };
  assert.deepEqual(reducePlayStyleMachine(withPlayStyle, { type: "toggle-identity" }, saved), PLAY_STYLE_MACHINE_INITIAL);

  const withOshi: PlayStyleMachineState = { overlay: "oshi", stagedPlayStyle: null, stagedPlayStyleSettings: null };
  assert.deepEqual(reducePlayStyleMachine(withOshi, { type: "toggle-identity" }, saved), PLAY_STYLE_MACHINE_INITIAL);

  const withPlayStyleOshi: PlayStyleMachineState = { overlay: "playstyle-oshi", stagedPlayStyle: "casual", stagedPlayStyleSettings: null };
  assert.deepEqual(
    reducePlayStyleMachine(withPlayStyleOshi, { type: "toggle-identity" }, saved),
    PLAY_STYLE_MACHINE_INITIAL,
  );
});

test("previewing an unsaved preset opens the playstyle page and enables staging", () => {
  const state = reducePlayStyleMachine(
    { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null },
    { type: "preview-playstyle", key: "casual" },
    saved,
  );

  assert.deepEqual(state, { overlay: "playstyle", stagedPlayStyle: "casual", stagedPlayStyleSettings: null });
  assert.equal(previewedPlayStyle(state, saved), "casual");
});

test("clicking the saved preset first reverts an unsaved preview, then closes the page", () => {
  const casual: PlayStyleMachineState = { overlay: "playstyle", stagedPlayStyle: "casual", stagedPlayStyleSettings: null };
  const reverted = reducePlayStyleMachine(casual, { type: "preview-playstyle", key: saved }, saved);
  assert.deepEqual(reverted, { overlay: "playstyle", stagedPlayStyle: null, stagedPlayStyleSettings: null });
  assert.equal(previewedPlayStyle(reverted, saved), saved);

  assert.deepEqual(reducePlayStyleMachine(reverted, { type: "preview-playstyle", key: saved }, saved), {
    overlay: "identity",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });
});

test("opening the saved preset stores no redundant staged value", () => {
  const state = reducePlayStyleMachine(
    { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null },
    { type: "preview-playstyle", key: saved },
    saved,
  );

  assert.deepEqual(state, { overlay: "playstyle", stagedPlayStyle: null, stagedPlayStyleSettings: null });
  assert.deepEqual(reducePlayStyleMachine(state, { type: "preview-playstyle", key: saved }, saved), {
    overlay: "identity",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });
});

test("discarding or committing returns to the trainer card with no staged preset", () => {
  const state: PlayStyleMachineState = { overlay: "playstyle", stagedPlayStyle: "dedicated", stagedPlayStyleSettings: null };
  assert.deepEqual(reducePlayStyleMachine(state, { type: "discard-playstyle" }, saved), {
    overlay: "identity",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });
  assert.deepEqual(reducePlayStyleMachine(state, { type: "commit-playstyle" }, saved), {
    overlay: "identity",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });
});

test("commit-playstyle-stay clears staging but keeps the play-style page open (custom tweaker)", () => {
  const state: PlayStyleMachineState = { overlay: "playstyle", stagedPlayStyle: "custom", stagedPlayStyleSettings: null };
  assert.deepEqual(reducePlayStyleMachine(state, { type: "commit-playstyle-stay" }, saved), {
    overlay: "playstyle",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });
});

test("previewing custom opens the playstyle page like any other preset", () => {
  const state = reducePlayStyleMachine(
    { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null },
    { type: "preview-playstyle", key: "custom" },
    saved,
  );

  assert.deepEqual(state, { overlay: "playstyle", stagedPlayStyle: "custom", stagedPlayStyleSettings: null });
  assert.equal(previewedPlayStyle(state, saved), "custom");
});

test("custom as saved preset follows the same toggle logic as other presets", () => {
  const savedCustom = "custom" as const;
  const open = reducePlayStyleMachine(
    { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null },
    { type: "preview-playstyle", key: "custom" },
    savedCustom,
  );
  assert.deepEqual(open, { overlay: "playstyle", stagedPlayStyle: null, stagedPlayStyleSettings: null });

  const closed = reducePlayStyleMachine(open, { type: "preview-playstyle", key: "custom" }, savedCustom);
  assert.deepEqual(closed, { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null });
});

test("oshi selector is modal over the current identity surface", () => {
  const trainerOshi = reducePlayStyleMachine(
    { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null },
    { type: "open-oshi" },
    saved,
  );
  assert.deepEqual(trainerOshi, { overlay: "oshi", stagedPlayStyle: null, stagedPlayStyleSettings: null });
  assert.deepEqual(reducePlayStyleMachine(trainerOshi, { type: "close-oshi" }, saved), {
    overlay: "identity",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });

  const playStyleOshi = reducePlayStyleMachine(
    { overlay: "playstyle", stagedPlayStyle: "casual", stagedPlayStyleSettings: null },
    { type: "open-oshi" },
    saved,
  );
  assert.deepEqual(playStyleOshi, { overlay: "playstyle-oshi", stagedPlayStyle: "casual", stagedPlayStyleSettings: null });
  assert.deepEqual(reducePlayStyleMachine(playStyleOshi, { type: "close-oshi" }, saved), {
    overlay: "playstyle",
    stagedPlayStyle: "casual",
    stagedPlayStyleSettings: null,
  });
});

test("club selector is modal over the current identity surface", () => {
  const trainerClub = reducePlayStyleMachine(
    { overlay: "identity", stagedPlayStyle: null, stagedPlayStyleSettings: null },
    { type: "open-club" },
    saved,
  );
  assert.deepEqual(trainerClub, { overlay: "club", stagedPlayStyle: null, stagedPlayStyleSettings: null });
  assert.deepEqual(reducePlayStyleMachine(trainerClub, { type: "close-club" }, saved), {
    overlay: "identity",
    stagedPlayStyle: null,
    stagedPlayStyleSettings: null,
  });

  const playStyleClub = reducePlayStyleMachine(
    { overlay: "playstyle", stagedPlayStyle: "casual", stagedPlayStyleSettings: null },
    { type: "open-club" },
    saved,
  );
  assert.deepEqual(playStyleClub, { overlay: "playstyle-club", stagedPlayStyle: "casual", stagedPlayStyleSettings: null });
  assert.deepEqual(reducePlayStyleMachine(playStyleClub, { type: "close-club" }, saved), {
    overlay: "playstyle",
    stagedPlayStyle: "casual",
    stagedPlayStyleSettings: null,
  });
});
