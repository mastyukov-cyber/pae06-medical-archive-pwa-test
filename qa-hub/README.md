# PAE-06 QA HUB v1.0 / CP-QA-HUB-05

**PREPARED ONLY / QA NOT RUN / NO CODE SPACES / NO GITHUB ACTIONS.**

Source: `mastyukov-cyber/pae06-medical-archive-pwa-test` main `7b7795f64e24432bc14e169cc28123a80acfd44b`. New isolated branch: `pilot/pae06-qa-hub-v1-20261121`. Version `v0.8.15-test.0`.

## Security, isolation and exact scope

- Exactly SIX new QA/config files; unchanged app, Mac, Vault, main, PR, Pages, Dropbox and all real records.
- 26 Git blob SHA pins plus independent SHA-256 for the two pinned synthetic PDF fixtures QA-A and QA-B.
- Only `127.0.0.1:8768` future HTTP server in a temporary Linux runner; no forwarded port, credentials, API, upload, hosted preview or deployment.
- Original `src/test-idb-gate.mjs` stays unchanged: top-level `http://127.0.0.1:8768/restore-test.html` is permitted; unknown origin, query, hash and iframe must be denied. No bypass or mock replacement.
- Browser tests **when separately approved** would check version, two QA files, IndexedDB, search, reload, SHA-backed sample, preview/read consent, separate write consent, commit/readback, no-op repeat, and invalid query rejection.
- **Offline is NOT RUN** on HTTP: current source registers the Service Worker only on HTTPS. No claim of offline PASS or actual iPhone Safari acceptance.
- `.devcontainer` has no auto-run hooks and requests no forwarded ports. Run is NOT initiated by branch creation.
- The prospective `qa-hub/.run` JSON report is local to the future runner; the JSON is also printed into its job log, without a GitHub artifact upload.

## Future action — requires separate owner approval

Before any Actions workflow, Codespaces, Terminal, package installation or cloud QA: verify branch and base SHA, budget, temporary Linux runner, visibility and exact manifest. An approved one-shot workflow should use `permissions: contents:read`, pinned checkout with `set-safe-directory: false`, a one-commit guard, fail-fast, <=15 minutes, no retry, secrets or real data. Only then may the authorized runner execute `npm ci --ignore-scripts --no-audit --no-fund`, `npm run verify`, then `npm run qa` (Chromium then Linux WebKit). No commands were executed during preparation.

## Files

- `.devcontainer/devcontainer.json` no-run local config
- `qa-hub/package.json` and `qa-hub/package-lock.json` pinned dependencies
- `qa-hub/qa-hub.mjs` future synthetic tests, currently NOT RUN
- `qa-hub/.gitignore` temporary files excluded
- `qa-hub/README.md` this contract

STOP_FIRST at unexpected mismatch; preserve all previous FAIL; restore by separately authorized branch action only.
