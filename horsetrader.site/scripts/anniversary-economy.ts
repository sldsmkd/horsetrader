import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ConfigBundle } from "../js/src/core/bundle/config.gen.ts";
import type { EventsBundle } from "../js/src/core/bundle/events.gen.ts";
import { createCoordinator } from "../js/src/core/engine/coordinator.ts";
import { DEFAULT_STREAMS } from "../js/src/core/engine/registry.ts";
import type { Stream } from "../js/src/core/engine/stream.ts";
import { CLUB_RANK_TIERS } from "../js/src/core/identity/clubrank.ts";
import { DOCUMENT_KEY, memoryStore } from "../js/src/core/persistence/storage.ts";
import type { Config, PlanDocument, ResourceVector } from "../js/src/core/persistence/document.ts";
import {
  CHAMPIONS_MEETING_KEYS,
  LEAGUE_OF_HEROES_KEYS,
  MASTERS_KEYS,
  MISSION_KEYS,
  PLAY_TOGGLE_KEYS,
  SHOP_TICKET_KEYS,
  STRONGEST_TEAM_KEYS,
  TEAM_TRIAL_KEYS,
  playStyleSettingsForPreset,
} from "../js/src/core/playstyle/index.ts";
import type { PlayStyleSettings } from "../js/src/core/playstyle/index.ts";
import { cal, dateStringInTimeZone, daysBetween, defaultTimeZone } from "../js/src/core/projection/dates.ts";
import type { CalendarDate } from "../js/src/core/projection/dates.ts";

interface Args {
  events: string;
  config: string;
  accountConfig?: string;
  out?: string;
  timeZone: string;
  matrix: boolean;
  caratEquivalents: boolean;
}

interface Sample {
  index: number;
  key: string;
  name: string;
  date: CalendarDate;
  daysSinceLaunch: number;
  balance: ResourceVector;
}

interface MatrixRow {
  stream: string;
  parameter: string;
  value: string;
  index: number;
  key: string;
  name: string;
  date: CalendarDate;
  daysSinceLaunch: number;
  resource: string;
  amount: number;
}

const EMPTY_COMPLEMENT: Stream = {
  id: "analysis.empty-complement",
  claims: "complement",
  mints: [],
  enabled: () => true,
  events: () => [],
};

const CARAT_EQUIVALENT_RESOURCE = "carat_equivalent";

/**
 * Analysis-only valuation lens for resources that are not spendable carats but
 * ship bundled beside them in event rewards.
 *
 * Rainbow/gold crystals and shards cannot be bought directly, so there is no
 * clean cash-shop price. The nearest sane anchors are the twice-yearly select
 * equivalents at 1,500 and 7,500 paid carats; there are also functionally
 * equivalent banners around 20,000 carats, but those are bad enough deals that
 * they should not define the midpoint. For this report we peg one rainbow
 * crystal at 5,000 carats. Since 20 rainbow shards make one rainbow crystal, a
 * rainbow shard is 250 carats equivalent; gold is valued at half rainbow.
 *
 * Scout tickets are worth one pull in kind, but limited by banner side; rather
 * than price them at the full 150 carats/pull, this report discounts each to
 * 100 carats equivalent. Paid carats get the same treatment through the daily
 * paid pull: 50 paid carats can become one pull when used efficiently, so each
 * paid carat counts as 2 carats equivalent here.
 */
const CARAT_EQUIVALENT_RATES: Record<string, number> = {
  free_carats: 1,
  paid_carats: 2,
  trainee_tickets: 100,
  support_tickets: 100,
  rainbow_crystal: 5000,
  rainbow_crystal_shards: 250,
  gold_crystal: 2500,
  gold_crystal_shards: 125,
};

function noopClaimer(stream: Stream): Stream | null {
  if (stream.claims === "complement" || stream.claims.length === 0) return null;
  return {
    id: `analysis.noop.${stream.id}`,
    claims: stream.claims,
    mints: [],
    enabled: () => true,
    events: () => [],
  };
}

function isolatedRegistry(target: Stream): readonly Stream[] {
  const streams: Stream[] = [];
  for (const stream of DEFAULT_STREAMS) {
    if (stream.id === target.id) {
      streams.push(stream);
      continue;
    }
    if (stream.claims === "complement") {
      streams.push(EMPTY_COMPLEMENT);
      continue;
    }
    const noop = noopClaimer(stream);
    if (noop) streams.push(noop);
  }
  return streams;
}

