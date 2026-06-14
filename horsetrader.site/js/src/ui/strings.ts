import type {
  ChampionsMeetingKey,
  LeagueOfHeroesKey,
  MastersKey,
  MissionKey,
  PlayToggleKey,
  PlayStyleKey,
  ShopTicketKey,
  StoryKey,
  StrongestTeamKey,
  TeamTrialKey,
} from "../core/playstyle/index.ts";

export interface PlayStylePresetStrings {
  name: string;
  caption: string;
  shape: string;
}

export interface PlayStyleSettingStepStrings {
  value: string;
  description: string;
}

export interface PlayStyleSettingStrings<Key extends string> {
  title: string;
  steps: Record<Key, PlayStyleSettingStepStrings>;
}

export interface PlayStyleStrings {
  title: string;
  apply: string;
  customLockedTitle: string;
  presets: Record<PlayStyleKey, PlayStylePresetStrings>;
  settings: {
    dailies: PlayStyleSettingStrings<PlayToggleKey>;
    weeklyLogin: PlayStyleSettingStrings<PlayToggleKey>;
    teamTrials: PlayStyleSettingStrings<TeamTrialKey>;
    anniversaryMissions: PlayStyleSettingStrings<PlayToggleKey>;
    holidays: PlayStyleSettingStrings<PlayToggleKey>;
    scenarioMissions: PlayStyleSettingStrings<PlayToggleKey>;
    traineeDebuts: PlayStyleSettingStrings<PlayToggleKey>;
    factorStudies: PlayStyleSettingStrings<PlayToggleKey>;
    racingCarnival: PlayStyleSettingStrings<PlayToggleKey>;
    showtime: PlayStyleSettingStrings<PlayToggleKey>;
    missions: PlayStyleSettingStrings<MissionKey>;
    storyEvents: PlayStyleSettingStrings<StoryKey>;
    championsMeeting: PlayStyleSettingStrings<ChampionsMeetingKey>;
    shopTickets: PlayStyleSettingStrings<ShopTicketKey>;
    leagueOfHeroes: PlayStyleSettingStrings<LeagueOfHeroesKey>;
    strongestTeam: PlayStyleSettingStrings<StrongestTeamKey>;
    legendRaces: PlayStyleSettingStrings<PlayToggleKey>;
    skillTests: PlayStyleSettingStrings<PlayToggleKey>;
    masters: PlayStyleSettingStrings<MastersKey>;
  };
}

export interface UiStrings {
  playStyle: PlayStyleStrings;
}

