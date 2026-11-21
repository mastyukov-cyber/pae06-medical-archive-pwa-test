# PAE-06 CP08.18-A · Synthetic Mac PDF PageLink viewer

Status: ISOLATED TEST CANDIDATE. No deployment, no real Mac/iPhone Safari, no clinical authority.

This add-only candidate uses the exact verified original PDF.js 6.5.438 assets from PAE-06 CP06.8 and the exact CP08.18 SOURCE_ONLY `src/pdf-page-link.mjs` module, copied byte-for-byte. It reads two frozen synthetic QA-A/QA-B PDFs from the preexisting repository `fixtures/` directory, verifies their SHA-256 plus actual PDF.js page count, renders real PDF canvases and refuses page 3 of 2. It also checks the existing synthetic Mac metadata adapter (`mac-derived-adapter.mjs`) but **does not authenticate a real Mac or import real Mac records**.

No existing application file changes. The candidate does not open or write IndexedDB, does not update the Service Worker or Pages, and does not migrate legacy blobs. It has a dedicated localhost HTTP server restricted to exact permitted assets and a dedicated Linux WebKit browser gate. A WebKit run does not prove iPhone/iPad Safari security.

Expected original SHA-256: `vendor/pdfjs/pdf.mjs` cbabeebf4df66f3fe736f2fa2792d332e019a878b0aa88d5e2be17d439079de4; `vendor/pdfjs/pdf.worker.mjs` 43710009ea26bfbcb615524946e46e3aaf8ad927514f5e465e8ff6d18044ffe9; `src/pdf-page-link.mjs` c50f614419ed45bca80b6a817e8cbf84253a8772c779366c04506abec5ea98bf.

No branch merge, no TEST Pages publication, no patient records, no real Vault access. Historical FAIL unchanged.
