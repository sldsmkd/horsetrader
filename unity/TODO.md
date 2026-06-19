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
2. ~~**Provider picker = radio-style push-in/out toggles, max ONE provider on.**~~
   **DONE 2026-06-19.** One radio-style toggle list (`cloudProviderShield.ts`): connected
   provider pushed-in + "Connected" pill; click ON → disconnect (confirm), click another
   → switch (confirm → disconnect + redirect), click while none on → connect. Switch
   forgets the baseline so the new provider's connect-sync pushes up.
3. **Brand the provider buttons** — style them as the official **Google sign-in** and
   **Discord login** buttons (their real brand look: colours/logo/wording), not the
   current generic glyph-chip rows. (The `icon: "G"/"D"` registry placeholders give way
   to real brand marks; check each provider's brand guidelines for permitted button
   styles.) ← **only remaining brain-dump item; new thread.**
4. ~~**Hide the numeric subject (`sub`) from the UI.**~~ **DONE 2026-06-19** (fell out of
   #2): the toggle list has no identity-sub line, so `provider:sub` is gone from display.
   `sub` stays the internal identity key.

## Feature-complete polish (2026-06-19, user) — "almost done" tail

- [x] **Free sync credit on first load (one push-on-open, when cloud-connected).**
      **DONE 2026-06-19.** `reconcileOnLoad` now runs the full `syncNow` on every load (was
      pull-only on an ordinary load, full reconcile only on a fresh `?unity=connected`
      connect): an ordinary connected load spends a single "free credit" — dirty local
      pushes UP (CAS), clean fast-forwards, both-moved → conflict. The cap is *structural*
      (exactly one reconcile per load), so it never broadens into always-push (§10, $0
      keystone). `syncNow` subsumed the old `pullOnLoad` (its detect-only path was a strict
      subset minus the push), so `pullOnLoad`/`LoadSyncResult` were deleted. Signed-out
      fails soft (401 → `error`, no push lands), so "if connected" is implicit in transport.
      **Use case:** "let me just quickly make sure my PC synced first"; mostly a placebo for
      peace of mind. A bounded variant of design.md §5's push-on-*open*.
- [x] **Defence in depth — client egress + worker ingress hardening** (design.md §2: the
      trust-model flip makes the Worker real untrusted ingress; this is the matching
      belt-and-braces). Two symmetric halves:
      - **Client (egress):** ~~debounce + rate-limit the sync action so a spam-clicked Sync
        button (or a race firing it repeatedly) can't hammer the Worker~~ **rate-limit DONE
        2026-06-19** — `syncNow` is choked at core (`core/cloud/sync.ts`) to one reconcile
        per `SYNC_MIN_INTERVAL_MS` (5s); calls inside the window return `{ kind:"throttled" }`
        (the beta Sync button shows "just synced a moment ago"). Gate set at entry so it also
        bars a concurrent in-flight second; clock only advances on a passing call (spam can't
        extend the lockout); conflict resolution (keepLocal/keepCloud) deliberately not
        *rate*-gated. ~~Plus a shape-validate of the payload *before* push~~ **DONE
        2026-06-19** — `assertPlausiblePlan` (`core/persistence/validate.ts`, the client
        twin of the Worker's planned "plausibly one of our saves") asserts the top-level
        PlanDocument shape before every push (`syncNow` AND the `keepLocal` force-push); a
        throw becomes an `error` result / blocked dialog, so nothing malformed leaves the
        client. Sanity not full validation — `validateDocument` stays the deep ingress
        clean. **EGRESS HALF COMPLETE.**
      - **Worker (ingress, the corollary):** **DONE 2026-06-19.** Two cheap gates in cost
        order on PUT (`unity-sync/src/sync.ts`): (1) the existing `MAX_BLOB_BYTES` size cap
        rejects oversize WITHOUT looking at content (413); (2) `looksLikePlan` — a bounded
        plausibility sniff — `422 implausible_plan` unless the (already size-capped) body
        opens as a JSON object and carries `"version"` (the one always-present PlanDocument
        key). Sanity, not a schema: no deep-parse of the opaque blob (design.md §4) — just
        "is this plausibly one of our saves", so R2 stores plans not a PDF / junk POSTed to
        burn storage. A legit client never trips it (the egress assert guarantees shape);
        only a forged request that bypasses the client does, and that surfaces fail-soft as
        a push `error`. **DEFENCE-IN-DEPTH ITEM COMPLETE (both halves).**

## Also spotted on the 2026-06-19 pass (lower priority / may be moot)

- [x] **README stale.** **DONE 2026-06-19.** `unity-sync/README.md` now reads "auth + plan
      sync": added the `/api/sync` GET/PUT/DELETE rows, a "Plan sync" section (ETag-CAS,
      etag-in-body, the size cap + plausibility sniff), and the `BUCKET` R2 binding in
      config. Stale "beta surface" reference dropped.
- [x] **U0 clean-push skip.** **RESOLVED 2026-06-19.** Confirmed + recorded in
      `resolution.md`: a clean `syncNow` never spends a PUT — it does one GET to
      fast-forward a moved cloud (P3) and returns `noop` when unchanged. The "skip the
      wasteful push" intent is met; the GET is the deliberate fast-forward, not a no-op.
- [x] **VERIFY note (`design.md §3`).** **DONE 2026-06-19.** Marked VERIFIED in production:
      R2 `onlyIf` first-write/fast-forward CAS works; the CDN weak-ETag gotcha is handled
      (rev in body); free-tier limits hold at modelled scale (≤1 reconcile/load + manual).
- [x] **Graduate the conflict dialog.** **DONE 2026-06-19** (fell out of the beta
      teardown): `presentCloudConflict` is app-level — raised from both the load reconcile
      and the trainer card's Sync, both in `app.ts`; no beta chamber involved. Device
      labels + real plan-mtime stay **deferred by design** (§5): we have no plan-level
      mtime, so the dialog shows value-based `PlanFacts` (name/commitments/favourites/
      rushed/snapshot) instead — the more useful discriminator. Closed; metadata polish is
      a future nicety, not a gap.
- [x] **Decide push cadence (`design.md §5`).** **DECIDED + SHIPPED 2026-06-19.**
      User-initiated Sync + a bounded **push-on-open** free credit (≤1 reconcile/load,
      egress choked to 1/5s); not push-on-close. Recorded in design.md §5.
