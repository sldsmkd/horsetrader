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
    | ShowtimeRecord
    | SkillTestRecord
    | RacingCarnivalRecord
    | StrongestTeamRecord
    | MastersChallengeRecord
    | FactorStudiesRecord
    | LeagueOfHeroesRecord
    | LegendRaceRecord
    | MissionRecord
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
export interface ShowtimeRecord {
  type: "showtime";
  rushable: boolean;
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
export interface SkillTestRecord {
  type: "skilltest";
  rushable: boolean;
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
export interface RacingCarnivalRecord {
  type: "racingcarnival";
  rushable: boolean;
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
export interface StrongestTeamRecord {
  type: "strongestteam";
  rushable: boolean;
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
export interface MastersChallengeRecord {
  type: "masterschallenge";
  rushable: boolean;
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
export interface FactorStudiesRecord {
  type: "factorstudies";
  rushable: boolean;
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
export interface LeagueOfHeroesRecord {
  type: "leagueofheroes";
  rushable: boolean;
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
export interface LegendRaceRecord {
  type: "legendrace";
  name: string | null;
  legs: LegendLegRecord[];
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
/**
 * One leg of a Legend Race: a ~3-day sub-window pitting the player against a
 * single trainee variant. `trainee` is that trainee's academy stable key;
 * `start`/`end` are the leg's EN dates (the matched window subdivided in JP-leg
 * proportion). Legs are emitted in race order and tile the parent window.
 */
export interface LegendLegRecord {
  trainee: string;
  start: string;
  end: string;
}
export interface MissionRecord {
  type: "mission";
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
