/**
 * Oshi selection: the curated character grid + a bundle-backed search over
 * characters with complete identity art. Part of the `ui/query` entity broker — the oshi
 * selector asks here for options and matches rather than joining bundle records
 * itself.
 */

import type { CharacterRecord } from "../../core/bundle/academy.gen.ts";
import type { Bundle } from "../bundle/access.ts";
import { normalize, rankPrefixMatch } from "./match.ts";

type CharacterWithOshiAssets = CharacterRecord & { icon: string; portrait: string };

export interface OshiOption {
  id: string;
  characterId: string;
  name: string;
  icon: string;
  portrait: string;
  costumeName?: string;
}

export type OshiSearchIndex = (query: string) => readonly OshiOption[];
export type OshiCostumeIndex = (characterId: string) => readonly OshiOption[];

export const DEFAULT_OSHI_ID = "char-haru-urara";

const DEFAULT_OSHI: OshiOption = {
  id: DEFAULT_OSHI_ID,
  characterId: DEFAULT_OSHI_ID,
  name: "Haru Urara",
  icon: "/img/characters/haru-urara_icon.webp",
  portrait: "/img/characters/haru-urara_portrait.webp",
};

export const CURATED_OSHIS: readonly OshiOption[] = [
  DEFAULT_OSHI,
  {
    id: "char-maruzensky",
    characterId: "char-maruzensky",
    name: "Maruzensky",
    icon: "/img/characters/maruzensky_icon.webp",
    portrait: "/img/characters/maruzensky_portrait.webp",
  },
  {
    id: "char-mejiro-mcqueen",
    characterId: "char-mejiro-mcqueen",
    name: "Mejiro McQueen",
    icon: "/img/characters/mejiro-mcqueen_icon.webp",
    portrait: "/img/characters/mejiro-mcqueen_portrait.webp",
  },
  {
    id: "char-oguri-cap",
    characterId: "char-oguri-cap",
    name: "Oguri Cap",
    icon: "/img/characters/oguri-cap_icon.webp",
    portrait: "/img/characters/oguri-cap_portrait.webp",
  },
  {
    id: "char-rice-shower",
    characterId: "char-rice-shower",
    name: "Rice Shower",
    icon: "/img/characters/rice-shower_icon.webp",
    portrait: "/img/characters/rice-shower_portrait.webp",
  },
  {
    id: "char-silence-suzuka",
    characterId: "char-silence-suzuka",
    name: "Silence Suzuka",
    icon: "/img/characters/silence-suzuka_icon.webp",
    portrait: "/img/characters/silence-suzuka_portrait.webp",
  },
  {
    id: "char-special-week",
    characterId: "char-special-week",
    name: "Special Week",
    icon: "/img/characters/special-week_icon.webp",
    portrait: "/img/characters/special-week_portrait.webp",
  },
  {
    id: "char-symboli-rudolf",
    characterId: "char-symboli-rudolf",
    name: "Symboli Rudolf",
    icon: "/img/characters/symboli-rudolf_icon.webp",
    portrait: "/img/characters/symboli-rudolf_portrait.webp",
  },
  {
    id: "char-taiki-shuttle",
    characterId: "char-taiki-shuttle",
    name: "Taiki Shuttle",
    icon: "/img/characters/taiki-shuttle_icon.webp",
    portrait: "/img/characters/taiki-shuttle_portrait.webp",
  },
  {
    id: "char-tokai-teio",
    characterId: "char-tokai-teio",
    name: "Tokai Teio",
    icon: "/img/characters/tokai-teio_icon.webp",
    portrait: "/img/characters/tokai-teio_portrait.webp",
  },
  {
    id: "char-kitasan-black",
    characterId: "char-kitasan-black",
    name: "Kitasan Black",
    icon: "/img/characters/kitasan-black_icon.webp",
    portrait: "/img/characters/kitasan-black_portrait.webp",
  },
  {
    id: "char-gold-ship",
    characterId: "char-gold-ship",
    name: "Gold Ship",
    icon: "/img/characters/gold-ship_icon.webp",
    portrait: "/img/characters/gold-ship_portrait.webp",
  },
];

