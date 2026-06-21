/**
 * The card-detail view-model: `(bundle, kind, id) → CardDetails`. Pure and
 * DOM-free — it resolves one trainee/support atom to the identity facets the card
 * surface renders (twinkle-monthly/step-1-card-surface.md). The kind-branch
 * (trainee vs support differ only in which record they resolve and which facets
 * read) lives here, so the surface itself is a flat render.
 *
 * Resolve-or-throw: the record resolves through the bundle or throws (trust the
 * bake). The `source` deep-link is the one may-be-absent attribute — a non-null
 * field lights the link, `null` omits it; that is *not* a resolve failure.
 */

import type { Bundle } from "../bundle/access.ts";
import type { AptitudesRecord, CharacterRecord } from "../../core/bundle/academy.gen.ts";
import type { BannerKind, RarityTier } from "./aboveLane.ts";

/** One identity facet — a labelled value, optionally led by an attribute pip. */
export interface Facet {
  label: string;
  value: string;
  /** The support attribute (speed/stamina/…) whose pip leads the value, if any. */
  attribute?: string;
}

/** One aptitude grade — a slot (Turf, Short, Front, …) and its rank slug
 *  (`"g"`…`"s"`), which the surface renders as a letter coloured by the
 *  `--ht-colour-aptitude-<rank>` token. */
export interface AptitudeGrade {
  slot: string;
  rank: string;
}

/** One aptitude axis — a labelled row of grades (Surface / Distance / Strategy). */
export interface AptitudeAxis {
  label: string;
  grades: AptitudeGrade[];
}

/** The render shape both kinds normalise into. */
export interface CardDetails {
  name: string;
  rarity: string;
  rarityTier: RarityTier;
  /** The hero art src, or `null` when the bake lacks one (renders an empty frame). */
  art: string | null;
  facets: Facet[];
  /** Character vitals (birthday / height / three sizes) — present only for the
   *  members the bake carries. Empty for pals/NPCs and characterless supports. */
  bio: Facet[];
  release: string;
  /** The outbound deep-link, or `null` (then the surface omits the link). */
  source: string | null;
  /** Base aptitudes (trainee only; `null` for supports and aptitude-less pages). */
  aptitudes: AptitudeAxis[] | null;
}

const birthdayFormat = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/** A character's vitals as display facets, each present only when the bake carries
 *  it — `bio` is always the container, but its members are individually nullable
 *  (pals/NPCs and scrape-lagging newcomers read blank). */
function bioFacets(character: CharacterRecord | null): Facet[] {
  if (!character) return [];
  const { birthday, height, three_sizes: sizes } = character.bio;
  const facets: Facet[] = [];
  if (birthday) {
    facets.push({ label: "Birthday", value: birthdayFormat.format(new Date(Date.UTC(2000, birthday.month - 1, birthday.day))) });
  }
  if (height != null) facets.push({ label: "Height", value: `${height} cm` });
  if (sizes.bust != null && sizes.waist != null && sizes.hips != null) {
    facets.push({ label: "Three Sizes", value: `B${sizes.bust} / W${sizes.waist} / H${sizes.hips}` });
  }
  return facets;
}

/** Project the baked aptitudes onto the three display axes, in the source page's
 *  reading order (surface → distance → strategy). */
function aptitudeAxes(a: AptitudesRecord): AptitudeAxis[] {
  return [
    { label: "Surface", grades: [
      { slot: "Turf", rank: a.surface.turf },
      { slot: "Dirt", rank: a.surface.dirt },
    ] },
    { label: "Distance", grades: [
      { slot: "Short", rank: a.distance.short },
      { slot: "Mile", rank: a.distance.mile },
      { slot: "Medium", rank: a.distance.medium },
      { slot: "Long", rank: a.distance.long },
    ] },
    { label: "Strategy", grades: [
      { slot: "Front", rank: a.strategy.front },
      { slot: "Pace", rank: a.strategy.pace },
      { slot: "Late", rank: a.strategy.late },
      { slot: "End", rank: a.strategy.end },
    ] },
  ];
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function cardDetails(bundle: Bundle, kind: BannerKind, id: string): CardDetails {
  if (kind === "trainee") {
    const t = bundle.trainee(id);
    const character = bundle.character(t.character);
    return {
      name: character.name ?? id,
      rarity: `${t.rarity}★`,
      rarityTier: t.rarity >= 3 ? "crystal" : "gold",
      art: t.portrait ?? t.thumbnail,
      facets: [
        { label: "Variant", value: t.variant },
        ...(t.title ? [{ label: "Title", value: t.title }] : []),
      ],
      bio: bioFacets(character),
      release: t.release,
      source: t.source,
      aptitudes: t.aptitudes ? aptitudeAxes(t.aptitudes) : null,
    };
  }

  const s = bundle.support(id);
  const character = s.character ? bundle.character(s.character) : null;
  return {
    name: s.display ?? character?.name ?? id,
    rarity: (s.rarity ?? "").toUpperCase(),
    rarityTier: (s.rarity ?? "").toLowerCase() === "ssr" ? "crystal" : "gold",
    art: s.art ?? s.thumbnail,
    facets: [
      ...(s.type ? [{ label: "Type", value: titleCase(s.type), attribute: s.type }] : []),
      ...(s.title ? [{ label: "Title", value: s.title }] : []),
    ],
    bio: bioFacets(character),
    release: s.release,
    source: s.source,
    aptitudes: null, // supports carry no aptitude block
  };
}