function defaultStaticPath(file: string): string {
  const fromRepoRoot = resolve(process.cwd(), "static/json", file);
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return resolve(process.cwd(), "../static/json", file);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    events: defaultStaticPath("events.json"),
    config: defaultStaticPath("config.json"),
    timeZone: defaultTimeZone(),
    matrix: false,
    caratEquivalents: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--matrix") {
      args.matrix = true;
      continue;
    }
    if (arg === "--carat-equivalents") {
      args.caratEquivalents = true;
      continue;
    }
    const value = argv[i + 1];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    if (arg === "--events") args.events = resolve(value);
    else if (arg === "--config") args.config = resolve(value);
    else if (arg === "--account-config") args.accountConfig = resolve(value);
    else if (arg === "--out") args.out = resolve(value);
    else if (arg === "--timezone") args.timeZone = value;
    else throw new Error(`Unknown argument ${arg}`);
    i++;
  }

  return args;
}

function printHelp(): void {
  console.log(`Usage: node scripts/anniversary-economy.ts [options]

Samples the headless economy from launch/day 0 to each anniversary anchor.

Options:
  --events PATH          Baked events JSON. Default: static/json/events.json
  --config PATH          Baked config JSON. Default: static/json/config.json
  --account-config PATH  Optional account config section, or a full plan document with { config }
  --matrix               Isolate each stream and run every raw selector value; emits tidy CSV
  --carat-equivalents    Add carat_equivalent rows from carats + crystal/shard equivalents
  --timezone TZ          Calendar timezone. Default: system timezone
  --out PATH             Write CSV to this path instead of stdout
`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function eventDate(event: EventsBundle["events"][number], timeZone: string): CalendarDate {
  return dateStringInTimeZone(event.start, timeZone);
}

function displayName(event: EventsBundle["events"][number]): string {
  const record = event as Record<string, unknown>;
  return String(record["name"] ?? record["title"] ?? event.key);
}

function launchDate(bundle: EventsBundle, timeZone: string): CalendarDate {
  const banners = bundle.events.filter((event) => event.type === "trainee" || event.type === "support");
  if (banners.length === 0) throw new Error("No launch banner found: bundle has no trainee/support banners");
  return banners
    .map((event) => eventDate(event, timeZone))
    .sort()[0]!;
}

function anniversaryAnchors(bundle: EventsBundle, timeZone: string): Sample[] {
  return bundle.events
    .filter((event) => event.type === "anniversary")
    .map((event, index) => ({
      index: index + 1,
      key: event.key,
      name: displayName(event),
      date: eventDate(event, timeZone),
      daysSinceLaunch: 0,
      balance: {},
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function loadAccountConfig(path: string | undefined, day0: CalendarDate): Config {
  if (!path) return defaultAllChannelsConfig(day0);
  const raw = readJson<unknown>(path);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("--account-config must be a JSON object");
  const obj = raw as Record<string, unknown>;
  const config = obj["config"] ?? obj;
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("--account-config must be a config object or a plan document with a config object");
  }
  return config as Config;
}

function defaultAllChannelsConfig(day0: CalendarDate): Config {
  return configForSettings(day0, {
    dailies: "on",
    weeklyLogin: "on",
    teamTrials: "rank60",
    anniversaryMissions: "on",
    holidays: "on",
    scenarioMissions: "on",
    traineeDebuts: "on",
    factorStudies: "on",
    racingCarnival: "on",
    showtime: "on",
    missions: "on",
    storyEvents: "on",
    championsMeeting: "groupAChampion",
    shopTickets: "rainbow",
    leagueOfHeroes: "platinum4",
    strongestTeam: "SS",
    legendRaces: "on",
    skillTests: "on",
    masters: "EX",
  });
}

function configForSettings(
  day0: CalendarDate,
  settings: PlayStyleSettings,
  patch: { clubRank?: string | null; dailyPack?: string | null; trainingPass?: boolean } = {},
): Config {
  return {
    identity: {
      playStyleKey: "custom",
      playStyleSettings: settings,
      clubName: patch.clubRank === null ? "" : "Headless Stable",
      clubRank: patch.clubRank ?? "SS",
    },
    ...(patch.dailyPack === null ? {} : { dailyPack: patch.dailyPack ?? day0 }),
    ...(patch.trainingPass === false ? {} : { trainingPass: patch.trainingPass ?? true }),
  };
}

function coordinatorFor(
  events: EventsBundle,
  config: ConfigBundle,
  day0: CalendarDate,
  timeZone: string,
  accountConfig: Config,
  streams?: readonly Stream[],
) {
  const doc: PlanDocument = {
    version: 1,
    snapshot: { date: day0, recordedAt: `${day0}T00:00:00.000Z`, resources: {} },
    config: accountConfig,
  };
  const store = memoryStore();
  store.write(DOCUMENT_KEY, JSON.stringify(doc));
  return createCoordinator({ bundle: events, config, now: day0, timeZone, store, streams });
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(samples: Sample[]): string {
  const resources = new Set<string>();
  for (const sample of samples) for (const resource of Object.keys(sample.balance)) resources.add(resource);
  const resourceColumns = [...resources].sort();
  const headers = ["index", "key", "name", "date", "days_since_launch", ...resourceColumns];
  const rows = samples.map((sample) =>
    [
      sample.index,
      sample.key,
      sample.name,
      sample.date,
      sample.daysSinceLaunch,
      ...resourceColumns.map((resource) => sample.balance[resource] ?? 0),
    ].map(csvCell).join(","),
  );
  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function toMatrixCsv(rows: MatrixRow[]): string {
  const headers = ["stream", "parameter", "value", "index", "key", "name", "date", "days_since_launch", "resource", "amount"];
  return `${headers.join(",")}\n${rows
    .map((row) =>
      [
        row.stream,
        row.parameter,
        row.value,
        row.index,
        row.key,
        row.name,
        row.date,
        row.daysSinceLaunch,
        row.resource,
        row.amount,
      ].map(csvCell).join(","),
    )
    .join("\n")}\n`;
}

function caratEquivalent(balance: ResourceVector): number {
  let total = 0;
  for (const [resource, amount] of Object.entries(balance)) {
    total += amount * (CARAT_EQUIVALENT_RATES[resource] ?? 0);
  }
  return total;
}

function withCaratEquivalent(balance: ResourceVector, enabled: boolean): ResourceVector {
  if (!enabled) return balance;
  const equivalent = caratEquivalent(balance);
  if (equivalent === 0) return balance;
  return { ...balance, [CARAT_EQUIVALENT_RESOURCE]: equivalent };
}

function resourceRows(balance: ResourceVector, includeCaratEquivalent: boolean): [string, number][] {
  const augmented = withCaratEquivalent(balance, includeCaratEquivalent);
  return Object.entries(augmented)
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

interface MatrixCase {
  stream: Stream;
  parameter: string;
  value: string;
  config: Config;
  enabled?: boolean;
}

function casesForStream(stream: Stream, day0: CalendarDate): MatrixCase[] {
  const base = playStyleSettingsForPreset("focused");
  const playCases = <K extends keyof PlayStyleSettings>(
    parameter: K,
    values: readonly PlayStyleSettings[K][],
  ): MatrixCase[] =>
    values.map((value) => ({
      stream,
      parameter,
      value: String(value),
      config: configForSettings(day0, { ...base, [parameter]: value }),
    }));

  switch (stream.id) {
    case "ground.events":
      return [{ stream, parameter: "none", value: "baseline", config: configForSettings(day0, base) }];
    case "event.anniversary-missions":
      return playCases("anniversaryMissions", PLAY_TOGGLE_KEYS);
    case "event.holidays":
      return playCases("holidays", PLAY_TOGGLE_KEYS);
    case "event.scenario-missions":
      return playCases("scenarioMissions", PLAY_TOGGLE_KEYS);
    case "event.trainee-debuts":
      return playCases("traineeDebuts", PLAY_TOGGLE_KEYS);
    case "event.legend-races":
      return playCases("legendRaces", PLAY_TOGGLE_KEYS);
    case "event.skill-tests":
      return playCases("skillTests", PLAY_TOGGLE_KEYS);
    case "event.factor-studies":
      return playCases("factorStudies", PLAY_TOGGLE_KEYS);
    case "event.racing-carnival":
      return playCases("racingCarnival", PLAY_TOGGLE_KEYS);
    case "event.showtime":
      return playCases("showtime", PLAY_TOGGLE_KEYS);
    case "event.missions":
      return playCases("missions", MISSION_KEYS);
    case "play.champions-meeting":
      return playCases("championsMeeting", CHAMPIONS_MEETING_KEYS);
    case "play.story":
      return playCases("storyEvents", PLAY_TOGGLE_KEYS);
    case "subscription.training-pass":
      return [
        { stream, parameter: "trainingPass", value: "off", config: configForSettings(day0, base, { trainingPass: false }) },
        { stream, parameter: "trainingPass", value: "on", config: configForSettings(day0, base, { trainingPass: true }) },
      ];
    case "play.league-of-heroes":
      return playCases("leagueOfHeroes", LEAGUE_OF_HEROES_KEYS);
    case "play.strongest-team":
      return playCases("strongestTeam", STRONGEST_TEAM_KEYS);
    case "play.masters-challenge":
      return playCases("masters", MASTERS_KEYS);
    case "play.dailies":
      return playCases("dailies", PLAY_TOGGLE_KEYS);
    case "play.weekly-login":
      return playCases("weeklyLogin", PLAY_TOGGLE_KEYS);
    case "play.team-trials":
      return playCases("teamTrials", TEAM_TRIAL_KEYS);
    case "identity.club-rank":
      return [
        { stream, parameter: "clubRank", value: "none", config: configForSettings(day0, base, { clubRank: null }) },
        ...CLUB_RANK_TIERS.map((rank) => ({
          stream,
          parameter: "clubRank",
          value: rank,
          config: configForSettings(day0, base, { clubRank: rank }),
        })),
      ];
    case "play.shop-tickets":
      return playCases("shopTickets", SHOP_TICKET_KEYS);
    case "subscription.daily-pack":
      return [
        { stream, parameter: "dailyPack", value: "off", config: configForSettings(day0, base, { dailyPack: null }) },
        { stream, parameter: "dailyPack", value: "active", config: configForSettings(day0, base, { dailyPack: day0 }) },
      ];
    default:
      return [{ stream, parameter: "none", value: "baseline", config: configForSettings(day0, base) }];
  }
}

function matrixRows(
  events: EventsBundle,
  config: ConfigBundle,
  day0: CalendarDate,
  anchors: Sample[],
  timeZone: string,
  includeCaratEquivalent: boolean,
): MatrixRow[] {
  const rows: MatrixRow[] = [];
  const samples = [
    { index: 0, key: "day-0", name: "Launch banners", date: day0, daysSinceLaunch: 0 },
    ...anchors.map((anchor, index) => ({
      index: index + 1,
      key: anchor.key,
      name: anchor.name,
      date: anchor.date,
      daysSinceLaunch: daysBetween(day0, anchor.date),
    })),
  ];

  for (const stream of DEFAULT_STREAMS) {
    for (const matrixCase of casesForStream(stream, day0)) {
      const coord = coordinatorFor(events, config, day0, timeZone, matrixCase.config, isolatedRegistry(stream));
      if (matrixCase.enabled === false) coord.setEnabled(stream.id, false);
      for (const sample of samples) {
        const entries = resourceRows(coord.balanceAt(sample.date), includeCaratEquivalent);
        if (entries.length === 0) {
          rows.push({ ...sample, stream: stream.id, parameter: matrixCase.parameter, value: matrixCase.value, resource: "total", amount: 0 });
          continue;
        }
        for (const [resource, amount] of entries) {
          rows.push({ ...sample, stream: stream.id, parameter: matrixCase.parameter, value: matrixCase.value, resource, amount });
        }
      }
    }
  }
  return rows;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const events = readJson<EventsBundle>(args.events);
  const config = readJson<ConfigBundle>(args.config);
  const day0 = launchDate(events, args.timeZone);
  const anchors = anniversaryAnchors(events, args.timeZone);
  const accountConfig = loadAccountConfig(args.accountConfig, day0);

  if (args.matrix) {
    const csv = toMatrixCsv(matrixRows(events, config, day0, anchors, args.timeZone, args.caratEquivalents));
    if (args.out) writeFileSync(args.out, csv);
    else process.stdout.write(csv);
    return;
  }

  const coord = coordinatorFor(events, config, day0, args.timeZone, accountConfig);
  const samples: Sample[] = [
    {
      index: 0,
      key: "day-0",
      name: "Launch banners",
      date: day0,
      daysSinceLaunch: 0,
      balance: withCaratEquivalent(coord.balanceAt(day0), args.caratEquivalents),
    },
    ...anchors.map((anchor, index) => ({
      ...anchor,
      index: index + 1,
      daysSinceLaunch: daysBetween(day0, anchor.date),
      balance: withCaratEquivalent(coord.balanceAt(anchor.date), args.caratEquivalents),
    })),
  ];

  const csv = toCsv(samples);
  if (args.out) writeFileSync(args.out, csv);
  else process.stdout.write(csv);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
