/**
 * The OAuth provider registry — one entry per connectable cloud, behind a single
 * shape so the routes/session are provider-generic (index.ts matches `:provider`).
 * Each provider answers two questions:
 *
 *   - authorizeUrl → where do we send the browser to consent?
 *   - identify     → given the returned code, who is this (a stable `sub`)?
 *
 * The two providers diverge precisely at `identify`, and that's the whole reason
 * this seam exists:
 *   - **Google** is OIDC — the token response carries an `id_token` JWT we verify
 *     against Google's JWKS; the subject is the verified `sub` claim (oauth.ts).
 *   - **Discord** is plain OAuth2 — the token response is just an `access_token`;
 *     there is no id_token, so we call `users/@me` with it and take the `id`
 *     (a snowflake) as the subject. No JWT, no nonce (nonce is an OIDC id_token
 *     replay defence; `state` still covers CSRF on the redirect).
 *
 * Identity only ever leaves here as `{ sub }` — no email, no username (design §7).
 */
import type { Env } from "./index.ts";
import { authorizeUrl as googleAuthorizeUrl, exchangeCode, verifyIdToken } from "./oauth.ts";

export interface AuthorizeOpts {
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface IdentifyOpts {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
}

export interface OAuthProvider {
  authorizeUrl(env: Env, opts: AuthorizeOpts): string;
  /** Exchange the auth code for a stable subject id. Throws on any failure. */
  identify(env: Env, opts: IdentifyOpts): Promise<{ sub: string }>;
}

// ── Discord: plain OAuth2 (authorize → access_token → users/@me.id) ───────────
const DISCORD_AUTH = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_ME = "https://discord.com/api/users/@me";

function discordAuthorizeUrl(env: Env, opts: AuthorizeOpts): string {
  const u = new URL(DISCORD_AUTH);
  u.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify"); // id + username; we persist only id
  u.searchParams.set("state", opts.state);
  u.searchParams.set("code_challenge", opts.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  // Skip the re-consent screen once the user has authorised; first time still prompts.
  u.searchParams.set("prompt", "none");
  return u.toString();
}

async function discordIdentify(env: Env, opts: IdentifyOpts): Promise<{ sub: string }> {
  const tokenRes = await fetch(DISCORD_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: opts.code,
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.codeVerifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`discord token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("discord token response had no access_token");

  const meRes = await fetch(DISCORD_ME, { headers: { authorization: `Bearer ${access_token}` } });
  if (!meRes.ok) throw new Error(`discord users/@me failed: ${meRes.status}`);
  const { id } = (await meRes.json()) as { id?: string };
  if (!id) throw new Error("discord users/@me had no id");
  return { sub: id };
}

export const PROVIDERS: Record<string, OAuthProvider> = {
  google: {
    authorizeUrl: (env, o) => googleAuthorizeUrl({ clientId: env.GOOGLE_CLIENT_ID, ...o }),
    identify: async (env, o) => {
      const idToken = await exchangeCode({
        code: o.code,
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: o.redirectUri,
        codeVerifier: o.codeVerifier,
      });
      return verifyIdToken(idToken, env.GOOGLE_CLIENT_ID, o.nonce);
    },
  },
  discord: {
    authorizeUrl: discordAuthorizeUrl,
    identify: discordIdentify,
  },
};

export function getProvider(id: string | undefined): OAuthProvider | undefined {
  return id ? PROVIDERS[id] : undefined;
}
