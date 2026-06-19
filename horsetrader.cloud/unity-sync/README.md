# unity-sync

Unity's cloud Worker: **auth + plan sync**. Two halves in one Worker — multi-provider
OAuth2 authorization-code round-trip with a stateless signed-cookie session, and
ETag-CAS plan sync over a private R2 bucket (`/api/sync`). See
[unity/design.md](../../unity/design.md).

## Endpoints

The auth routes are provider-generic — `:provider` is a key in the registry
(`src/providers.ts`): `google` and `discord`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/:provider/start` | 302 → the provider (state + nonce + PKCE) |
| GET | `/api/auth/:provider/callback` | code→token exchange, identify, set session, 302 home |
| GET | `/api/me` | `{ authenticated, provider?, sub? }` |
| POST | `/api/auth/logout` | clear the session cookie |
| GET | `/api/sync` | pull: `200 { etag, plan }`, or `404 { exists:false }` (empty cloud) |
| PUT | `/api/sync` | push (CAS): `If-None-Match: *` first write / `If-Match: <etag>` fast-forward; `412` = conflict |
| DELETE | `/api/sync` | destroy the account's save (disconnect; idempotent) |
| GET | `/` | tiny smoke page (dev affordance) |

### Plan sync (`/api/sync`)

One R2 object per account (`{provider}:{sub}`) holds the serialised PlanDocument blob;
the object's **ETag is the sync rev** — no hand-rolled counter (design.md §3). Pushes are
plain HTTP conditionals the client speaks, translated to R2 `onlyIf`, so concurrency is
`git push`-style optimistic CAS: a `412` is the conflict signal, surfaced as data. The rev
travels in the response **body**, never the `ETag` header — a CDN in front (Cloudflare) may
rewrite the header to a weak validator (`W/"…"`) that never matches R2's strong etag,
deadlocking the next push. The blob is **opaque** to the Worker (username masking +
serialisation are the client's job, design.md §4); two cheap ingress gates guard it without
ever fully parsing it: a `MAX_BLOB_BYTES` size cap (reject oversize without reading) and a
bounded "looks like one of our plans" sniff (must open as a JSON object and carry
`"version"`) — sanity, not a schema.

No server-side state: the OAuth transaction (provider + state/nonce/PKCE verifier)
rides a short-lived signed cookie across the redirect; the session is a signed
cookie holding **identity only** — `{ provider, sub }`, no PII (design.md §7).
Signing is Web Crypto HMAC-SHA256 (no dep); the only dependency is `jose`, used to
verify Google's id_token. The two providers diverge only at *identify*: Google is
OIDC (verify the `id_token` JWT against the JWKS), Discord is plain OAuth2 (exchange
for an `access_token`, then `users/@me` → `id`). Auth-code throughout — the one
mechanism that covers both.

## Secrets & config

Public config is in `wrangler.toml` `[vars]` (`GOOGLE_CLIENT_ID`,
`DISCORD_CLIENT_ID`) and the `[[r2_buckets]]` binding (`BUCKET` → the `unity-saves`
private bucket that holds the per-account plan blobs). Three **secrets** must be set
before deploy:

```sh
wrangler secret put GOOGLE_CLIENT_SECRET    # from LastPass (the Google OAuth client secret)
wrangler secret put DISCORD_CLIENT_SECRET   # Discord Developer Portal → Application → OAuth2
wrangler secret put SESSION_SECRET          # a long random string, e.g. `openssl rand -base64 48`
```

Register the callback URL in the Discord Developer Portal (**Application → OAuth2 →
Redirects**), same shape as Google: `https://<host>/api/auth/discord/callback` (both
the workers.dev smoke host and the production `horsetrader.site` host).

## Deploy & test

```sh
npm install
npm run deploy            # → https://unity-sync.<subdomain>.workers.dev
```

**Smoke test (standalone, no FE):** open the workers.dev URL — the smoke page has
Sign-in / Sign-out and live `/api/me`. First register the callback in Google Cloud
Console → Credentials → the OAuth client → **Authorised redirect URI**:

```
https://unity-sync.<subdomain>.workers.dev/api/auth/google/callback
```

**Same-origin production:** uncomment the `routes` block in `wrangler.toml` with the
real site host (e.g. `horsetrader.site/api/*`) so the Pages site and this Worker
share an origin — then the site's cloud service calls relative `/api/*` (no CORS,
first-party cookie). Register that host's callback URI too:
`https://<site-host>/api/auth/google/callback`.

## Security

Covered by the repo's `make security` gate (per-service `security:audit` +
`security:sast`; secrets scanned repo-wide). See
[../README.md](../README.md) for the per-service contract.
