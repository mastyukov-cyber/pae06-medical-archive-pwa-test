# PAE-06 CP08.25 — navigation and offline preparation

Base TEST main: 1a3ef7eafbb34ec0eb763739438e340581eb8a23. One isolated Draft PR, no merge or Pages deployment.
9 existing text files modified; 2 new QA files. Root Documents ↔ B+ Labs ↔ Export Preview.
25 original Service Worker precache entries preserved, 14 B+ dependencies appended, 39 total.
SW install/activate/fetch and one-client consent handlers preserved. Old cache pae06-cp0815-restore-assets-v1 allowlisted for removal only on successful new cache activation.
Root release/app/SW/HTML version synchronized as v0.8.25-test.0 / 20261122-cp0825-navigation-01.
IndexedDB name, schema, synthetic QA PDFs, restore and backup routines remain unchanged. No real data.

Static source audit before GitHub writes: 158/158 PASS in isolated ChatGPT script, all 19 source blob SHA confirmed.
Historical failures preserved: direct local git read failed because DNS unavailable; first static-path audit failed on unavailable URL global, corrected to pure path resolution.
New Node 26 test source is provided for later QA but has NOT been executed. Chrome-only Mac offline/restart/update/persistence QA NOT RUN, separate RDC approval required.
No Safari/WebKit; no real PDF/XLSX/CSV generation; Security Gate and FINAL remain NO-GO.

Next: Node 26 static test; one isolated owner-approved Chrome-on-Mac QA with two viewport sizes, offline cycle and IndexedDB QA-A/QA-B persistence, then independent GitHub verification.
