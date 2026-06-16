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
    | AnniversaryRecord
    | AnniversaryMissionRecord
    | ScenarioMissionRecord
    | TrainingPassRecord
    | HolidayRecord
  )[];
}
export interface SupportBannerRecord {
  type: "support";
  contents: string[];
  image: string;
  rate_overrides?: {
    [k: string]: number;
  };
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
  visible?: boolean;
  rushable?: boolean;
}
export interface TraineeBannerRecord {
  type: "trainee";
  contents: string[];
  image: string;
  rate_overrides?: {
    [k: string]: number;
  };
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
  visible?: boolean;
  rushable?: boolean;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface StoryRecord {
  type: "story";
  title: string | null;
  contents: string[];
  image: string | null;
  banner: string | null;
  art: string | null;
  era: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface CMRecord {
  type: "cm";
  name: string | null;
  banner?: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface ShowtimeRecord {
  type: "showtime";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface SkillTestRecord {
  type: "skilltest";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface RacingCarnivalRecord {
  type: "racingcarnival";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface StrongestTeamRecord {
  type: "strongestteam";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface MastersChallengeRecord {
  type: "masterschallenge";
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
  visible?: boolean;
  rushable?: boolean;
}
export interface FactorStudiesRecord {
  type: "factorstudies";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface LeagueOfHeroesRecord {
  type: "leagueofheroes";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface LegendRaceRecord {
  type: "legendrace";
  name: string | null;
  banner: string | null;
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
  visible?: boolean;
  rushable?: boolean;
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
  image: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface AnniversaryRecord {
  type: "anniversary";
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
  visible?: boolean;
  rushable?: boolean;
}
export interface AnniversaryMissionRecord {
  type: "anniversarymission";
  name: string | null;
  image: string | null;
  banner: string | null;
  anniversary: string;
  part: number;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface ScenarioMissionRecord {
  type: "scenariomission";
  name: string | null;
  image: string | null;
  scenario: string;
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
  visible?: boolean;
  rushable?: boolean;
}
export interface TrainingPassRecord {
  type: "trainingpass";
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
  visible?: boolean;
  rushable?: boolean;
}
export interface HolidayRecord {
  type: "holiday";
  name: string;
  banner?: string | null;
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
  visible?: boolean;
  rushable?: boolean;
}
