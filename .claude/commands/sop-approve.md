---
description: Mark an SOP approved by the Operations Manager and open a pull request
argument-hint: <SOP-ID> [approval date, default today]
---
Mark an SOP as approved. Request: $ARGUMENTS

Only do this because I, Kyle, have told you the Operations Manager approved it.

1. Read the master. Run `python3 sops/tools/build.py <ID>`. If any
   `[NEEDS INPUT]` or `[SCREENSHOT]` flag remains, or any hard check fails, stop
   and list them. An SOP with open gaps cannot be approved.
2. On a branch `sop/<ID>-approved`: set `meta.status` to `approved`. If the
   version is a `0.x` draft, make it `1.0`. Set `effective_date` to the approval
   date and `next_review` to six months after it. Set `approved_by` to
   "Operations Manager (Gillian)" unless I name someone else. Remove "draft"
   wording from `meta.eyebrow`. If the version changed, save the master as
   `reference/sop/masters/<ID>_v1_0.json` and `git rm` the old file in the same
   commit.
3. Add a revision-history row: date, new version, Kyle Zinger, "Approved by the
   Operations Manager." Rebuild, check, and open the pull request.
