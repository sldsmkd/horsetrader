/**
 * Scenario context for the view-centre date. Scenario records are launch beats
 * (start=end in the bake), so the active scenario is the latest launch at or
 * before the date.
 */

import { daysBetween } from "../../core/projection/dates.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import type { Bundle, EventRecord } from "../bundle/access.ts";

const SCENARIO_INCOMING_RAMP_DAYS = 4;
const SCENARIO_NEGATIVE_SPACE_DAYS = 6;
const SCENARIO_FADE_OUT_DAYS = 10;

export interface ScenarioContext {
  key: string;
  title: string;
  image: string;
  date: CalendarDate;
  predicted: boolean;
  fadeToBlack: number;
}

type ScenarioEvent = Extract<EventRecord, { type: "scenario" }>;
interface ScenarioEntry {
  key: string;
  title: string;
  image: string;
  date: CalendarDate;
  predicted: boolean;
  nextDate: CalendarDate | null;
}
export type ScenarioLookup = (date: CalendarDate) => ScenarioContext | null;

function isDisplayableScenario(event: EventRecord): event is ScenarioEvent {
  return event.type === "scenario" && (event.art !== null || event.image !== null);
}

export function activeScenario(bundle: Bundle, date: CalendarDate): ScenarioContext | null {
  return scenarioLookup(bundle)(date);
}

export function scenarioLookup(bundle: Bundle): ScenarioLookup {
  const displayable = bundle.all().filter(isDisplayableScenario);
  const scenarios: ScenarioEntry[] = displayable.map((event, i) => ({
    key: event.key,
    title: event.title ?? event.key,
    image: event.art ?? event.image ?? "",
    date: event.start,
    predicted: event.predicted,
    nextDate: displayable[i + 1]?.start ?? null,
  }));

  return (date) => {
    let active: ScenarioEntry | null = null;
    let upcoming: ScenarioEntry | null = null;
    for (const scenario of scenarios) {
      if (scenario.date > date) {
        upcoming = scenario;
        break;
      }
      active = scenario;
    }
    if (active === null) return null;
    if (upcoming !== null) {
      const remaining = daysBetween(date, upcoming.date);
      if (remaining <= SCENARIO_INCOMING_RAMP_DAYS) {
        return context(upcoming, remaining / SCENARIO_INCOMING_RAMP_DAYS);
      }
    }
    return context(active, fadeToBlack(date, active.nextDate));
  };
}

function fadeToBlack(date: CalendarDate, nextDate: CalendarDate | null): number {
  if (nextDate === null) return 0;
  const remaining = daysBetween(date, nextDate);
  const fullyFadedAt = SCENARIO_INCOMING_RAMP_DAYS + SCENARIO_NEGATIVE_SPACE_DAYS;
  const start = fullyFadedAt + SCENARIO_FADE_OUT_DAYS;
  if (remaining >= start) return 0;
  if (remaining <= fullyFadedAt) return 1;
  return (start - remaining) / SCENARIO_FADE_OUT_DAYS;
}

function context(entry: ScenarioEntry, fadeToBlack: number): ScenarioContext {
  return {
    key: entry.key,
    title: entry.title,
    image: entry.image,
    date: entry.date,
    predicted: entry.predicted,
    fadeToBlack: Math.max(0, Math.min(1, fadeToBlack)),
  };
}
