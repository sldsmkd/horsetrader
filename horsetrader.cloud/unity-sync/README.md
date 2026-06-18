# unity-sync

Unity's cloud Worker. **This cut: auth only** — Google OAuth2 authorization-code
round-trip + a stateless signed-cookie session. R2 plan sync (`/api/sync`) lands
in this same Worker next. See [unity/design.md](../../unity/design.md).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/google/start` | 302 → Google (state + nonce + PKCE) |
| GET | `/api/auth/google/callback` | code→token exchange, verify id_token, set session, 302 home |
| GET | `/api/me` | `{ authenticated, provider?, sub? }` |
| POST | `/api/auth/logout` | clear the session cookie |
| GET | `/` | tiny smoke page (dev affordance) |

No server-side state: the OAuth transaction (state/nonce/PKCE verifier) rides a
short-lived signed cookie across the redirect; the session is a signed cookie
holding **identity only** — `{ provider, sub }`, no PII (design.md §7). Signing is
Web Crypto HMAC-SHA256 (no dep); the only dependency is `jose` (id_token/JWKS
verification). Auth-code, not the GIS id_token shortcut, because it's the one
mechanism that also covers Discord later.

## Secrets & config

Public config is in `wrangler.toml` `[vars]` (`GOOGLE_CLIENT_ID`). Two **secrets**
must be set before deploy:

```sh
wrangler secret put GOOGLE_CLIENT_SECRET   # from LastPass (the OAuth client secret)
wrangler secret put SESSION_SECRET         # a long random string, e.g. `openssl rand -base64 48`
```

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
share an origin — then the site's beta surface calls relative `/api/*` (no CORS,
first-party cookie). Register that host's callback URI too:
`https://<site-host>/api/auth/google/callback`.

## Security

Covered by the repo's `make security` gate (per-service `security:audit` +
`security:sast`; secrets scanned repo-wide). See
[../README.md](../README.md) for the per-service contract.
