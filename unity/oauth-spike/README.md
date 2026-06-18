# Unity — local Google OAuth spike

De-risking spike for [unity.md](../unity.md) step 2 (the Google OAuth round-trip).
Goal: confirm the provider is set up and see what comes back — **not** the production
flow. Production does a confidential-client auth-code exchange **in the Worker** (the
client *secret* stays server-side); this file only runs the browser-side popup to
inspect the identity claims, chiefly `sub` (Unity's `providerUserId`).

## Google Cloud Console setup (one-time)

1. Create a project (e.g. `horsetrader-unity`).
2. **OAuth consent screen** → *External*; app name + your email; scopes
   `openid email profile`; add yourself as a **test user** (keeps it in "testing"
   mode — no Google verification needed).
3. **Credentials → Create OAuth client ID → Web application.**
   - Authorised **JavaScript origin**: `http://localhost:8000`
   - Authorised **redirect URI**: `http://localhost:8000/`
4. Copy the **Client ID** into `CLIENT_ID` at the top of [index.html](index.html).
   It's public — safe in client code. **Keep the client *secret* out of this repo**
   (it's only needed later, for the Worker).

## Run

```sh
cd unity/oauth-spike
python -m http.server 8000
# open http://localhost:8000
```

`file://` won't work — Google requires an http origin, which is why we serve on
`localhost:8000` (the origin you registered above).

## What you'll see

- **Sign in with Google** (button + popup) → a signed id_token; the page decodes and
  shows `sub` / `email` / `name` / `aud` / `exp`.
- **Request access token** (optional) → an OAuth2 access/bearer token.

`sub` is the value Unity keys a save on as `(google, sub)`. No account-linking — same
provider every time (design.md §6).
