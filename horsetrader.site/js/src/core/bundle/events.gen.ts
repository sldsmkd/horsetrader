/* eslint-disable */
/**
 * Generated from the ETL's published JSON Schema by `npm run gen:types`.
 * DO NOT EDIT BY HAND — re-run generation when the schema changes.
 */

/**
 * Top-level shape of ``events.json`` — a flat, tz-start-sorted list.
 */
export interface EventsBundle {
  events: (
    | SupportBannerRecord
    | TraineeBannerRecord
    | ScenarioRecord
    | StoryRecord
    | CMRecord
    | AnchorRecord
    | AnchoredEventRecord
  )[];
}
export interface SupportBannerRecord {
  type: "support";
  rushable: boolean;
  contents: string[];
  image: string;
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
export interface TraineeBannerRecord {
  type: "trainee";
  rushable: boolean;
  contents: string[];
  image: string;
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
export interface ScenarioRecord {
  type: "scenario";
  title: string | null;
  image: string | null;
  art: string | null;
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
export interface StoryRecord {
  type: "story";
  rushable: boolean;
  title: string | null;
  contents: string[];
  image: string | null;
  banner: string | null;
  art: string | null;
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
export interface CMRecord {
  type: "cm";
  name: string | null;
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
export interface AnchorRecord {
  type: "anchor";
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
export interface AnchoredEventRecord {
  type: "anchoredevent";
  relation: string;
  anchor: string;
  name?: string;
  start: string;
  end: string;
  predicted: boolean;
  key: string;
  rewards?: {
    [k: string]:
      | number
      | {
          [k: string]: number | string | (number | null)[];
        };
  };
}
