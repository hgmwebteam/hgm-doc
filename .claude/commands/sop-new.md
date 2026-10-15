---
description: Write a new HGM SOP from notes, a transcript, a Scribe export or screenshots
argument-hint: <DEPT> <working title> — then paste or attach the material
---
Write a new HGM SOP. Request: $ARGUMENTS

Read `sops/CLAUDE.md`, then follow the `hgm-sop-author` skill exactly, with the
house style in `sops/house-style/` (the v1.9 addendum wins: seven sections, no
Definitions or Roles sections).

1. Work out the next ID in the department from `sops/masters/` and
   confirm it with me before using it.
2. Read all the material I gave you. Then ask me one batched round of questions
   covering whatever it leaves open: trigger and frequency, tools and access, the
   exact steps, decision points, failure modes, who to ask when stuck (role,
   person, channel), and time to complete. Skip anything already answered.
3. Draft the SOP in chat as Markdown for my review, with every gap as
   `[NEEDS INPUT: …]` and every needed image as `[SCREENSHOT n.m: …]`.
4. Only after I approve the draft: build `sops/masters/<ID>_v0_1.json`
   as version `0.1`, `status: draft`, with its figures in `sops/figures/`,
   run `build.py`, look at every page, and open a pull request on a branch named
   `sop/<ID>-v0.1`.
