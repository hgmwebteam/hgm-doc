# Dictionary resources

Files offered for download on `/dictionary`, under **Resources**. Drop a file in here with
exactly one of these names, commit, and its buttons switch on. No code change is needed:
the build lists whatever PDFs and PowerPoints are in this folder
(`src/pages/team/dictionary/dictionary-resources.ts`).

| File name                               | Shown as                                 |
| :-------------------------------------- | :--------------------------------------- |
| `hgm-industry-acumen-dictionary.pdf`    | The HiddenGem Industry Acumen Dictionary |
| `call-sheet-cheat-sheet.pdf`            | Call sheet cheat sheet (Tier A terms)    |
| `client-tech-stack-guide.pdf`           | Client tech stack guide                  |
| `industry-acumen-session-1-slides.pdf`  | Session 1 slides: View and Download PDF  |
| `industry-acumen-session-1-slides.pptx` | Session 1 slides: Download PowerPoint    |
| `industry-acumen-session-2-slides.pdf`  | Session 2 slides: View and Download PDF  |
| `industry-acumen-session-2-slides.pptx` | Session 2 slides: Download PowerPoint    |

**The session slides are copies.** Their masters are the Google Slides decks (exported to
`Documents/HiddenGem Media/Team Training & Presentations/Industry Acumen/`). To update one,
export both the PDF and the .pptx from Google Slides (File → Download), so the two match,
and overwrite both here under the same names. Never edit them here. The .pptx carries the
speaker notes; the PDF doesn't.

To replace any file, overwrite it under the same name. Keep each one small (a few MB):
git keeps every version forever, and these ship with the site. Replace the decks when they
really change, not for every typo.

**These files are public.** Like the rest of the site's files, a file here can be opened by
anyone who has its link, signed in or not, and this repository is public on GitHub. Only put
documents here that are fine to share outside HGM; anything internal-only needs storage that
checks who is asking. The decks' speaker notes are public too (Kyle agreed, 8 Oct 2026).
