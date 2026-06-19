/**
 * The beta surface — Unity's in-app isolation chamber (design.md §9). The cloud
 * save/load UI proves out here before graduating to the main menubar. Two buttons,
 * separated by concern:
 *
 *   [ Cloud ] — connect: opens the cloud provider shield (cloudProviderShield.ts) —
 *               a modal provider picker when signed out, the identity + disconnect
 *               when signed in. The write half of "connect a cloud"; sign-out lands
 *               back here via `onSignedOut`.
 *   [ Sync ]  — the data action, and only that. Greyed until connected (and until
 *               there are local changes). Runs the real reconcile (`syncNow`): clean
 *               → fast-forward, dirty → conditional push, and a true conflict (both
 *               diverged) raises the Steam-style pick-a-side dialog. See
 *               unity/resolution.md.
 *
 * The app shell rebuilds this surface on every coordinator notify, and an async
 * action (sync/auth) can land *after* such a rebuild — so all transient state
 * (auth, last outcome, panel open) is module-scoped to survive the rebuild, and a
 * module-level `rerender()` always targets the *current* live surface (not the
 * closure that kicked the action off). `liveRoot`/`liveCoord` are that target.
 */

import "./betaSurface.css";

import { h } from "../h.ts";
import { fetchAuth } from "../../core/cloud/client.ts";
import type { AuthState } from "../../core/cloud/client.ts";
import { syncNow } from "../../core/cloud/sync.ts";
import { presentCloudConflict } from "./cloudConflict.ts";
import { presentCloudProviderShield } from "./cloudProviderShield.ts";
import type { Coordinator } from "../../core/engine/index.ts";

// Module-scoped so it survives the app's rebuild-on-notify.
let auth: AuthState = { authenticated: false };
let lastSyncOutcome = "no sync yet";
// The currently-mounted surface + its coordinator. A rebuild replaces `liveRoot`;
// `rerender` rebuilds whatever is live now, so an async outcome lands on the
// on-screen surface even when a notify swapped it mid-flight.
let liveRoot: HTMLElement | null = null;
let liveCoord: Coordinator | null = null;

function planSummary(coord: Coordinator): Record<string, unknown> {
  const doc = coord.document();
  const { etag, dirty } = coord.syncMeta();
  return {
    etag,
    dirty,
    username: coord.username() || "(none)",
    commitments: Object.keys(doc.commitments ?? {}).length,
    favourites: Object.keys(doc.favourites ?? {}).length,
    snapshot: doc.snapshot ? `${doc.snapshot.date} (${doc.snapshot.resources["free_carats"] ?? "?"} carats)` : "none",
  };
}

function rerender(): void {
  if (liveRoot && liveCoord) liveRoot.replaceChildren(...build(liveCoord));
}

const button = (label: string, onClick: () => void): HTMLButtonElement =>
  h("button", { class: "beta-surface__btn", attr: { type: "button" }, on: { click: onClick } }, label);

export function betaSurface(coord: Coordinator): HTMLElement {
  const root = h("section", { class: "beta-surface" });
  liveRoot = root;
  liveCoord = coord;
  rerender();
  // Resolve the session in the background (no coordinator notify, so this must
  // re-render imperatively when it lands).
  void (async () => {
    auth = await fetchAuth();
    rerender();
  })();
  return root;
}

function build(coord: Coordinator): Node[] {
  const connected = auth.authenticated;

  // Cloud opens the provider shield (connect a provider when signed out, identity +
  // disconnect when signed in). Sign-out lands back here via `onSignedOut`.
  const cloud = button("Cloud", () =>
    presentCloudProviderShield({
      auth,
      // Disconnect/switch deleted the cloud blob — drop the now-dangling sync baseline so
      // what's local needs a fresh push (a reconnect/switch re-creates cleanly instead of
      // If-Match-ing a deleted rev, U5).
      onCloudDeleted: () => coord.forgetCloud(),
      onSignedOut: () => {
        auth = { authenticated: false };
        rerender();
      },
    }),
  );
  // Sync lights up only when connected AND there's something to send. The signal we
  // have client-side is `dirty` (local diverged since the last sync) — we can't know
  // the cloud advanced without a GET, so "no changes" means "no local changes".
  const dirty = coord.syncMeta().dirty;
  const sync = button("Sync", () => void doSync(coord));
  sync.disabled = !connected || !dirty;
  sync.title = !connected
    ? "Connect a cloud first"
    : !dirty
      ? "Nothing to sync — no local changes since the last sync"
      : "Sync your plan with the cloud";

  const children: Node[] = [
    h("h3", { class: "beta-surface__group" }, "Unity — cloud save"),
    h(
      "p",
      { class: "beta-surface__note" },
      "Cloud connects an account; Sync saves/loads your plan to it (disabled until connected). Naive resolution for now — pushes local edits, else pulls; conflicts just report.",
    ),
    h("div", { class: "beta-surface__row beta-surface__row--inline" }, sync, cloud),
  ];

  children.push(
    h("pre", { class: "beta-surface__status" }, `${lastSyncOutcome}\n\n${JSON.stringify(planSummary(coord), null, 2)}`),
  );
  return children;
}

async function doSync(coord: Coordinator): Promise<void> {
  lastSyncOutcome = "syncing…";
  rerender();
  // The real reconcile (resolution.md): clean → fast-forward, dirty → conditional
  // push, and a 412 (both diverged) → the pick-a-side conflict dialog.
  const result = await syncNow(coord);
  if (result.kind === "conflict") {
    lastSyncOutcome = "conflict — choose a version to keep";
    rerender();
    presentCloudConflict(coord, result.conflict, (outcome) => {
      lastSyncOutcome = `conflict resolved — ${outcome}`;
      rerender();
    });
    return;
  }
  lastSyncOutcome = `sync → ${JSON.stringify(result)}`;
  rerender();
}
