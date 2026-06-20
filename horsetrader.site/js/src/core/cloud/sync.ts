/**
 * The reconcile policy — joins the cloud transport ([client.ts](client.ts)) to the
 * coordinator's plan + sync bookkeeping. Internal to the cloud service: the UI reaches
 * these through the facade ([index.ts](index.ts)), which also owns account lifecycle
 * (connect/disconnect/switch) and the load-time trigger. Entry points:
 *
 *   syncNow    — the one reconcile, used both at load (`reconcileOnLoad`) and manually
 *                (the Sync button, trigger 3). Clean → fast-forward; dirty → conditional
 *                push (CAS), and a 412 → CONFLICT. At load this is the bounded "free
 *                credit" push-on-open; everywhere else it's user-initiated (§10).
 *   keepCloud / keepLocal — execute a pick-a-side conflict resolution.
 *
 * Named `syncNow` (not `reconcile`) so it doesn't collide with the engine's
 * commitments `reconcile`. Conflict RESOLUTION is pick-a-side (Steam-style); merge
 * stays off the table (see unity/resolution.md). Both detect paths surface the same
 * `CloudConflict` payload, mounted by `ui/views/surfaces/cloudConflict.ts`.
 */
import { pullSave, pushSave } from "./client.ts";
import type { PushResult } from "./client.ts";
import { assertPlausiblePlan, normaliseRemotePlan } from "../persistence/index.ts";
import type { PlanDocument } from "../persistence/index.ts";
import type { Coordinator } from "../engine/index.ts";

/**
 * A human-legible summary of a plan, for the pick-a-side dialog — our value-based
 * answer to Steam's "modified at" (we have no plan-level mtime; *what each version
 * holds* is the more useful discriminator anyway).
 */
export interface PlanFacts {
  trainerName: string;
  commitments: number;
  favourites: number;
  rushed: number;
  snapshot: string | null;
}

function planFacts(doc: PlanDocument): PlanFacts {
  const identity = doc.config?.["identity"];
  const name =
    typeof identity === "object" && identity !== null && !Array.isArray(identity)
      ? (identity as Record<string, unknown>)["trainerName"]
      : undefined;
  const snap = doc.snapshot;
  return {
    trainerName: typeof name === "string" && name.trim() ? name : "(unnamed)",
    commitments: Object.keys(doc.commitments ?? {}).length,
    favourites: Object.keys(doc.favourites ?? {}).length,
    rushed: Object.keys(doc.rushed ?? {}).length,
    snapshot: snap ? `${snap.date} · ${snap.resources["free_carats"] ?? "?"} carats` : null,
  };
}

/** Both diverged: the user must pick a side. Carries both summaries (for the dialog)
 *  and the cloud plan + rev (to adopt, or to push over, on resolution). */
export interface CloudConflict {
  localFacts: PlanFacts;
  cloudFacts: PlanFacts;
  cloudDoc: PlanDocument;
  cloudEtag: string | null;
}

function conflictOf(coord: Coordinator, cloudDoc: PlanDocument, cloudEtag: string | null): CloudConflict {
  return { localFacts: planFacts(coord.document()), cloudFacts: planFacts(cloudDoc), cloudDoc, cloudEtag };
}

// ── the reconcile (load-time free credit + manual Sync) ──────────────────────

export type SyncResult =
  | { kind: "noop" } // clean + cloud unchanged/empty — nothing to do
  | { kind: "pushed"; etag: string | null } // local edits sent up (CAS ok)
  | { kind: "fast-forwarded"; etag: string | null } // clean local adopted a moved cloud
  | { kind: "conflict"; conflict: CloudConflict }
  | { kind: "throttled" } // egress rate-limit: a sync ran < SYNC_MIN_INTERVAL_MS ago
  | { kind: "error"; detail: string };

