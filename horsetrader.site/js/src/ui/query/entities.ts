/**
 * Entity search: build the menubar's find-and-warp lookup from the resolved
 * bundle seam. Pure view-model prep — labels, aliases, matching, and
 * first-appearance targets, with no DOM and no UI behavior.
 *
 * Part of the `ui/query` entity broker: components ask this for ranked entity
 * matches instead of joining bundle records themselves.
 */

import type { SupportRecord, TraineeRecord } from "../../core/bundle/academy.gen.ts";
import type { Bundle, EventRecord } from "../bundle/access.ts";
import type { CalendarDate } from "../../core/projection/dates.ts";
import { normalize, rankPrefixMatch } from "./match.ts";

export type SearchKind = "support" | "trainee";

export interface SearchResult {
  /** Stable academy id for the matched entity. */
  id: string;
  kind: SearchKind;
  /** Typeahead label, in the game's naming grammar. */
  label: string;
  /** First known timeline appearance for this entity. */
  date: CalendarDate;
  /** Event key for that first appearance, useful once selection/details exist. */
  eventKey: string;
}

interface SearchEntry extends SearchResult {
  haystack: string;
  identityHaystack: string;
}

export type SearchIndex = (query: string) => readonly SearchResult[];

function titleCase(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function supportLabel(id: string, support: SupportRecord): string {
  const rarity = (support.rarity ?? "").toUpperCase();
  const name = support.display ?? id;
  const type = titleCase(support.type);
  return [rarity, name].filter(Boolean).join(" ") + (type ? ` (${type})` : "");
}

function traineeLabel(id: string, trainee: TraineeRecord, bundle: Bundle): string {
  const character = bundle.character(trainee.character);
  const name = character.name ?? id;
  return trainee.variant ? `${name} (${trainee.variant})` : name;
}

function aliasesOf(record: unknown): readonly string[] {
  if (!record || typeof record !== "object" || !("aliases" in record)) return [];
  const aliases = (record as { aliases?: unknown }).aliases;
  return Array.isArray(aliases) ? aliases.filter((alias): alias is string => typeof alias === "string") : [];
}

function termsFor(...values: (string | null | undefined | readonly string[])[]): string {
  const flat = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
  return normalize(flat.filter((value): value is string => Boolean(value)).join(" "));
}

function sortResults(a: { entry: SearchEntry; rank: number }, b: { entry: SearchEntry; rank: number }): number {
  const kindOrder: Record<SearchKind, number> = { support: 0, trainee: 1 };
  return (
    a.rank - b.rank ||
    a.entry.date.localeCompare(b.entry.date) ||
    kindOrder[a.entry.kind] - kindOrder[b.entry.kind] ||
    a.entry.label.localeCompare(b.entry.label)
  );
}

function searchableEvents(bundle: Bundle, now: string): readonly EventRecord[] {
  return bundle.all().filter((event) => (event.type === "support" || event.type === "trainee") && event.end >= now);
}

function appearanceMap(events: readonly EventRecord[]): Map<string, { date: CalendarDate; eventKey: string }> {
  const firstAppearance = new Map<string, { date: CalendarDate; eventKey: string }>();
  const noteAppearance = (id: string, event: EventRecord) => {
    const prev = firstAppearance.get(id);
    if (!prev || event.start < prev.date) firstAppearance.set(id, { date: event.start, eventKey: event.key });
  };

  for (const event of events) {
    if (event.type === "support") {
      for (const id of event.contents) noteAppearance(id, event);
    } else if (event.type === "trainee") {
      for (const id of event.contents) noteAppearance(id, event);
    }
  }
  return firstAppearance;
}

export function createSearchIndex(bundle: Bundle, now: string): SearchIndex {
  const events = searchableEvents(bundle, now);
  const firstAppearance = appearanceMap(events);
  const entriesByLabel = new Map<string, SearchEntry>();
  const addEntry = (entry: SearchEntry) => {
    const key = `${entry.kind}:${normalize(entry.label)}`;
    const prev = entriesByLabel.get(key);
    if (!prev || entry.date < prev.date) entriesByLabel.set(key, entry);
  };

  for (const event of events) {
    if (event.type === "support") {
      for (const id of event.contents) {
        const support = bundle.support(id);
        const appearance = firstAppearance.get(id);
        if (!appearance) continue;
        const character = support.character ? bundle.character(support.character) : undefined;
        const label = supportLabel(id, support);
        addEntry({
          id,
          kind: "support",
          label,
          date: appearance.date,
          eventKey: appearance.eventKey,
          identityHaystack: termsFor(support.display, character?.name),
          haystack: termsFor(label, support.display, support.type, support.rarity, support.title, aliasesOf(support), character?.name),
        });
      }
    } else if (event.type === "trainee") {
      for (const id of event.contents) {
        const trainee = bundle.trainee(id);
        const character = bundle.character(trainee.character);
        const appearance = firstAppearance.get(id);
        if (!appearance) continue;
        const label = traineeLabel(id, trainee, bundle);
        addEntry({
          id,
          kind: "trainee",
          label,
          date: appearance.date,
          eventKey: appearance.eventKey,
          identityHaystack: termsFor(character.name),
          haystack: termsFor(label, character.name, trainee.variant, `${trainee.rarity}`, aliasesOf(trainee)),
        });
      }
    }
  }

  const entries = [...entriesByLabel.values()];
  return (query) =>
    entries
      .map((entry) => ({ entry, rank: rankPrefixMatch(entry.haystack, query, entry.identityHaystack) }))
      .filter((match): match is { entry: SearchEntry; rank: number } => match.rank !== null)
      .sort(sortResults)
      .map(({ entry }) => ({ id: entry.id, kind: entry.kind, label: entry.label, date: entry.date, eventKey: entry.eventKey }));
}
