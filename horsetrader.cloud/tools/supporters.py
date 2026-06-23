#!/usr/bin/env python3
"""Admin tooling for Unity cloud-save entitlements.

First cut: ``ls`` lists the private R2 save bucket and prints one row per save,
including the Unity account id (the R2 key, ``provider:sub``) and the
user-facing identity fields inside the plan blob.

The script uses boto3 against Cloudflare R2's S3-compatible API. It defaults to
the local AWS profile named ``cloudflare``; that profile can carry the R2
``endpoint_url`` in ``~/.aws/config`` and the matching key pair in
``~/.aws/credentials``.

Usage:
    python horsetrader.cloud/tools/supporters.py ls
    python horsetrader.cloud/tools/supporters.py ls --json
    python horsetrader.cloud/tools/supporters.py grant supporters google:123...
    python horsetrader.cloud/tools/supporters.py revoke supporters google:123...
"""

from __future__ import annotations

import argparse
import configparser
import json
import os
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_BUCKET = "unity-saves"
DEFAULT_PROFILE = "cloudflare"
DEFAULT_ENTITLEMENTS_KEY = "entitlements.json"


@dataclass(frozen=True)
class R2Object:
    key: str
    size: int | None
    modified: str | None
    etag: str | None


@dataclass(frozen=True)
class SaveRow:
    key: str
    provider: str
    subject: str
    trainer_name: str
    entitlements: list[str]
    legacy_trainer_id: str
    version: int | None
    size: int | None
    modified: str | None
    etag: str | None
    error: str | None = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bucket", default=DEFAULT_BUCKET, help=f"R2 bucket name (default: {DEFAULT_BUCKET}).")
    parser.add_argument("--profile", default=DEFAULT_PROFILE, help=f"AWS config profile for R2 (default: {DEFAULT_PROFILE}).")
    parser.add_argument("--endpoint-url", help="Override the R2 endpoint URL from the profile config.")
    parser.add_argument("--entitlements-key", default=DEFAULT_ENTITLEMENTS_KEY, help=f"R2 object key for entitlements (default: {DEFAULT_ENTITLEMENTS_KEY}).")
    sub = parser.add_subparsers(dest="cmd", required=True)

    ls = sub.add_parser("ls", help="List cloud saves and identity fields.")
    ls.add_argument("--prefix", default="", help="Only list R2 keys with this prefix.")
    ls.add_argument("--limit", type=int, help="Stop after this many saves.")
    ls.add_argument("--json", action="store_true", help="Emit JSON instead of a table.")
    ls.add_argument("--errors", action="store_true", help="Include rows whose save blob could not be read or parsed.")

    grant = sub.add_parser("grant", help="Grant an account id membership in an entitlement group.")
    grant.add_argument("--entitlements-key", default=argparse.SUPPRESS, help="R2 object key for entitlements.")
    grant.add_argument("group", help="Entitlement group, e.g. supporters or creators.")
    grant.add_argument("account_id", help="Unity account id, e.g. google:123... or discord:123...")

    revoke = sub.add_parser("revoke", help="Revoke an account id from an entitlement group.")
    revoke.add_argument("--entitlements-key", default=argparse.SUPPRESS, help="R2 object key for entitlements.")
    revoke.add_argument("group", help="Entitlement group, e.g. supporters or creators.")
    revoke.add_argument("account_id", help="Unity account id, e.g. google:123... or discord:123...")
    return parser.parse_args()


def configured_endpoint_url(profile: str) -> str | None:
    config_path = Path(os.environ.get("AWS_CONFIG_FILE", "~/.aws/config")).expanduser()
    parser = configparser.ConfigParser()
    parser.read(config_path)
    section = "default" if profile == "default" else f"profile {profile}"
    if parser.has_option(section, "endpoint_url"):
        return parser.get(section, "endpoint_url").strip()
    return None


