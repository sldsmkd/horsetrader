/**
 * unity-sync — Unity's cloud Worker: multi-provider OAuth2 auth + R2 plan sync, the
 * two halves sharing one origin, one session cookie, one private bucket.
 *
 * Endpoints (all same-origin with the site in production via the wrangler route;
 * standalone-testable on the workers.dev URL). The auth routes are provider-generic —
 * `:provider` is a key in the registry (providers.ts): `google` and `discord`:
 *   GET  /api/auth/:provider/start    → 302 to the provider (state + nonce + PKCE)
 *   GET  /api/auth/:provider/callback → code→token exchange, identify, set session, 302 home
 *   GET  /api/me                      → { authenticated, provider?, sub? }
 *   POST /api/auth/logout             → clear session
 *   GET  /api/sync                    → pull the account's plan blob (ETag CAS; see sync.ts)
 *   PUT  /api/sync                    → push it back conditionally (412 = conflict)
 *   GET  /                            → tiny smoke page (dev affordance)
 *
 * No state is stored server-side: the OAuth transaction (provider + state/nonce/PKCE
 * verifier) rides a short-lived signed cookie across the redirect; the session
 * is a signed cookie holding identity only (no PII — design.md §7).
 */
import { pkceChallenge } from "./oauth.ts";
import { getProvider } from "./providers.ts";
import { parseCookies, serializeCookie, type CookieOpts } from "./cookies.ts";
import { sign, verify, readSession, type Session } from "./session.ts";
import { randomToken } from "./encoding.ts";
import { handleSync } from "./sync.ts";

export interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  BUCKET: R2Bucket;
}

const OAUTH_COOKIE = "unity_oauth";
const SESSION_COOKIE = "unity_session";
const OAUTH_TTL = 600; // 10 min to complete the round-trip
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

interface OAuthTxn {
  provider: string;
  state: string;
  nonce: string;
  verifier: string;
}

