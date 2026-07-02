import { test } from "node:test";
import assert from "node:assert/strict";

import { draggedFrameIndex, filmFrames, focusIndex } from "./filmstrip.ts";
import type { FilmFrame } from "./filmstrip.ts";
import { createBundle } from "../bundle/access.ts";
import { TEST_CONFIG } from "../bundle/fixtures.ts";
import type { Academy } from "../../core/bundle/academy.gen.ts";
import type { EventsBundle } from "../../core/bundle/events.gen.ts";
import { cal } from "../../core/projection/dates.ts";

const frame = (date: string): FilmFrame => ({ date: cal(date), kind: "trainee", state: "bookmark", past: false, atom: null, group: date, band: "empty", heat: 0 });

const FRAMES = [frame("2027-01-01"), frame("2027-03-01"), frame("2027-06-01")];

test("focusIndex returns -1 for an empty strip", () => {
  assert.equal(focusIndex([], cal("2027-01-01")), -1);
});

test("focusIndex centres on the nearest frame in real time", () => {
  assert.equal(focusIndex(FRAMES, cal("2027-01-05")), 0);
  assert.equal(focusIndex(FRAMES, cal("2027-03-10")), 1);
  assert.equal(focusIndex(FRAMES, cal("2027-05-20")), 2);
});

test("focusIndex nearness is metric, not ordinal", () => {
  // Equidistant-in-sequence frames are NOT equidistant in time; the read-head
  // follows the calendar-nearest, so a view just past frame 0 stays on frame 0.
  assert.equal(focusIndex(FRAMES, cal("2027-01-25")), 0);
  assert.equal(focusIndex(FRAMES, cal("2027-02-15")), 1);
});

test("focusIndex clamps past the ends", () => {
  assert.equal(focusIndex(FRAMES, cal("2030-01-01")), 2);
  assert.equal(focusIndex(FRAMES, cal("2020-01-01")), 0);
});

test("filmstrip drag advances ordinally and clamps at its ends", () => {
  assert.equal(draggedFrameIndex(2, -51, 50, 6), 3);
  assert.equal(draggedFrameIndex(2, 51, 50, 6), 1);
  assert.equal(draggedFrameIndex(0, 500, 50, 6), 0);
  assert.equal(draggedFrameIndex(5, -500, 50, 6), 5);
  assert.equal(draggedFrameIndex(0, 10, 0, 0), -1);
});

// A story-only welfare support: it appears on no banner, but a favourite on it still
// earns a strip frame (warping to the story), neutral because it isn't pullable.
const STORY_EVENTS: EventsBundle = {
  events: [
    { type: "story", rushable: true, title: "Creek Story", contents: ["support-creek-welfare"], image: null, banner: null, art: null, era: "1m", start: "2026-06-20", end: "2026-06-27", predicted: false, key: "story-creek" },
  ],
};
const STORY_ACADEMY: Academy = {
  characters: { "char-creek": { name: "Super Creek", quote: null, icon: null, portrait: null, bio: { three_sizes: { bust: null, waist: null, hips: null }, birthday: null, height: null } } },
  supports: { "support-creek-welfare": { character: "char-creek", display: "Super Creek", type: "stamina", rarity: "sr", title: "Welfare", release: "2021", thumbnail: null, art: null, aliases: [], source: null } },
  trainees: {},
  courses: {},
  races: {},
  racetracks: {}, selectors: {},
};
const storyBundle = () => createBundle(STORY_EVENTS, STORY_ACADEMY, TEST_CONFIG);

test("filmFrames includes a favourited story welfare — a bookmark beat, neutral (not pullable)", () => {
  const frames = filmFrames(storyBundle(), { "support-creek-welfare": {} }, {}, cal("2026-06-01"));
  assert.equal(frames.length, 1);
  const f = frames[0]!;
  assert.equal(f.atom?.id, "support-creek-welfare");
  assert.equal(f.kind, "support");
  assert.equal(f.state, "bookmark"); // welfare is never a commitment
  assert.equal(f.group, "story-creek"); // warps to the story
  assert.equal(f.band, "empty"); // no commitment band
  assert.equal(f.heat, 0); // not pullable → no heat
  assert.equal(f.past, false);
});

test("an unfavourited story welfare earns no frame", () => {
  assert.deepEqual(filmFrames(storyBundle(), {}, {}, cal("2026-06-01")), []);
});
