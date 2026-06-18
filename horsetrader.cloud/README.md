# horsetrader.cloud

The project's server-side surface — Cloudflare Workers, one **self-contained npm
project per service**:

```
horsetrader.cloud/
  {service}/
    package.json        # own scripts + EXACT-pinned deps, own lockfile
    wrangler.toml       # own deploy config
    eslint.config.mjs   # own SAST config
    src/…
```

This is the **untrusted-ingress boundary** Unity introduces — the one place in the
repo that carries a real security obligation (see [unity/design.md §2](../unity/design.md)).
Scope of hardening: these services **only** — not the site bundle (supply-chain
`audit` aside), not the Python ETL.

## Security contract (the Makefile relies on this)

`make security` discovers services via `horsetrader.cloud/*/` and runs each one's
two scripts. **Every service must define both** — a service that omits one fails the
gate (loudly, by design):

| Script | Command | Why |
| --- | --- | --- |
| `security:audit` | `npm audit --omit=dev --audit-level=high` | supply-chain CVEs in shipped/runtime deps |
| `security:sast`  | `eslint . --max-warnings 0` | code smells at the ingress boundary |

Secret scanning (gitleaks) is repo-wide — no per-service config needed.

## Dependency policy (design.md §6)

The "no external deps" rule breaks here, under audit: **pin exact versions** (no
`^`/`~`), minimise the transitive tree, vet provenance, prefer native Web Crypto.
Leaning combo for auth: `@badgateway/oauth2-client` + `jose`.

## Per-service template

`package.json`:
```jsonc
{
  "name": "horsetrader-cloud-{service}",
  "private": true,
  "scripts": {
    "security:audit": "npm audit --omit=dev --audit-level=high",
    "security:sast": "eslint . --max-warnings 0",
    "check": "tsc --noEmit",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "eslint": "10.5.0",
    "eslint-plugin-security": "4.0.1",
    "typescript": "5.9.3",
    "typescript-eslint": "8.61.1",
    "wrangler": "4.101.0"
  }
}
```

`eslint.config.mjs` (security rules only — not a style linter):
```js
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      // Too noisy to gate on: flags every `obj[key]` access. The meaningful
      // rules (eval, child_process, non-literal fs, unsafe regex, weak rng) stay on.
      "security/detect-object-injection": "off",
    },
  },
  { ignores: ["**/*.test.ts", "node_modules/**"] },
];
```
