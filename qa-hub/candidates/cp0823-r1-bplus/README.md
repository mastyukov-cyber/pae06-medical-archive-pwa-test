# CP08.23-R1 — B+ synthetic export preview integration

**Stacked Draft PR, source-only, no publication.** The new B+ entry at `qa-hub/candidates/cp0823-r1-bplus/` references unchanged CSS from CP08.20 and unchanged app.mjs from CP08.22 via relative paths. Its two export buttons navigate to the original CP08.23 synthetic HTML preview at `../cp0823-export/index.html`. Browser Back returns to the B+ screen.

This PR is intended to target existing Draft PR #4 branch `pilot/pae06-cp0822-bplus-contract-20261122` (head b89794694fca885d2cfb96793ee54f87be36c577). Neither PR #4 nor TEST main is modified. For deployment these dependencies must be merged in order, only after separate authorization and QA.

The `cp0823-export/` core source files are copied byte-for-byte from owner-approved CP08.23 ZIP SHA-256 `638e3688259b2f85f5f76b119085af30d859f5717325e95dc0e1536bc1a7c308`. They import only the CP08.22 synthetic strict adapter and fixture. No PDF, XLSX or CSV file is created; save/share buttons are disabled, patient identifiers and originals are withheld even if selected. No diagnosis or clinical recommendation.

QA: node integration.test.mjs (new scoped tests), node --check for all JS, Git blob/source comparison. Physical iPad Safari/WebKit and HTTPS browser delivery NOT RUN. Source fixture + old QA log are not revalidated as fresh medical evidence.
