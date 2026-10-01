# Dictionary resources

PDFs offered for download on `/dictionary`, under **Resources**. Drop a file in here with
exactly one of these names, commit, and its View and Download buttons switch on. No code
change is needed: the build lists whatever PDFs are in this folder
(`src/pages/team/dictionary/dictionary-resources.ts`).

| File name                            | Shown as                                 |
| :----------------------------------- | :--------------------------------------- |
| `hgm-industry-acumen-dictionary.pdf` | The HiddenGem Industry Acumen Dictionary |
| `call-sheet-cheat-sheet.pdf`         | Call sheet cheat sheet (Tier A terms)    |
| `client-tech-stack-guide.pdf`        | Client tech stack guide                  |

To replace a PDF, overwrite it under the same name. Keep each one small (a few MB):
git keeps every version forever, and these ship with the site.

**These files are public.** Like the rest of the site's files, a PDF here can be opened by
anyone who has its link, signed in or not, and this repository is public on GitHub. Only put
documents here that are fine to share outside HGM; anything internal-only needs storage that
checks who is asking.
