# Store, share, and update client .env files in 1Password

Every client's environment file lives in one place: a Secure Note in that client's 1Password vault. If you remember one thing: **never send a credential** — point people at the vault, and send a private link if they need help finding it.

## Document header

| Field | Value |
|---|---|
| SOP ID | HGM-SOP-WEB-001 |
| Version | 1.1 |
| Owner | Web & Content Specialist (Kyle Zinger) |
| Approved by | Operations Manager (Gillian) |
| Effective date | 2026-09-01 |
| Next review date | 2027-03-01 |
| Frequency / trigger | A new project needing a .env.local file, or any change to a stored value |
| Time to complete | ~5 minutes for Phases 1–5; 30–45 minutes for Phase 6 |
| Status | draft |

## 01. Purpose and scope

**Purpose** — Client website projects need configuration values — API keys, account IDs, secrets — to run. This puts the complete `.env.local` file for every client in one controlled place in 1Password, so credentials stop moving through chat, email and shared drives, and anyone picking up a project can get running without asking a teammate to send them a file.

**In scope** — Every client website project that needs a `.env.local` file to run locally, and the complete contents of that file — every variable in it, not a filtered subset.

**Out of scope** — Production deployment configuration, version control, and scheduled audits of stored files. This is about storing, sharing and updating the file in 1Password, and where each value comes from. Nothing else.

### Four standing rules

These hold on every project. Everything else in this document is procedure; these are not per-project judgement calls.

1. **The complete file goes in the note** — Every variable in `.env.local`, comment lines included. A Secure Note is free-form text, so the file goes in exactly as it appears on disk — paste in, copy out, no reassembly and no filtering.
2. **Update the date header on every change** — Without exception. It is the only signal anyone has that their local copy is stale.
3. **Announce every change** — Post in the **Web Team** Google Chat group. Nothing propagates automatically.
4. **Never send a key directly** — No `.env` file and no individual key through chat, email or a shared drive. Point the person at the vault instead. A private link is a pointer, not a credential, and is fine to send — see task 5.4.

## 02. Roles and responsibilities

| Role | Responsibility |
|---|---|
| Anyone on the dev team | Performs every phase in this SOP |
| 1Password admins (Gillian, Kyle) | Grant and remove client vault access |
| Web & Content Specialist (Kyle Zinger) | Owns this SOP and keeps it current |
| Operations Manager (Gillian) | Approves this SOP and each revision |

> **[NOTE] This task is not gated by role**
> HGM is a small team. Anyone on the dev team runs any phase here. The only restricted actions are granting and removing vault access, which the 1Password admins do.

## 03. Prerequisites

Everything below is needed before task 1.1 of any phase.

1. **1Password** — The desktop app, signed in to the HGM account.
2. **Client vault access** — Membership of the client's vault. Request from Gillian or Kyle in the **Web Team** Google Chat group.
3. **VS Code** — Used to create the file. Finder hides dotfiles and cannot.
4. **Service dashboards** — Access to the dashboard of each service that issues a key for the project, for Phases 2, 3 and 6.

### Where the file lives

One Secure Note per client, stored inside that client's existing vault.

| Element | Exact value |
|---|---|
| Vault | The client's vault (for example `Awayframes`), or `<Client> – Dev` where the client vault is shared beyond the dev team |
| Item type | Secure Note |
| Item title | `ENV — <Client> (.env.local)` |
| Line 1 of the note | `# UPDATED YYYY-MM-DD — <name>` |

> **[NOTE] The prefix is deliberate**
> Searching `ENV — ` in 1Password returns every environment file across every client vault in one view.

## 04. Definitions

**.env.local** — A plain text file at the project root holding configuration as `NAME=value` lines, one per line. Read by the site when it runs.

**Secure Note** — A 1Password item type that stores free-form text. Holds the full contents of a `.env.local` file.

**Date header** — Line 1 of every note, in the form `# UPDATED YYYY-MM-DD — <name>`. Records when the note last changed and who changed it.

**Private link** — A 1Password link that opens a specific item directly. Resolves only for people who already have access to that vault, so it points at a credential without revealing one.

**Production credential** — A key pointing at the live client system. Handles real bookings and real money.

