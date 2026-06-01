/* eslint-disable */
/**
 * Generated from the ETL's published JSON Schema by `npm run gen:types`.
 * DO NOT EDIT BY HAND — re-run generation when the schema changes.
 */

/**
 * Top-level shape of ``academy.json`` — the three entity collections, each a
 * stable-key → record map (the keys are the collection class names lowercased,
 * matching ``Bake.academy``).
 */
export interface Academy {
  characters: {
    [k: string]: CharacterRecord;
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
export interface SupportRecord {
  character: string | null;
  display: string | null;
  type: string | null;
  rarity: string | null;
  title: string | null;
  release: string;
  thumbnail: string | null;
  art: string | null;
}
export interface TraineeRecord {
  character: string;
  variant: string | null;
  rarity: number;
  release: string;
  thumbnail: string | null;
  portrait: string | null;
}
