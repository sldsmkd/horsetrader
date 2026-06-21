/* eslint-disable */
/**
 * Generated from the ETL's published JSON Schema by `npm run gen:types`.
 * DO NOT EDIT BY HAND — re-run generation when the schema changes.
 */

/**
 * Top-level shape of ``academy.json`` — the entity collections, each a
 * stable-key → record map (the keys are the collection class names lowercased,
 * matching ``Bake.academy``).
 */
export interface Academy {
  characters: {
    [k: string]: CharacterRecord;
  };
  courses: {
    [k: string]: CourseRecord;
  };
  races: {
    [k: string]: RaceRecord;
  };
  racetracks: {
    [k: string]: RacetrackRecord;
  };
  supports: {
    [k: string]: SupportRecord;
  };
  trainees: {
    [k: string]: TraineeRecord;
  };
}
export interface CharacterRecord {
  name: string | null;
  quote: string | null;
  icon: string | null;
  portrait: string | null;
  bio: BioRecord;
}
/**
 * A character's vital-statistics bundle. Every member is optional: not all
 * characters carry this (NPCs never had it, or umapyoi hasn't filled it in).
 * `three_sizes` is always the container with nullable members; `birthday` /
 * `height` (cm) are `null` wholesale when absent.
 */
export interface BioRecord {
  three_sizes: ThreeSizesRecord;
  birthday: null | BirthdayRecord;
  height: number | null;
}
export interface ThreeSizesRecord {
  bust: number | null;
  waist: number | null;
  hips: number | null;
}
export interface BirthdayRecord {
  month: number;
  day: number;
}
export interface CourseRecord {
  racetrack: string;
  surface: string;
  distance: number;
  variant: string | null;
  diagram: string | null;
}
export interface RaceRecord {
  name: string | null;
  grade: string;
  surface: string;
  distance: number | null;
  racetrack: string | null;
  banner: string | null;
}
export interface RacetrackRecord {
  name: string | null;
  icon: string | null;
}
export interface SupportRecord {
  character: string | null;
  display: string | null;
  type: string | null;
  rarity: string | null;
  title: string | null;
  release: string;
  thumbnail: string | null;
  art: string | null;
  aliases: string[];
  source: string | null;
}
export interface TraineeRecord {
  character: string;
  variant: string;
  title: string | null;
  rarity: number;
  release: string;
  thumbnail: string | null;
  portrait: string | null;
  aliases: string[];
  source: string | null;
  aptitudes: null | AptitudesRecord;
}
/**
 * A trainee's base aptitudes across all three axes. Each grade is a rank
 * *slug* (`"g"` … `"s"`) — the front-end maps it to both the displayed letter
 * and the `--ht-colour-aptitude-*` token. The whole object is `null` when the
 * source page carried no aptitude block.
 */
export interface AptitudesRecord {
  surface: SurfaceAptitudesRecord;
  distance: DistanceAptitudesRecord;
  strategy: StrategyAptitudesRecord;
}
export interface SurfaceAptitudesRecord {
  turf: string;
  dirt: string;
}
export interface DistanceAptitudesRecord {
  short: string;
  mile: string;
  medium: string;
  long: string;
}
export interface StrategyAptitudesRecord {
  front: string;
  pace: string;
  late: string;
  end: string;
}