**PIT** — Private Integration Token. GoHighLevel's per-location API credential.

**CAPI** — Conversions API. Meta's server-side event endpoint; its access token is a credential.

**Service role key** — Supabase's highest-privilege key. Bypasses row-level security.

## 05. Procedure

### What are you trying to do?

Six procedures. They are independent — pick the one that matches your situation and go straight to it.

**Phase 1** — Tasks 1.1–1.9. New machine, new project, or someone just changed a value.

**Phase 2** — Tasks 2.1–2.8. A key was rotated or replaced at the service that issued it.

**Phase 3** — Tasks 3.1–3.8. The project needs a value that is not in the note yet.

**Phase 4** — Tasks 4.1–4.2. Someone new needs to run the project.

**Phase 5** — Tasks 5.1–5.5. Point someone who already has access straight at the item.

**Phase 6** — Tasks 6.1–6.5. Revoke, then rotate. Revoking alone is not enough.

### Phase 1 — Get a file onto your machine

#### 1.1 Search 1Password for `ENV — <Client>`  `WEB-001.1.1`

The `ENV — ` prefix narrows the search to environment files only, across every client vault.

#### 1.2 Open the item `ENV — <Client> (.env.local)`  `WEB-001.1.2`

> Expected result: A line beginning `# UPDATED` at the top of the note.

#### 1.3 Read line 1 and confirm the date is not older than your last local copy  `WEB-001.1.3`

> **[WARNING] If the note has no date header**
> Do not use it. Ask in the **Web Team** Google Chat group who edited it last and have them add one.

#### 1.4 Copy the entire note contents  `WEB-001.1.4`

Comment lines included. Do not select a subset of variables.

![The Secure Note open in 1Password, date header on line 1, note body showing `NAME=value` lines and comments.](fig_HGM-SOP-WEB-001_f1-note.png)
*The Secure Note open in 1Password, date header on line 1, note body showing `NAME=value` lines and comments.*

#### 1.5 Open the project folder in VS Code  `WEB-001.1.5`

#### 1.6 Right-click the project root in the Explorer pane and select **New File**  `WEB-001.1.6`

![VS Code Explorer right-click menu with **New File** highlighted, at the project root.](fig_HGM-SOP-WEB-001_f2-newfile.png)
*VS Code Explorer right-click menu with **New File** highlighted, at the project root.*

#### 1.7 Name the file `.env.local` and press Return  `WEB-001.1.7`

> **[WARNING] Create it in VS Code, not Finder**
> Finder hides dotfiles, so a file you create there will not show up afterward and you will make a second one.

#### 1.8 Paste the copied contents into the file, then save with `Cmd + S`  `WEB-001.1.8`

#### 1.9 Run the project locally  `WEB-001.1.9`

> Expected result: The site builds and serves without a missing-environment-variable error.

### Phase 2 — Update a value

#### 2.1 Obtain the new value from the service that issued it  `WEB-001.2.1`

#### 2.2 Open `ENV — <Client> (.env.local)` in 1Password  `WEB-001.2.2`

#### 2.3 Click **Edit**  `WEB-001.2.3`

#### 2.4 Replace the value in place  `WEB-001.2.4`

Leave the variable name and any comment above it untouched.

#### 2.5 Change line 1 to today's date and your name  `WEB-001.2.5`

Keep the format `# UPDATED YYYY-MM-DD — <name>`.

#### 2.6 Click **Save**  `WEB-001.2.6`

![The note in edit mode with the date header line selected.](fig_HGM-SOP-WEB-001_f3-edit.png)
*The note in edit mode with the date header line selected.*

#### 2.7 Post the change in the Web Team Google Chat group  `WEB-001.2.7`

Nothing propagates automatically. This message is the entire mechanism.

*POST THIS IN WEB TEAM CHAT*
```
ENV updated for <Client> — re-copy before your next local run.
```

#### 2.8 Update your own `.env.local`  `WEB-001.2.8`

Repeat tasks 1.4 and 1.8.

### Phase 3 — Add a new variable

#### 3.1 Obtain the value from the service that issues it  `WEB-001.3.1`

#### 3.2 Open `ENV — <Client> (.env.local)` in 1Password  `WEB-001.3.2`