// The app's UI copy — the single source, bundled into the JS (main.ts imports it
// directly, no fetch). It used to be hand-authored as skeleton/json/strings.json
// and fetched at runtime, with this as a "fallback"; that split let the JSON drift
// from the `*_KEYS` enums silently (the cast `as UiStrings` type-checked nothing) —
// a historical accident, since UI copy belongs in the bundle, not the seed shell.
// Now it's typed against the playstyle key enums (`PlayStyleSettingStrings<Key>` →
// `steps: Record<Key, …>`), so a missing step for a new enum value is a COMPILE
// error here, not a white-screen in the browser. Keep this in sync by editing here.
export const UI_STRINGS: UiStrings = {
  playStyle: {
    title: "Play Style",
    apply: "Apply",
    customLockedTitle: "Custom play style is locked",
    presets: {
      sweetie: {
        name: "Sweetie",
        caption: "Love. Ponies. Sunshine.",
        shape: "I play when it feels good and chase the rewards that make me smile.",
      },
      casual: {
        name: "Casual",
        caption: "Having fun. Taking it easy.",
        shape: "I keep up when life allows and show up harder for the events I care about.",
      },
      focused: {
        name: "Focused",
        caption: "Trying hard. Getting better.",
        shape: "I build toward the big rewards without turning every day into homework.",
      },
      dedicated: {
        name: "Dedicated",
        caption: "No chill. All gas.",
        shape: "I show up, clear the list, and prepare seriously for the competitive bits.",
      },
      unhinged: {
        name: "Unhinged",
        caption: "Blood. Sweat. Victory.",
        shape: "I chase the ceiling and squeeze value out of every system that matters.",
      },
      custom: {
        name: "Custom",
        caption: "Make your own legend.",
        shape: "I want the sliders to tell my actual story.",
      },
    },
    settings: {
      dailies: {
        title: "Dailies",
        steps: {
          off: { value: "Off", description: "I do not count daily missions as regular income." },
          on: { value: "On", description: "I usually do the daily missions." },
        },
      },
      weeklyLogin: {
        title: "Weekly login",
        steps: {
          off: { value: "Off", description: "I do not count the login cycle as regular income." },
          on: { value: "On", description: "I usually collect the daily login cycle." },
        },
      },
      teamTrials: {
        title: "Team Trials",
        steps: {
          rank20: { value: "Rank 2.0", description: "I stay in Class 2." },
          rank25: { value: "Rank 2.5", description: "I alternate between Class 2 and Class 3." },
          rank30: { value: "Rank 3.0", description: "I stay in Class 3." },
          rank35: { value: "Rank 3.5", description: "I alternate between Class 3 and Class 4." },
          rank40: { value: "Rank 4.0", description: "I stay in Class 4." },
          rank45: { value: "Rank 4.5", description: "I alternate between Class 4 and Class 5." },
          rank50: { value: "Rank 5.0", description: "I stay in Class 5." },
          rank55: { value: "Rank 5.5", description: "I alternate between Class 5 and Class 6." },
          rank60: { value: "Rank 6.0", description: "I hold Class 6." },
        },
      },
      anniversaryMissions: {
        title: "Anniversary missions",
        steps: {
          off: { value: "Off", description: "I do not count anniversary mission rewards." },
          on: { value: "On", description: "I show up for anniversary missions." },
        },
      },
      holidays: {
        title: "Holidays",
        steps: {
          off: { value: "Off", description: "I do not count holiday rewards." },
          on: { value: "On", description: "I show up for holiday rewards." },
        },
      },
      scenarioMissions: {
        title: "Scenario missions",
        steps: {
          off: { value: "Off", description: "I do not count scenario mission rewards." },
          on: { value: "On", description: "I show up for scenario missions." },
        },
      },
      traineeDebuts: {
        title: "Trainee debuts",
        steps: {
          off: { value: "Off", description: "I do not count Original trainee debut rewards." },
          on: { value: "On", description: "I count Original trainee debut rewards." },
        },
      },
      factorStudies: {
        title: "Factor Studies",
        steps: {
          off: { value: "Off", description: "I do not count Factor Studies rewards." },
          on: { value: "On", description: "I participate in Factor Studies." },
        },
      },
      racingCarnival: {
        title: "Racing Carnival",
        steps: {
          off: { value: "Off", description: "I do not count Racing Carnival rewards." },
          on: { value: "On", description: "I participate in Racing Carnival." },
        },
      },
      showtime: {
        title: "Showtime",
        steps: {
          off: { value: "Off", description: "I do not count Showtime rewards." },
          on: { value: "On", description: "I participate in Showtime." },
        },
      },
      missions: {
        title: "Missions",
        steps: {
          off: { value: "Off", description: "I do not chase the regular mission set." },
          on: { value: "On", description: "I work through the regular missions." },
        },
      },
      storyEvents: {
        title: "Story events",
        steps: {
          tier0: { value: "Skip", description: "I do not count story event rewards." },
          tier1: { value: "Story only", description: "I show up for the story and the light Pt rewards." },
          tier2: { value: "Light grind", description: "I push to around 400k event Pt." },
          tier3: { value: "Deep grind", description: "I push to ~620k Pt for the second carat row." },
          tier4: { value: "Ceiling", description: "I grind story events to the Pt ceiling." },
        },
      },
      championsMeeting: {
        title: "Champions Meeting",
        steps: {
          off: { value: "Off", description: "I do not count Champions Meeting rewards." },
          groupBContender: { value: "Group B contender", description: "I compete in Group B." },
          groupBWinner: { value: "Group B winner", description: "I can win Group B." },
          groupARunnerUp: { value: "Group A runner-up", description: "I can reach the Group A final." },
          groupAChampion: { value: "Group A champion", description: "I aim to win Group A." },
        },
      },
      shopTickets: {
        title: "Shop tickets",
        steps: {
          none: { value: "None", description: "I didn't know there were tickets in the shop?" },
          cleats: { value: "4 / month", description: "I buy tickets with silver and gold cleats." },
          friendPoints: { value: "6 / month", description: "I use gold & silver cleats and friend points." },
          rainbow: { value: "7 / month", description: "I salvage junk welfare cards for rainbow cleats too." },
        },
      },
      leagueOfHeroes: {
        title: "League of Heroes",
        steps: {
          off: { value: "Off", description: "I do not count League of Heroes rewards." },
          silver4: { value: "Silver 4", description: "I collect the lower tier rewards." },
          gold1: { value: "Gold 1", description: "I reach the first Gold tier." },
          gold2: { value: "Gold 2", description: "I reach the second Gold tier." },
          gold3: { value: "Gold 3", description: "I reach the third Gold tier." },
          gold4: { value: "Gold 4", description: "I reach the top Gold tier." },
          platinum1: { value: "Platinum 1", description: "I reach the first Platinum tier." },
          platinum2: { value: "Platinum 2", description: "I reach the second Platinum tier." },
          platinum3: { value: "Platinum 3", description: "I reach the third Platinum tier." },
          platinum4: { value: "Platinum 4", description: "I reach the top Platinum tier." },
        },
      },
      strongestTeam: {
        title: "Strongest Team",
        steps: {
          off: { value: "Off", description: "I do not count Strongest Team rewards." },
          E: { value: "E", description: "I collect the entry rank rewards." },
          D: { value: "D", description: "I reach rank D." },
          C: { value: "C", description: "I reach rank C." },
          B: { value: "B", description: "I reach rank B." },
          A: { value: "A", description: "I reach rank A." },
          S: { value: "S", description: "I reach rank S." },
          SS: { value: "SS", description: "I reach rank SS." },
        },
      },
      masters: {
        title: "Masters Challenge",
        steps: {
          off: { value: "Off", description: "I do not count Masters Challenge clears." },
          "1": { value: "Level 1", description: "I clear the first challenge level." },
          "2": { value: "Level 2", description: "I clear the second challenge level." },
          "3": { value: "Level 3", description: "I clear the third challenge level." },
          EX: { value: "EX", description: "I clear the EX challenge." },
        },
      },
      legendRaces: {
        title: "Legend Races",
        steps: {
          off: { value: "Off", description: "I do not count Legend Race rewards." },
          on: { value: "On", description: "I clear Legend Races." },
        },
      },
      skillTests: {
        title: "Skill Tests",
        steps: {
          off: { value: "Off", description: "I do not count Skill Test rewards." },
          on: { value: "On", description: "I clear Skill Tests." },
        },
      },
    },
  },
};
