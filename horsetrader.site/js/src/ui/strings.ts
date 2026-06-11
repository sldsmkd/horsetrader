import type {
  ChampionsMeetingKey,
  MissionKey,
  PlayStyleKey,
  ShopTicketKey,
  SpecialMissionKey,
  StoryEventKey,
  TeamTrialKey,
  WeeklyPlayKey,
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
    weeklyPlay: PlayStyleSettingStrings<WeeklyPlayKey>;
    teamTrials: PlayStyleSettingStrings<TeamTrialKey>;
    missions: PlayStyleSettingStrings<MissionKey>;
    specialMissions: PlayStyleSettingStrings<SpecialMissionKey>;
    storyEvents: PlayStyleSettingStrings<StoryEventKey>;
    championsMeeting: PlayStyleSettingStrings<ChampionsMeetingKey>;
    shopTickets: PlayStyleSettingStrings<ShopTicketKey>;
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
      weeklyPlay: {
        title: "Weekly play",
        steps: {
          twoDays: { value: "2 days", description: "I check in a couple of times during a normal week." },
          fourDays: { value: "4 days", description: "I play most weeks, with room for real-life interruptions." },
          sixDays: { value: "6 days", description: "I usually keep up, but I miss the odd day." },
          sevenDays: { value: "Every day", description: "I keep up daily." },
        },
      },
      teamTrials: {
        title: "Team Trials",
        steps: {
          rank4: { value: "Rank 4", description: "I clear the comfortable weekly rank." },
          rank5: { value: "Rank 5", description: "I push into the higher weekly rewards." },
          rank55: { value: "Rank 5.5", description: "I bounce around the Rank 5 promotion line." },
          rank6: { value: "Rank 6", description: "I hold the top weekly rank." },
        },
      },
      missions: {
        title: "Missions",
        steps: {
          no: { value: "No", description: "I do not chase the regular mission set." },
          yes: { value: "Yes", description: "I work through the regular missions." },
        },
      },
      specialMissions: {
        title: "Special missions",
        steps: {
          some: { value: "60%", description: "I take the obvious event rewards and leave some stretch goals." },
          welfare: { value: "80%", description: "I usually reach the key limited reward." },
          major: { value: "90%", description: "I collect the major rewards." },
          all: { value: "100%", description: "I clear the special mission set." },
        },
      },
      storyEvents: {
        title: "Story events",
        steps: {
          story: { value: "Story", description: "I read or skim the event and take the easy rewards." },
          welfare: { value: "Welfare card", description: "I secure the welfare card." },
          major: { value: "Major rewards", description: "I collect the headline rewards." },
          achievement: { value: "Achievement", description: "I push for the achievement reward." },
          earlyAchievement: { value: "Achievement early", description: "I finish the achievement track early." },
        },
      },
      championsMeeting: {
        title: "Champions Meeting",
        steps: {
          skip: { value: "Skip", description: "I usually skip or do not finish." },
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
    },
  },
};
