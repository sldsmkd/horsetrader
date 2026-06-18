/**
 * The sync orchestrator — joins the cloud transport ([client.ts](client.ts)) to
 * the coordinator's plan + sync bookkeeping. Entry points:
 *
 *   pullOnLoad — the load-time auto-pull (resolution.md trigger 1). GET + compare:
 *                clean + cloud-moved → fast-forward; dirty + cloud-moved → CONFLICT
 *                (surfaced, not silently skipped); otherwise no-op. Never auto-pushes
 *                (push cadence is user-initiated, §10).
 *   syncNow    — the manual reconcile (trigger 3). Clean → fast-forward; dirty →
 *                conditional push (CAS), and a 412 → CONFLICT.
 *   keepCloud / keepLocal — execute a pick-a-side conflict resolution.
 *
 * Named `syncNow` (not `reconcile`) so it doesn't collide with the engine's
 * commitments `reconcile`. Conflict RESOLUTION is pick-a-side (Steam-style); merge
 * stays off the table (see unity/resolution.md). Both detect paths surface the same
 * `CloudConflict` payload, mounted by `ui/views/cloudConflict.ts`.
 */
import { pullSave, pushSave } from "./client.ts";
import type { PushResult } from "./client.ts";
import { normaliseRemotePlan } from "../persistence/index.ts";
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

// ── load-time auto-pull (detect-only; never auto-pushes) ────────────────────

export type LoadSyncResult =
  | { kind: "noop" } // cloud∅ / unchanged / local-only edits — nothing to do on load
  | { kind: "fast-forwarded"; etag: string | null } // clean local adopted a moved cloud
  | { kind: "conflict"; conflict: CloudConflict } // both diverged — surface the dialog
  | { kind: "error"; detail: string };

export async function pullOnLoad(coord: Coordinator): Promise<LoadSyncResult> {
  const base = coord.syncMeta().etag;
  try {
    // GET regardless of dirty — we can't tell whether the cloud moved (and so whether
    // a dirty local is a real conflict) without it. This is the one request the app
    // spends per load; it never auto-pushes.
    const res = await pullSave();
    if (!res.exists || res.etag === base) return { kind: "noop" }; // cloud∅ or unchanged since our base
    const cloudDoc = normaliseRemotePlan(res.doc);
    if (coord.syncMeta().dirty) {
      // Both moved (local has unsynced edits, cloud advanced) → real conflict (P6).
      return { kind: "conflict", conflict: conflictOf(coord, cloudDoc, res.etag) };
    }
    // Clean local, cloud advanced → fast-forward, no prompt.
    coord.adoptRemote(cloudDoc, res.etag);
    return { kind: "fast-forwarded", etag: res.etag };
  } catch (err) {
    return { kind: "error", detail: String(err) };
  }
}

// ── manual reconcile ────────────────────────────────────────────────────────

export type SyncResult =
  | { kind: "noop" } // clean + cloud unchanged/empty — nothing to do
  | { kind: "pushed"; etag: string | null } // local edits sent up (CAS ok)
  | { kind: "fast-forwarded"; etag: string | null } // clean local adopted a moved cloud
  | { kind: "conflict"; conflict: CloudConflict }
  | { kind: "error"; detail: string };

export async function syncNow(coord: Coordinator): Promise<SyncResult> {
  const base = coord.syncMeta().etag;
  try {
    if (coord.syncMeta().dirty) {
      // Assert our base in the conditional PUT and let R2 arbitrate — no pre-GET; the
      // 412 IS the conflict signal (resolution.md push table).
      const push = await pushSave(coord.document(), base);
      if (push.ok) {
        coord.markSynced(push.etag);
        return { kind: "pushed", etag: push.etag };
      }
      if (!push.conflict) return { kind: "error", detail: `push failed (status ${push.status})` };
      // 412 → the cloud moved under us (P6). Fetch it to fill the pick-a-side dialog.
      const cloud = await pullSave();
      if (!cloud.exists) return { kind: "error", detail: "cloud save vanished mid-sync" };
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
  const push = await pushSave(coord.document(), cloudEtag);
  if (push.ok) coord.markSynced(push.etag);
  return push;
}
