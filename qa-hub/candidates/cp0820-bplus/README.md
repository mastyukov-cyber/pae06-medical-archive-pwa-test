# PAE-06 B+ Medical Hybrid — CP08.20

OWNER-APPROVED design: GitHub Medical Archive Issue #6 comments 7068931535, 7071990746, 7072117779, 7072206098, 7072376842.

This is an isolated **source-only** interactive HTML/CSS/JavaScript candidate (not deployed), for iPad 13-inch landscape first. It reads only the existing **synthetic** CP08.19 fixture and validation model via relative imports `../cp0819-labs/fixture.mjs` and `../cp0819-labs/lab-core.mjs`. It never uses network APIs, IndexedDB, localStorage, writing APIs, medical inference, PDFs, or export file generation.

Test after checking out branch, with a localhost static server at repository root; example `python3 -m http.server 8876 --bind 127.0.0.1`, then visit `http://127.0.0.1:8876/qa-hub/candidates/cp0820-bplus/`. This is a **manual instruction only**: no server is launched by this readme.

Export settings/preview show actual selected synthetic rows in HTML, **not an exported file**. Save and sharing are deliberately disabled. Source button explains originals are not available in the synthetic demo.

Expected safety: add-only files within `qa-hub/candidates/cp0820-bplus/`; no changes to `main`, Pages, root PWA, backups, medical archive, Obsidian Vault, CI or historical test results. Device/Safari acceptance is separate.
