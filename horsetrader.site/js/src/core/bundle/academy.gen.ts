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
}
