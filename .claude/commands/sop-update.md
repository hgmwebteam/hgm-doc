---
description: Revise an existing HGM SOP and open a pull request for it
argument-hint: <SOP-ID> <what to change>
---
Revise an HGM SOP. Request: $ARGUMENTS

Read `sops/CLAUDE.md` first and follow "Revising an existing SOP" step by step
(the master is the highest `_v#_#` file for the ID in `reference/sop/masters/`),
using the `hgm-sop-author` and `hgm-doc-render` skills and the house style in
`sops/house-style/`.

The first word of the request is the SOP ID (a short form like `WEB-002` means
`HGM-SOP-WEB-002`). Everything after it is the change.

Before editing, tell me in two or three lines: the SOP and its current version,
what you will change, and the new version number with the reason (+0.1 wording,
whole number for a process change, none for presentation only). If the request
is clear, carry straight on without waiting. If it leaves a real gap, ask me one
batched round of questions and wait.

Finish by opening the pull request and giving me its link, the gate result, and
anything a person still has to check by eye.