#### 3.3 Click **Edit**  `WEB-001.3.3`

#### 3.4 Add a comment line stating what the variable is for and which service issues it  `WEB-001.3.4`

#### 3.5 Add the variable below it as `NAME=value`, on its own line  `WEB-001.3.5`

#### 3.6 Change line 1 to today's date and your name  `WEB-001.3.6`

#### 3.7 Click **Save**  `WEB-001.3.7`

#### 3.8 Post the addition in the Web Team Google Chat group  `WEB-001.3.8`

*POST THIS IN WEB TEAM CHAT*
```
New variable added to ENV for <Client> — re-copy before your next local run.
```

### Phase 4 — Give someone access to a project

#### 4.1 Ask Gillian or Kyle to add the person to the client's vault  `WEB-001.4.1`

In the **Web Team** Google Chat group. Where a `<Client> – Dev` vault exists, use that one.

> Expected result: They appear in the vault's member list in 1Password.

#### 4.2 Send them this SOP ID and tell them to follow Phase 1  `WEB-001.4.2`

> **[CRITICAL] Send them no credential directly**
> Everything they need is in the vault once access is granted. Sending a value “just to unblock them” is the exact thing this SOP exists to stop.

### Phase 5 — Send someone a direct link to the note

#### 5.1 Confirm the person already has access to the client's vault  `WEB-001.5.1`

If they do not → run Phase 4 first. A private link will not work for them until they do.

#### 5.2 Open `ENV — <Client> (.env.local)` in 1Password  `WEB-001.5.2`

> **[NOTE] The item must be in a shared vault**
> Private links do not resolve for items in a Private vault.

#### 5.3 Click the ellipsis **…** on the item  `WEB-001.5.3`

Available in the desktop app, the browser extension, and on 1password.com.

#### 5.4 Select **Copy Private Link**  `WEB-001.5.4`

![The item ellipsis menu open in 1Password with **Copy Private Link** highlighted, showing **Share** as a separate entry.](fig_HGM-SOP-WEB-001_f4-link.png)
*The item ellipsis menu open in 1Password with **Copy Private Link** highlighted, showing **Share** as a separate entry.*

> **[CRITICAL] Copy Private Link, never Share**
> The same menu offers **Share**, which creates a link anyone can open *without* a 1Password account and which reveals the full contents of the note. Never use **Share** on an ENV note. **Copy Private Link** resolves only for people who already have vault access, which is why it is safe to paste into chat.

#### 5.5 Paste the link into the Web Team Google Chat group, or into your reply to their request  `WEB-001.5.5`

> Expected result: They open the link and land directly on the item in their own 1Password app.

### Phase 6 — Remove someone's access

#### 6.1 Ask Gillian or Kyle to remove the person from every client vault they held  `WEB-001.6.1`

#### 6.2 List every project they had access to  `WEB-001.6.2`

Write the list down before you start rotating. Phase 6 is the one procedure where losing your place has real consequences.

#### 6.3 Rotate every credential below, at the service that issued it  `WEB-001.6.3`

For each project on your list. Record each new value as you go.

| Credential | Rotate at |
|---|---|
| Hostaway API key | Hostaway |
| Stripe secret key | Stripe |
| Stripe webhook signing secret | Stripe — regenerate after rotating the secret key |
| Resend API key | Resend |
| Supabase service role key | Supabase |
| GoHighLevel PIT | GoHighLevel |
| Meta CAPI access token | Meta |
| `ADMIN_SECRET`, `ACTION_LINK_SECRET`, `SYNC_SECRET`, `CRON_SECRET` | Generated per site — regenerate each one |

#### 6.4 Replace every rotated value in each affected note  `WEB-001.6.4`

Open the note, click **Edit**, paste each new value, then change line 1 to today's date and your name.

> Expected result: Every affected note carries today's date on line 1.

#### 6.5 Post completion in the Web Team Google Chat group, naming each project you rotated  `WEB-001.6.5`

*POST THIS IN WEB TEAM CHAT*
```
Access removed for <name>. Rotated and updated ENV for: <project>, <project>.
```

## 06. Exceptions and edge cases