// ── egress rate-limit (defence in depth — TODO §egress) ─────────────────────
// Choke the sync action at the source. A spam-clicked Sync button (the button may carry
// the network call, and no instant feedback breeds impatient re-clicks) or a race firing
// it repeatedly must not hammer the Worker — this protects the $0 request budget (§10) and
// the user from self-inflicted CAS churn. At most one reconcile per window; calls inside
// it drop as `throttled` (the prior outcome stands). The clock only advances on a call
// that PASSES the gate, so endless spamming can't extend the lockout past one window.
// Set at entry (before the awaits), so an in-flight sync also bars a concurrent second.
// Conflict RESOLUTION (keepLocal/keepCloud) is a separate, deliberate action — not gated.
const SYNC_MIN_INTERVAL_MS = 5_000;
let lastSyncAt = 0;

export async function syncNow(coord: Coordinator): Promise<SyncResult> {
  const now = Date.now();
  if (now - lastSyncAt < SYNC_MIN_INTERVAL_MS) return { kind: "throttled" };
  lastSyncAt = now;
  const base = coord.syncMeta().etag;
  try {
    if (coord.syncMeta().dirty) {
      // Egress shape gate (defence in depth): never spend a push on an obviously-malformed
      // plan — a bug shipping garbage up would corrupt the cloud copy + every device that
      // pulls it. Throws → caught below as an `error` result; nothing leaves the client.
      const doc = coord.document();
      assertPlausiblePlan(doc);
      // Assert our base in the conditional PUT and let R2 arbitrate — no pre-GET; the
      // 412 IS the conflict signal (resolution.md push table).
      const push = await pushSave(doc, base);
      if (push.ok) {
        coord.markSynced(push.etag);
        return { kind: "pushed", etag: push.etag };
      }
      if (!push.conflict) return { kind: "error", detail: `push failed (status ${push.status})` };
      // 412 → our base rev is stale. Fetch the cloud side to find out how.
      const cloud = await pullSave();
      if (!cloud.exists) {
        // U5 "vanished base": the cloud blob is gone (a disconnect deleted it — here or on
        // another device), so our If-Match had nothing to match. There's no other side to
        // pick against an empty cloud, so re-create from local (base ø → If-None-Match:*).
        const recreate = await pushSave(doc, null);
        if (recreate.ok) {
          coord.markSynced(recreate.etag);
          return { kind: "pushed", etag: recreate.etag };
        }
        // A racing create slipped in between our GET and re-push — now a genuine fork.
        if (!recreate.conflict) return { kind: "error", detail: `recreate failed (status ${recreate.status})` };
        const raced = await pullSave();
        if (!raced.exists) return { kind: "error", detail: "cloud save vanished mid-sync" };
        return { kind: "conflict", conflict: conflictOf(coord, normaliseRemotePlan(raced.doc), raced.etag) };
      }
      // P6 → the cloud moved under us. Fetch it to fill the pick-a-side dialog.
      return { kind: "conflict", conflict: conflictOf(coord, normaliseRemotePlan(cloud.doc), cloud.etag) };
    }
    // Clean: pull to fast-forward (adopt a moved cloud). No-op when nothing changed.
    const res = await pullSave();
    if (!res.exists || res.etag === base) return { kind: "noop" };
    const cloudDoc = normaliseRemotePlan(res.doc);
    coord.adoptRemote(cloudDoc, res.etag);
    return { kind: "fast-forwarded", etag: res.etag };
  } catch (err) {
    return { kind: "error", detail: String(err) };
  }
}

// ── pick-a-side resolution ──────────────────────────────────────────────────

/** Pick-a-side: keep the cloud version — adopt it, discarding local. */
export function keepCloud(coord: Coordinator, cloudDoc: PlanDocument, cloudEtag: string | null): void {
  coord.adoptRemote(cloudDoc, cloudEtag);
}

/**
 * Pick-a-side: keep local — force-push it over the cloud's CURRENT rev (the one we
 * saw during conflict detection), overwriting the cloud copy. A 412 here means the
 * cloud moved *again* since we offered the choice — surfaced to the caller as data.
 */
export async function keepLocal(coord: Coordinator, cloudEtag: string | null): Promise<PushResult> {
  const doc = coord.document();
  assertPlausiblePlan(doc); // egress shape gate — same as syncNow; never force garbage up
  const push = await pushSave(doc, cloudEtag);
  if (push.ok) coord.markSynced(push.etag);
  return push;
}