const OVERFLOW_OSHIS: readonly OshiOption[] = [
  {
    id: "char-sakura-bakushin-o",
    characterId: "char-sakura-bakushin-o",
    name: "Sakura Bakushin O",
    icon: "/img/characters/sakura-bakushin-o_icon.webp",
    portrait: "/img/characters/sakura-bakushin-o_portrait.webp",
  },
];

interface OshiEntry extends OshiOption {
  haystack: string;
}

function option(id: string, character: CharacterRecord): OshiOption {
  return {
    id,
    characterId: id,
    name: character.name ?? id,
    icon: character.icon ?? "/img/characters/haru-urara_icon.webp",
    portrait: character.portrait ?? "/img/characters/haru-urara_portrait.webp",
  };
}

function traineeOption(id: string, bundle: Bundle): OshiOption | null {
  const trainee = bundle.trainee(id);
  const character = bundle.character(trainee.character);
  if (!hasOshiAssets(character) || !trainee.portrait) return null;
  const icon = character.icon;
  const portrait = trainee.portrait;
  return {
    id,
    characterId: trainee.character,
    name: character.name ?? trainee.character,
    icon,
    portrait,
    costumeName: trainee.variant === "Original" ? "Race Wear" : trainee.variant,
  };
}

function hasOshiAssets(character: CharacterRecord): character is CharacterWithOshiAssets {
  return Boolean(character.icon && character.portrait);
}

function hardcodedOption(id: string): OshiOption | undefined {
  return CURATED_OSHIS.find((oshi) => oshi.id === id);
}

export function selectedOshiOption(bundle: Bundle, selectedId: string | null | undefined): OshiOption {
  const id = selectedId ?? DEFAULT_OSHI_ID;
  try {
    if (id.startsWith("trainee-")) return traineeOption(id, bundle) ?? DEFAULT_OSHI;
    const character = bundle.character(id);
    return hasOshiAssets(character) ? option(id, character) : DEFAULT_OSHI;
  } catch {
    return hardcodedOption(id) ?? DEFAULT_OSHI;
  }
}

export function oshiChoices(selected: OshiOption, preferred: readonly OshiOption[] = []): readonly OshiOption[] {
  const out: OshiOption[] = [];
  const seen = new Set<string>();
  for (const oshi of [selected, ...preferred, ...CURATED_OSHIS.slice(1), ...OVERFLOW_OSHIS]) {
    if (seen.has(oshi.id)) continue;
    seen.add(oshi.id);
    out.push(oshi);
    if (out.length === CURATED_OSHIS.length) break;
  }
  return out;
}

export function searchOshis(selected: OshiOption, matches: readonly OshiOption[]): readonly OshiOption[] {
  const out: OshiOption[] = [];
  const seen = new Set<string>();
  for (const oshi of [selected, ...matches]) {
    if (seen.has(oshi.id)) continue;
    seen.add(oshi.id);
    out.push(oshi);
    if (out.length === CURATED_OSHIS.length) break;
  }
  return out;
}

export function starterOshis(selected: OshiOption): readonly OshiOption[] {
  return oshiChoices(selected);
}

export function createOshiIndex(bundle: Bundle): OshiSearchIndex {
  const entries: OshiEntry[] = bundle
    .characters()
    .filter(({ record }) => hasOshiAssets(record))
    .map(({ id, record }) => {
      const base = option(id, record);
      return { ...base, haystack: normalize(base.name) };
    });

  return (query) =>
    entries
      .map((entry) => ({ entry, rank: rankPrefixMatch(entry.haystack, query) }))
      .filter((match): match is { entry: OshiEntry; rank: number } => match.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.entry.name.localeCompare(b.entry.name))
      .map(({ entry }) => ({ id: entry.id, characterId: entry.characterId, name: entry.name, icon: entry.icon, portrait: entry.portrait }));
}

export function createOshiCostumeIndex(bundle: Bundle): OshiCostumeIndex {
  const byCharacter = new Map<string, OshiOption[]>();
  for (const { id, record } of bundle.characters()) {
    if (hasOshiAssets(record)) byCharacter.set(id, [option(id, record)]);
  }

  for (const { id, record } of bundle.trainees()) {
    const costumes = byCharacter.get(record.character);
    if (!costumes || !record.portrait) continue;
    const costume = traineeOption(id, bundle);
    if (costume) costumes.push(costume);
  }

  return (characterId) => byCharacter.get(characterId) ?? [];
}
