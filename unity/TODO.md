# Unity — TODO (parking lot)

## DESIGN INTENT for next session (user brain-dump 2026-06-18 (c), NOT yet built)

1. ~~**Disconnect = DELETE the cloud save.**~~ **DONE 2026-06-19.** `DELETE /api/sync`
   (idempotent) destroys the account's R2 blob (`unity-sync/src/sync.ts`); FE
   `deleteSave()` (`core/cloud/client.ts`); the connected-state button is now
   **Disconnect** and routes through a new **confirm shield-of-a-shield**
   (`ui/views/confirmShield.ts` — generic alert/confirm at z-index 1100, owns the async
   action with busy + inline-error/retry). Delete must land before the session clears;
   localStorage untouched (sign-out keeps the local copy).
   → The `presentConfirmShield` primitive is now available for #2's disconnect-confirm.
2. **Provider picker = radio-style push-in/out toggles, max ONE provider on.** Reshape
   the shield's provider buttons into mutually-exclusive toggles (push-in look,
   highlight when on). Clicking the active provider toggles it OFF; clicking another
   toggles the first OFF and the new one ON. Valid states = 0 or exactly 1 connected at
   a time (matches the "NO account-linking, one provider at a time" decision above).
   Likely needs a **shield-of-a-shield confirm/alert** before disconnect (since per #1
   disconnect now destroys the cloud save) — "will see" / TBD.
3. **Brand the provider buttons** — style them as the official **Google sign-in** and
   **Discord login** buttons (their real brand look: colours/logo/wording), not the
   current generic glyph-chip rows. (The `icon: "G"/"D"` registry placeholders give way
   to real brand marks; check each provider's brand guidelines for permitted button
   styles.)
4. **Hide the numeric subject (`sub`) from the UI.** The connected-state line currently
   shows `provider:sub` (a long opaque snowflake / Google numeric id) — meaningless to
   users. Drop it from display (show just the provider, maybe a friendly label). The
   `sub` stays the internal identity key; it's only the *presentation* that's hidden.

## Also spotted on the 2026-06-19 pass (lower priority / may be moot)

- [ ] **README stale.** `horsetrader.cloud/unity-sync/README.md` still says "auth only /
      sync lands next", but `/api/sync` is wired. Add sync endpoints + R2-binding/secrets.
- [ ] **U0 clean-push skip** (`resolution.md`): may already be covered — `syncNow` clean
      does a pull and returns `noop` if unchanged. Confirm or close.
- [ ] **VERIFY note still open on paper** (`design.md §3`): record that R2 `onlyIf` +
      free-tier limits were verified.
- [ ] **Graduate the conflict dialog** out of the beta chamber to an app-level modal;
      device labels + real plan-mtime (`resolution.md` deferred polish).
- [ ] **Decide push cadence** (`design.md §5`): user-initiated vs push-on-close.
