

---

## Deferred / no action yet

- `rate_overrides` and `rushable` fields are in the schema but have no frontend
  consumer. Leave them alone until the gacha-rate surface is scoped.
- `strings.ts` `FALLBACK_STRINGS` duplicates `strings.json` — accepted trade-off
  for fetch-fail resilience; no action needed.
- `docs/ideas/menu.md` (513 lines) is exploration notes, not a spec. Review when
  the menubar epic (**#22**) surfaces that need to match it.
