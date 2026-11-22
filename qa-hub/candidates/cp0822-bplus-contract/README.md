# CP08.22 — B+ synthetic lab contract integration (ISOLATED DRAFT)

- Source: unchanged CP08.20 B+ HTML/layout and CSS at `../cp0820-bplus/styles.css`.
- New `app.mjs` changes only the data imports/counters and date comparison to use the **exact CP08.21** read-only `adapter.mjs`.
- `data-source.mjs` wraps the existing CP08.19 + CP08.20 **synthetic** fixtures in a TEST-only envelope with **invented hash labels**, validates via CP08.21, quarantines untrusted rows, then reuses CP08.19 `ingest` for the display model.
- `fixture.mjs` is an unchanged CP08.21 QA fixture; `data-source.test.mjs` covers new integration only.
- Original PDF not available; export remains disabled/preview-only; no real Mac identity, medical data, cloud/API, DB or file writing.
- This folder is **NOT DEPLOYED**. It must not be merged or published without separate owner approval.
- This folder requires its siblings `cp0819-labs` and `cp0820-bplus` from the existing TEST repository. Review only with a local synthetic static-server or a separately approved branch-preview environment.
- Safari/WebKit and physical-device QA not claimed. Source provenance does not constitute a real-Mac trust attestation.