def r2_client(args: argparse.Namespace) -> Any:
    try:
        import boto3
    except ModuleNotFoundError as exc:
        raise SystemExit("boto3 is required for R2 access; install it into the Python environment running this script") from exc

    session = boto3.Session(profile_name=args.profile)
    endpoint_url = args.endpoint_url or configured_endpoint_url(args.profile)
    if not endpoint_url:
        raise SystemExit(f"profile {args.profile!r} has no endpoint_url; pass --endpoint-url or add one to ~/.aws/config")
    return session.client("s3", endpoint_url=endpoint_url)


def list_objects(client: Any, bucket: str, prefix: str = "", limit: int | None = None) -> list[R2Object]:
    paginator = client.get_paginator("list_objects_v2")
    page_iter = paginator.paginate(Bucket=bucket, Prefix=prefix)
    objects: list[R2Object] = []
    try:
        for page in page_iter:
            for item in page.get("Contents", []):
                key = item.get("Key")
                if not isinstance(key, str):
                    continue
                modified = item.get("LastModified")
                objects.append(
                    R2Object(
                        key=key,
                        size=item.get("Size") if isinstance(item.get("Size"), int) else None,
                        modified=modified.isoformat() if hasattr(modified, "isoformat") else None,
                        etag=str(item.get("ETag", "")).strip('"') or None,
                    )
                )
                if limit is not None and len(objects) >= limit:
                    return objects
    except Exception as exc:
        raise SystemExit(r2_setup_error(exc)) from exc
    return objects


def r2_setup_error(exc: Exception) -> str:
    message = str(exc)
    if "Credential access key has length" in message:
        return (
            "R2 rejected the access key id. This usually means the profile is using a "
            "Cloudflare API token instead of an R2 S3 API token access key id. Create/copy "
            "an R2 API token from the R2 bucket/API-token UI and put its Access Key ID and "
            "Secret Access Key in ~/.aws/credentials under [cloudflare].\n\n"
            f"Raw error: {message}"
        )
    return f"R2 list failed: {message}"


