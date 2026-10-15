#!/usr/bin/env python3
"""Upload built SOPs from sops/dist/ to the portal's Supabase Storage bucket.

Runs in the "SOP publish" GitHub Action after a merge to main, once
build.py has produced sops/dist/. It can also be run by hand:

    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 sops/tools/publish.py --dry-run

Where each file lands is set in sops/publish.config.json, NOT here, because
it must match what the portal already reads. The one-time setup fills that
file in by reading the portal code; until "confirmed" is true there, this
script refuses to upload anything.

The service role key bypasses row-level security. It lives only in GitHub
Actions secrets and 1Password (HGM-SOP-WEB-001). Never in .env files in the
repo, never in the front end.
"""
import glob
import json
import mimetypes
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DIST = os.path.join(ROOT, "sops", "dist")
CONFIG = os.path.join(ROOT, "sops", "publish.config.json")


def upload(base, key, bucket, object_path, local, dry):
    ctype = mimetypes.guess_type(local)[0] or "application/octet-stream"
    if local.endswith(".md"):
        ctype = "text/markdown; charset=utf-8"
    print(f"  {'(dry run) ' if dry else ''}{bucket}/{object_path}  [{ctype}]")
    if dry:
        return
    req = urllib.request.Request(
        f"{base.rstrip('/')}/storage/v1/object/{bucket}/{object_path}",
        data=open(local, "rb").read(), method="POST",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": ctype, "x-upsert": "true",
                 "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req) as r:
        if r.status >= 300:
            sys.exit(f"Upload failed for {object_path}: HTTP {r.status}")


def main():
    dry = "--dry-run" in sys.argv
    cfg = json.load(open(CONFIG))
    if not cfg.get("confirmed") and not dry:
        sys.exit("sops/publish.config.json is not confirmed. Run the one-time setup "
                 "(sops/SETUP-PROMPT.md) so the paths match what the portal reads.")
    base = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not dry and not (base and key):
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")

    bucket = cfg["bucket"]
    for sop_dir in sorted(glob.glob(os.path.join(DIST, "HGM-SOP-*"))):
        sop_id = os.path.basename(sop_dir)
        print(sop_id)
        for local in sorted(glob.glob(os.path.join(sop_dir, "*"))):
            name = os.path.basename(local)
            ext = name.rsplit(".", 1)[-1]
            pattern = cfg["paths"].get(ext)
            if not pattern:
                continue
            stem = name.rsplit(".", 1)[0]
            version = stem.rsplit("_v", 1)[-1]
            obj = pattern.format(sop_id=sop_id, file=name, stem=stem, version=version)
            upload(base, key, bucket, obj, local, dry)

    hook = cfg.get("after_publish")
    if hook:
        print(f"after_publish: {hook}")
        if not dry:
            subprocess.run(hook, shell=True, check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
