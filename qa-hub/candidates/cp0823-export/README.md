# PAE-06 CP08.23 — B+ synthetic export planning / preview

- Pure read-only preview. **NO PDF, XLSX, CSV FILE GENERATION. NO DOWNLOAD, SHARE, PRINT, NETWORK OR PERSISTENCE.**
- Reuses exact CP08.22 `adapter.mjs` and `fixture.mjs` (Git blob SHA verified); these were included only for standalone local QA.
- `export-plan.mjs`: deterministic fail-closed selection and preview; `synthetic-fixture.mjs` contains invented QA values only.
- `index.html`, `styles.css`, `export-preview.mjs`: interactive B+ preparation UI on localhost (ES modules); open `REVIEW_OFFLINE.html` directly for single-file preview.
- All dates, sources, laboratory references and methodologies retained; unsupported comparisons explicitly marked.
- Brief PDF template displays latest two values per analyte, full template shows all selected; page count and file bytes are ALWAYS null.
- Real clinical data, original PDFs, personal identifiers and saving/sharing are NOT possible, even when UI options are checked.
- Approved design source: PAE-06 Master Roadmap issue #6 comments 7071990746, 7072117779, 7072206098, 7072376842.
- QA: run `node tests.mjs` (Node 22 local; Node 26 and Safari not run here).
- Does not alter GitHub main, PR #4, TEST Pages, Mac, RDC, Dropbox, Vault or user data.