def get_json(client: Any, bucket: str, key: str) -> dict[str, Any]:
    body = client.get_object(Bucket=bucket, Key=key)["Body"].read()
    data = json.loads(body.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("save blob is not a JSON object")
    return data


def identity_from(plan: dict[str, Any]) -> dict[str, Any]:
    config = plan.get("config")
    if not isinstance(config, dict):
        return {}
    identity = config.get("identity")
    return identity if isinstance(identity, dict) else {}


def row_for(client: Any, bucket: str, obj: R2Object) -> SaveRow:
    provider, sep, subject = obj.key.partition(":")
    try:
        plan = get_json(client, bucket, obj.key)
        identity = identity_from(plan)
        version = plan.get("version")
        return SaveRow(
            key=obj.key,
            provider=provider if sep else "",
            subject=subject if sep else "",
            trainer_name=str(identity.get("trainerName") or ""),
            entitlements=[],
            legacy_trainer_id=str(identity.get("trainerId") or ""),
            version=version if isinstance(version, int) else None,
            size=obj.size,
            modified=obj.modified,
            etag=obj.etag,
        )
    except Exception as exc:
        return SaveRow(
            key=obj.key,
            provider=provider if sep else "",
            subject=subject if sep else "",
            trainer_name="",
            entitlements=[],
            legacy_trainer_id="",
            version=None,
            size=obj.size,
            modified=obj.modified,
            etag=obj.etag,
            error=str(exc),
        )


def as_dict(row: SaveRow) -> dict[str, Any]:
    return {
        "account_id": row.key,
        "key": row.key,
        "provider": row.provider,
        "subject": row.subject,
        "trainer_name": row.trainer_name,
        "entitlements": row.entitlements,
        "legacy_trainer_id": row.legacy_trainer_id,
        "version": row.version,
        "size": row.size,
        "modified": row.modified,
        "etag": row.etag,
        **({"error": row.error} if row.error else {}),
    }


def normalise_group(raw: str) -> str:
    group = raw.strip()
    if not group:
        raise SystemExit("entitlement group must not be empty")
    if any(ch.isspace() for ch in group):
        raise SystemExit(f"entitlement group must not contain whitespace: {raw!r}")
    return group


def normalise_account_id(raw: str) -> str:
    account_id = raw.strip()
    provider, sep, subject = account_id.partition(":")
    if not sep or not provider or not subject:
        raise SystemExit(f"account id must look like provider:sub, got {raw!r}")
    return account_id


def validate_entitlements(data: Any, label: str) -> dict[str, list[str]]:
    if not isinstance(data, dict):
        raise SystemExit(f"{label} must be a JSON object mapping group names to account-id lists")
    entitlements: dict[str, list[str]] = {}
    for group, members in data.items():
        if not isinstance(group, str) or not isinstance(members, list) or not all(isinstance(member, str) for member in members):
            raise SystemExit(f"{label} must be a JSON object mapping group names to account-id lists")
        entitlements[group] = sorted(set(members))
    return entitlements


def clean_entitlements(entitlements: dict[str, list[str]]) -> dict[str, list[str]]:
    return {group: sorted(set(members)) for group, members in sorted(entitlements.items())}


def entitlements_text(entitlements: dict[str, list[str]]) -> str:
    return json.dumps(clean_entitlements(entitlements), indent=2, sort_keys=True) + "\n"


def is_missing_object_error(exc: Exception) -> bool:
    response = getattr(exc, "response", None)
    if not isinstance(response, dict):
        return False
    error = response.get("Error")
    return isinstance(error, dict) and error.get("Code") in {"NoSuchKey", "NoSuchBucket", "404", "NotFound"}


def download_entitlements(client: Any, bucket: str, key: str, path: Path) -> dict[str, list[str]]:
    try:
        body = client.get_object(Bucket=bucket, Key=key)["Body"].read()
    except Exception as exc:
        if not is_missing_object_error(exc):
            raise
        body = b"{}\n"
    path.write_bytes(body)
    data = json.loads(body.decode("utf-8"))
    return validate_entitlements(data, f"s3://{bucket}/{key}")


def upload_entitlements(client: Any, bucket: str, key: str, path: Path, entitlements: dict[str, list[str]]) -> dict[str, list[str]]:
    text = entitlements_text(entitlements)
    path.write_text(text, encoding="utf-8")
    client.put_object(Bucket=bucket, Key=key, Body=text.encode("utf-8"), ContentType="application/json")

    verify_body = client.get_object(Bucket=bucket, Key=key)["Body"].read()
    verify_data = validate_entitlements(json.loads(verify_body.decode("utf-8")), f"s3://{bucket}/{key}")
    if clean_entitlements(verify_data) != clean_entitlements(entitlements):
        raise SystemExit(f"upload verification failed for s3://{bucket}/{key}")
    return verify_data


def mutate_entitlements(args: argparse.Namespace, client: Any, op: str) -> tuple[str, dict[str, list[str]]]:
    group = normalise_group(args.group)
    account_id = normalise_account_id(args.account_id)
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", prefix="horsetrader-entitlements-", suffix=".json", dir="/tmp", delete=False) as tmp:
            tmp_path = Path(tmp.name)

        entitlements = download_entitlements(client, args.bucket, args.entitlements_key, tmp_path)
        members = set(entitlements.get(group, []))
        if op == "grant":
            action = "already granted"
            if account_id not in members:
                members.add(account_id)
                action = "granted"
        elif op == "revoke":
            action = "not present"
            if account_id in members:
                members.remove(account_id)
                action = "revoked"
        else:
            raise AssertionError(op)

        entitlements[group] = sorted(members)
        synced = upload_entitlements(client, args.bucket, args.entitlements_key, tmp_path, entitlements)
        return action, synced
    finally:
        if tmp_path is not None:
            try:
                tmp_path.unlink()
            except FileNotFoundError:
                pass


def entitlement_index(entitlements: dict[str, list[str]]) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    for group, members in entitlements.items():
        for account_id in members:
            index.setdefault(account_id, []).append(group)
    return {account_id: sorted(groups) for account_id, groups in index.items()}


def apply_entitlements(rows: list[SaveRow], index: dict[str, list[str]]) -> list[SaveRow]:
    return [
        SaveRow(
            key=row.key,
            provider=row.provider,
            subject=row.subject,
            trainer_name=row.trainer_name,
            entitlements=index.get(row.key, []),
            legacy_trainer_id=row.legacy_trainer_id,
            version=row.version,
            size=row.size,
            modified=row.modified,
            etag=row.etag,
            error=row.error,
        )
        for row in rows
    ]


def print_table(rows: list[SaveRow]) -> None:
    show_legacy = any(row.legacy_trainer_id for row in rows)
    headers = ["account_id", "trainer", "entitlements", "ver", "bytes", "modified"]
    if show_legacy:
        headers.insert(3, "legacy_trainer_id")

    table: list[list[str]] = []
    for row in rows:
        values = [
            row.key,
            row.trainer_name or "-",
            f"[{','.join(row.entitlements)}]" if row.entitlements else "[]",
            str(row.version) if row.version is not None else "-",
            str(row.size) if row.size is not None else "-",
            row.modified or "-",
        ]
        if show_legacy:
            values.insert(3, row.legacy_trainer_id or "-")
        table.append(values)

    widths = [len(h) for h in headers]
    for values in table:
        widths = [max(width, len(value)) for width, value in zip(widths, values, strict=True)]
    print("  ".join(h.ljust(width) for h, width in zip(headers, widths, strict=True)))
    print("  ".join("-" * width for width in widths))
    for values in table:
        print("  ".join(value.ljust(width) for value, width in zip(values, widths, strict=True)))


def cmd_ls(args: argparse.Namespace, client: Any) -> int:
    objects = list_objects(client, args.bucket, prefix=args.prefix, limit=args.limit)
    objects = [obj for obj in objects if obj.key != args.entitlements_key]
    rows = [row_for(client, args.bucket, obj) for obj in objects]
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", prefix="horsetrader-entitlements-ls-", suffix=".json", dir="/tmp", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        entitlements = download_entitlements(client, args.bucket, args.entitlements_key, tmp_path)
    finally:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass
    rows = apply_entitlements(rows, entitlement_index(entitlements))
    failed = sum(1 for row in rows if row.error)
    if not args.errors:
        rows = [row for row in rows if row.error is None]
    if args.json:
        print(json.dumps([as_dict(row) for row in rows], indent=2, sort_keys=True))
    else:
        print_table(rows)
        suffix = f", {failed} failed" if failed else ""
        print(f"\n{len(rows)} saves in {args.bucket}{suffix}", file=sys.stderr)
    return 0


def cmd_grant(args: argparse.Namespace, client: Any) -> int:
    group = normalise_group(args.group)
    account_id = normalise_account_id(args.account_id)
    action, entitlements = mutate_entitlements(args, client, "grant")
    print(f"{action} {group} {account_id} ({len(entitlements[group])} members in s3://{args.bucket}/{args.entitlements_key})", file=sys.stderr)
    return 0


def cmd_revoke(args: argparse.Namespace, client: Any) -> int:
    group = normalise_group(args.group)
    account_id = normalise_account_id(args.account_id)
    action, entitlements = mutate_entitlements(args, client, "revoke")
    print(f"{action} {group} {account_id} ({len(entitlements[group])} members in s3://{args.bucket}/{args.entitlements_key})", file=sys.stderr)
    return 0


def main() -> int:
    args = parse_args()
    if args.cmd == "ls":
        client = r2_client(args)
        return cmd_ls(args, client)
    if args.cmd == "grant":
        client = r2_client(args)
        return cmd_grant(args, client)
    if args.cmd == "revoke":
        client = r2_client(args)
        return cmd_revoke(args, client)
    raise SystemExit(f"unknown command: {args.cmd}")


if __name__ == "__main__":
    raise SystemExit(main())
