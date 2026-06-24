/* eslint-disable */
/**
 * Generated from the baked events.json by `npm run gen:landing`.
 * DO NOT EDIT BY HAND — re-run generation after a re-bake.
 *
 * Prebaked landing-screen data: the PROXY timeline span and the scenario launch schedule, so the
 * shell can lay out + preload the landing view before the bundle folds. The real layout corrects
 * the span; this only has to be a proxy.
 */
import type { CalendarDate } from "../projection/dates.ts";

export const BAKED_EXTENT: { readonly start: CalendarDate; readonly end: CalendarDate } = {
  start: "2025-06-26" as CalendarDate,
  end: "2029-03-26" as CalendarDate,
};

export const BAKED_SCENARIOS: readonly { readonly start: CalendarDate; readonly image: string }[] = [
  { start: "2025-06-26" as CalendarDate, image: "/img/scenarios/scenario-01.webp" },
  { start: "2025-11-06" as CalendarDate, image: "/img/scenarios/scenario-02.webp" },
  { start: "2026-03-12" as CalendarDate, image: "/img/scenarios/scenario-03.webp" },
  { start: "2026-07-20" as CalendarDate, image: "/img/scenarios/scenario-04.webp" },
  { start: "2026-11-26" as CalendarDate, image: "/img/scenarios/scenario-05.webp" },
  { start: "2027-04-01" as CalendarDate, image: "/img/scenarios/scenario-06.webp" },
  { start: "2027-08-09" as CalendarDate, image: "/img/scenarios/scenario-07.webp" },
  { start: "2027-11-04" as CalendarDate, image: "/img/scenarios/scenario-08.webp" },
  { start: "2028-01-27" as CalendarDate, image: "/img/scenarios/scenario-09.webp" },
  { start: "2028-04-24" as CalendarDate, image: "/img/scenarios/scenario-10.webp" },
  { start: "2028-07-20" as CalendarDate, image: "/img/scenarios/scenario-11.webp" },
  { start: "2028-10-12" as CalendarDate, image: "/img/scenarios/scenario-12.webp" },
  { start: "2029-01-08" as CalendarDate, image: "/img/scenarios/scenario-13.webp" },
];
