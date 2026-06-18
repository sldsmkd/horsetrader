/**
 * unity-sync — Unity's cloud Worker: Google OAuth2 auth + R2 plan sync, the two
 * halves sharing one origin, one session cookie, one private bucket.
 *
 * Endpoints (all same-origin with the site in production via the wrangler route;
 * standalone-testable on the workers.dev URL):
 *   GET  /api/auth/google/start    → 302 to Google (state + nonce + PKCE)
 *   GET  /api/auth/google/callback → code→token exchange, verify, set session, 302 home
 *   GET  /api/me                   → { authenticated, provider?, sub? }
 *   POST /api/auth/logout          → clear session
 *   GET  /api/sync                 → pull the account's plan blob (ETag CAS; see sync.ts)
 *   PUT  /api/sync                 → push it back conditionally (412 = conflict)
 *   GET  /                         → tiny smoke page (dev affordance)
 *
 * No state is stored server-side: the OAuth transaction (state/nonce/PKCE
 * verifier) rides a short-lived signed cookie across the redirect; the session
 * is a signed cookie holding identity only (no PII — design.md §7).
 */
import { authorizeUrl, exchangeCode, pkceChallenge, verifyIdToken } from "./oauth.ts";
import { parseCookies, serializeCookie, type CookieOpts } from "./cookies.ts";
import { sign, verify, readSession, type Session } from "./session.ts";
import { randomToken } from "./encoding.ts";
import { handleSync } from "./sync.ts";

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  BUCKET: R2Bucket;
}

const OAUTH_COOKIE = "unity_oauth";
const SESSION_COOKIE = "unity_session";
const OAUTH_TTL = 600; // 10 min to complete the round-trip
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

interface OAuthTxn {
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
    const redirectUri = `${origin}/api/auth/google/callback`;

    // ── start: stash the OAuth transaction, redirect to Google ──────────────
    if (pathname === "/api/auth/google/start" && request.method === "GET") {
      const txn: OAuthTxn = { state: randomToken(), nonce: randomToken(), verifier: randomToken() };
      const location = authorizeUrl({
        clientId: env.GOOGLE_CLIENT_ID,
        redirectUri,
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

    // ── callback: verify state, exchange code, verify id_token, set session ──
    if (pathname === "/api/auth/google/callback" && request.method === "GET") {
      const cookies = parseCookies(request.headers.get("cookie"));
      const txn = await verify<OAuthTxn>(cookies[OAUTH_COOKIE] ?? "", env.SESSION_SECRET);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      if (!txn || !code || !returnedState || returnedState !== txn.state) {
        return json({ error: "invalid_oauth_state" }, { status: 400 });
      }
      let sub: string;
      try {
        const idToken = await exchangeCode({
          code,
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri,
          codeVerifier: txn.verifier,
        });
        ({ sub } = await verifyIdToken(idToken, env.GOOGLE_CLIENT_ID, txn.nonce));
      } catch (err) {
        return json({ error: "oauth_exchange_failed", detail: String(err) }, { status: 502 });
      }
      const session: Session = { provider: "google", sub, exp: Math.floor(Date.now() / 1000) + SESSION_TTL };
      const headers = new Headers({ location: `${origin}/?signed_in=1` });
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