**Every credential in the note is usable** — Because the complete file is stored, a note may contain production credentials. Anyone with vault access can use them, and anyone who has already copied the file keeps them until they are rotated. Phase 6 is the only thing that closes that.

**A client vault shared beyond the dev team** — Create `<Client> – Dev` and store the note there instead. Do not put a `.env` note in a vault that people outside the dev team can open.

**Someone outside the HGM 1Password account needs a value** — A private link will not work for them. Do not use **Share** on the ENV note. Create a separate temporary item containing only the value they need, share that, then delete it.

**Revisit this SOP ahead of its review date** — If a stale local copy causes an incident or a repeated time loss; if a contractor joins who needs access cut off cleanly; or if more than four people need local access to the same project.

> **[WARNING] What this SOP does not protect against**
> Stated plainly so nobody assumes more than is true. Plaintext copies still exist on individual laptops — this stops files moving through chat and email, it does not eliminate local copies. Nobody is notified automatically when a value changes; standing rule 3 is the entire mechanism. And a credential someone has copied cannot be recalled — Phase 6 is the only way to close it.

## 07. Troubleshooting and escalation

| Symptom | Fix | If unresolved |
|---|---|---|
| Site fails to start with a missing environment variable error | A variable was added to the note after you last copied it. Repeat Phase 1. | Web Team Google Chat |
| The note has no `# UPDATED` date header | Do not use it. Ask who edited it last and have them add one. | Web Team Google Chat |
| `.env.local` does not appear after you create it | You created it in Finder, which hides dotfiles. Delete it and repeat tasks 1.5–1.8. | Web Team Google Chat |
| No 1Password vault exists for a new client | Request the vault from Gillian or Kyle. Do not store the file anywhere else in the meantime. | Gillian or Kyle, Web Team Google Chat |
| A private link opens to an error or an empty item | Confirm you are signed in to the HGM account and have access to that client's vault. | Gillian or Kyle, Web Team Google Chat |
| A credential was sent through chat, email or a shared drive | Rotate it at the issuing service, update the note per Phase 2, then delete the message. | Web Team Google Chat |
| A value in the note does not work | Confirm you copied the whole note and did not truncate a long value. If it still fails, rotate at source and run Phase 2. | Web Team Google Chat |

> **[BRAND] Escalation**
> Every row above escalates to the **Web Team** Google Chat group. **Gillian** (Operations Manager) and **Kyle Zinger** (Web & Content Specialist) are the 1Password admins and can act on any vault or access issue.

## 08. Final checklist after removing access

Phase 6 is the one flow here with a point of no return: until every credential is rotated, the person who left still holds working keys. Run this before you call it done.

- [ ] The person is removed from every client vault they held
- [ ] You have a written list of every project they had access to
- [ ] Every credential in the task 6.3 table is rotated, for every project on that list
- [ ] Stripe's webhook signing secret was regenerated *after* the secret key
- [ ] Every per-site secret — `ADMIN_SECRET`, `ACTION_LINK_SECRET`, `SYNC_SECRET`, `CRON_SECRET` — was regenerated
- [ ] Every affected note carries today's date and your name on line 1
- [ ] Each affected site still runs locally with the new values
- [ ] Completion is posted in the Web Team Google Chat group, naming each project

## 09. Related documents

- `HGM-SOP-OPS-001` — Produce and publish an HGM SOP
- `HGM-SOP-WEB-002` — Take a website change request from Asana to live
- 1Password item links and **Copy Private Link** — https://support.1password.com/item-links/
- 1Password item categories and Secure Notes — https://support.1password.com/item-categories/

## 10. Revision history

| Date | Version | Author | Change summary |
|---|---|---|---|
| 2026-08-11 | 1.0 | Kyle Zinger | Initial release |
| 2026-09-01 | 1.1 | Kyle Zinger | Rebuilt to the current house style. Purpose and scope merged; the four standing rules moved into a rules block; the flat 6.1–6.6 procedure restructured into six phases of numbered tasks; a final checklist added for the access-removal flow. No change to the process itself. The four screenshots remain uncaptured. |

---

**Remember**

> “A private link is a pointer, not a credential. Everything else — the file, the key, the value — stays in the vault.”

**Questions?** Web Team Google Chat group
