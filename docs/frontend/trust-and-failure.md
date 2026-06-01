# Trust & failure

What the site trusts, what it validates, and how it fails. Two trust boundaries
that look like they conflict but don't, and a three-tier failure model relocated
from the ETL's to where the *audience* changes.

## Two trust boundaries

| Input | Controlled by | Validated where | Site stance |
| --- | --- | --- | --- |
| `academy.json` / `events.json` + images | the ETL pipeline | **upstream** (ETL self-validates before writing) | **trust** — plain typed cast |
| URL/query/hash state, shared links, `localStorage`/`sessionStorage`, form & search input, pasted/uploaded data | the **user** (or a tampered link) | **here, or nowhere** | **never trust** — validate every time |

These don't conflict: we trust the bundle *because* it was validated at its own
ingress (upstream); we never trust user-controlled input *because* the site is
the only ingress it has.

### Trusting the bundle

Data validity is the **ETL's** job. It is fail-loud and owns the bundle, so
malformed data makes it fail upstream and the site is **never asked to build or
deploy** — classic sequential pipeline. Therefore:

- **No site-side build-time shape gate.** It would redundantly re-police a
  contract the site doesn't own. Don't add one.
- A plain typed cast of the loaded JSON is acceptable — **provided the types
  don't lie.** The lever that keeps the cast honest is deriving types from an
  ETL-owned schema (see [architecture.md](architecture.md), "The ETL contract").
  This now exists: `npm run gen:types` derives `core/bundle/*.gen.ts` from the
  ETL's published schema, so the cast targets generated types that can't drift
  from the bake.

### Never trusting the user

Treat user-controlled input as `unknown` until proven otherwise: parse / validate
at the boundary into a typed value, reject or sanitise on failure. **Never
blind-cast user input with `as`** — `as` is reserved for the already-upstream-
validated bundle. Be explicitly defensive about persisted state from a *previous
app version* (the persistence migration ladder, see
[persistence.md](persistence.md)).

### Calibration: integrity, not security

This is a single-user, local-only gacha planner — no servers, no external comms,
no other users' data, nothing secret. "Validate at ingress" means a user typing
garbage or a corrupt/stale `localStorage` blob can't **brick their own save or
break the app** (Bobby-Tables-proofing their *local* account). It is **not** a
threat model. Don't gold-plate it. (If servers, sync, or sharing ever land,
revisit this.)

## The three-tier failure model

The ETL has three failure tiers (library `raise` / pipeline-fatal `SystemExit` /
per-entity `warning` + continue). The site keeps the same three, relocated to
where the audience changes:

| Tier | Site behaviour | Audience |
| --- | --- | --- |
| **Hard guard** | the ETL build step fails upstream → the site never ships bad data | the dev, in the pipeline |
| **Runtime-fatal** | render a **visible error panel** in the DOM + `console.error` full detail | the user sees "couldn't load"; the dev gets the stack |
| **Per-item soft** | skip one bad record + `console.warn`; **don't nuke the page** | neither is blocked |

Key points:

- **Runtime failure is rare, and it isn't a CDN outage.** The bundle JSON and the
  app shell (HTML + `app.js`) are served from the **same Cloudflare Pages deploy
  and origin** — so if the CDN drops the JSON it already dropped the HTML, and
  there's no running app left to show anything. A JSON-only fetch failure *while
  the shell loaded* is therefore unlikely. Even a **deploy race / version skew** is
  improbable: within a single load the shell and the bundle ride the **same
  pipelined connection**, and a Pages deploy flips the backend for both requests
  **atomically** — *not impossible* (a razor-thin window, or a returning visitor
  on a cached shell), but improbable. What actually remains is essentially a
  **network blip in the sub-second gap** between shell load and the data `fetch`.
  *Not* shape drift — that's the ETL's brick to throw.
- **Still worth a graceful panel — because it's cheap, not because it's likely.**
  The dev is happy to dig in devtools; the end user is not. On a bootstrap fetch
  failure, render a human-readable panel with a **reload** affordance (these
  failures self-heal on reload) and `console.error` the detail. Never a blank
  page.
- **Persistence fails soft and preserves** — see [persistence.md](persistence.md);
  a user's plan is precious local-only data and is never silently discarded.

## See also

- [persistence.md](persistence.md) — the user-input ingress in practice.
- [architecture.md](architecture.md) — the ETL contract and the static/no-server
  driver behind "data validity is the ETL's job".