const secureCookie = (extra: CookieOpts): CookieOpts => ({ httpOnly: true, secure: true, sameSite: "Lax", ...extra });

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { origin, pathname } = url;

    // ── start: stash the OAuth transaction, redirect to the provider ────────
    const startMatch = pathname.match(/^\/api\/auth\/([^/]+)\/start$/);
    if (startMatch && request.method === "GET") {
      const providerId = startMatch[1];
      const provider = getProvider(providerId);
      if (!providerId || !provider) return json({ error: "unknown_provider" }, { status: 404 });
      const txn: OAuthTxn = { provider: providerId, state: randomToken(), nonce: randomToken(), verifier: randomToken() };
      const location = provider.authorizeUrl(env, {
        redirectUri: `${origin}/api/auth/${providerId}/callback`,
        state: txn.state,
        nonce: txn.nonce,
        codeChallenge: await pkceChallenge(txn.verifier),
      });
      return new Response(null, {
        status: 302,
        headers: {
          location,
          "set-cookie": serializeCookie(OAUTH_COOKIE, await sign(txn, env.SESSION_SECRET), secureCookie({ maxAge: OAUTH_TTL, path: "/api/auth" })),
        },
      });
    }

    // ── callback: verify state, exchange code, identify, set session ────────
    const callbackMatch = pathname.match(/^\/api\/auth\/([^/]+)\/callback$/);
    if (callbackMatch && request.method === "GET") {
      const providerId = callbackMatch[1];
      const provider = getProvider(providerId);
      const cookies = parseCookies(request.headers.get("cookie"));
      const txn = await verify<OAuthTxn>(cookies[OAUTH_COOKIE] ?? "", env.SESSION_SECRET);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      // The txn must match the provider whose callback this is — a stale or
      // cross-provider cookie is as invalid as a bad state.
      if (!providerId || !provider || !txn || txn.provider !== providerId || !code || !returnedState || returnedState !== txn.state) {
        return json({ error: "invalid_oauth_state" }, { status: 400 });
      }
      let sub: string;
      try {
        ({ sub } = await provider.identify(env, {
          code,
          redirectUri: `${origin}/api/auth/${providerId}/callback`,
          codeVerifier: txn.verifier,
          nonce: txn.nonce,
        }));
      } catch (err) {
        return json({ error: "oauth_exchange_failed", detail: String(err) }, { status: 502 });
      }
      const session: Session = { provider: providerId, sub, exp: Math.floor(Date.now() / 1000) + SESSION_TTL };
      // Land back on the bare site — the FE re-fetches `/api/me` on load, so no
      // post-sign-in marker is needed in the URL.
      const headers = new Headers({ location: `${origin}/` });
      headers.append("set-cookie", serializeCookie(SESSION_COOKIE, await sign(session, env.SESSION_SECRET), secureCookie({ maxAge: SESSION_TTL, path: "/" })));
      // Burn the one-shot transaction cookie.
      headers.append("set-cookie", serializeCookie(OAUTH_COOKIE, "", secureCookie({ maxAge: 0, path: "/api/auth" })));
      return new Response(null, { status: 302, headers });
    }

    // ── me: who is this session? ────────────────────────────────────────────
    if (pathname === "/api/me" && request.method === "GET") {
      const cookies = parseCookies(request.headers.get("cookie"));
      const session = await readSession(cookies[SESSION_COOKIE], env.SESSION_SECRET);
      return session
        ? json({ authenticated: true, provider: session.provider, sub: session.sub })
        : json({ authenticated: false }, { status: 401 });
    }

    // ── logout: clear the session cookie ────────────────────────────────────
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      return json({ ok: true }, {
        headers: { "set-cookie": serializeCookie(SESSION_COOKIE, "", secureCookie({ maxAge: 0, path: "/" })) },
      });
    }

    // ── sync: authenticated R2 plan pull/push (ETag CAS — see sync.ts) ──────
    if (pathname === "/api/sync") {
      const cookies = parseCookies(request.headers.get("cookie"));
      const session = await readSession(cookies[SESSION_COOKIE], env.SESSION_SECRET);
      if (!session) return json({ error: "unauthenticated" }, { status: 401 });
      return handleSync(request, env, session);
    }

    // ── smoke page (dev affordance; the real UI is the site's beta surface) ──
    if (pathname === "/" && request.method === "GET") {
      return new Response(SMOKE_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    return json({ error: "not_found" }, { status: 404 });
  },
};

const SMOKE_PAGE = `<!doctype html><meta charset=utf-8><title>unity-sync</title>
<body style="font:15px system-ui;max-width:40rem;margin:3rem auto">
<h1>unity-sync — auth smoke test</h1>
<p><a href="/api/auth/google/start"><button>Sign in with Google</button></a>
<a href="/api/auth/discord/start"><button>Sign in with Discord</button></a>
<button onclick="logout()">Sign out</button></p>
<p>Sync (needs sign-in): <button onclick="pull()">Pull</button>
<button onclick="push()">Push</button> — held ETag: <code id=etag>∅</code></p>
<pre id=out>checking…</pre>
<script>
let etag=null;
const show=o=>document.getElementById('out').textContent=JSON.stringify(o,null,2);
const setEtag=e=>{etag=e;document.getElementById('etag').textContent=e||'∅';};
async function me(){show(await(await fetch('/api/me',{credentials:'include'})).json());}
async function logout(){await fetch('/api/auth/logout',{method:'POST',credentials:'include'});setEtag(null);me();}
async function pull(){const r=await fetch('/api/sync',{credentials:'include'});
 if(r.ok){setEtag(r.headers.get('etag'));show({pull:'ok',body:await r.json()});}
 else{show({pull:r.status,body:await r.json()});}}
async function push(){const h={'content-type':'application/json'};
 h[etag?'If-Match':'If-None-Match']=etag||'*';
 const r=await fetch('/api/sync',{method:'PUT',credentials:'include',headers:h,
  body:JSON.stringify({version:1,stamp:Date.now()})});
 if(r.ok)setEtag(r.headers.get('etag'));
 show({push:r.status,body:await r.json()});}
me();
</script>`;
