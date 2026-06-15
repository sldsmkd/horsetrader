/* eslint-disable */
/**
 * Generated from the ETL's published JSON Schema by `npm run gen:types`.
 * DO NOT EDIT BY HAND — re-run generation when the schema changes.
 */

/**
 * Top-level shape of ``stats.json`` — the bake's own vanity counters, surfaced
 * by the front-end MANGOHORSE HUD (Eishin Flash filing her own production report).
 *
 * These are facts about the *bake*, not planner data: when it last ran, how large
 * the corpus is, how much of the timeline Eishin had to forecast, and how much
 * Japlish she had to ship as a JP fallback for want of an EN translation. The HUD
 * reads them once and displays them statically beneath the live runtime gauges.
 *
 * ``baked_at`` is a fully-qualified UTC timestamp — the Global server runs on UTC
 * and players calibrate around it, so the freshness stamp rides the clock the
 * audience already reads; ``build_s`` the total bake wall-clock. ``predicted`` /
 * ``confirmed`` split the baked events by whether their EN window was forecast or
 * already announced. ``sources`` is how many source documents (HTML + JSON) Shakur
 * read to build the bundle — the credibility number. ``no_en`` is the distinct
 * count of Japlish that crossed the wire untranslated — the live tally of the
 * translation-gap backlog.
 */
export interface BakeStats {
  baked_at: string;
  build_s: number;
  events: number;
  predicted: number;
  confirmed: number;
  entities: number;
  sources: number;
  no_en: number;
}
