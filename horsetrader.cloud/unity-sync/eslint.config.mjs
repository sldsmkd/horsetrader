// SAST config for this service (the per-service template — see
// ../README.md). Security rules only, not a style linter; `make security`
// gates deploy on it. This is the untrusted-ingress boundary Unity introduces.
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
