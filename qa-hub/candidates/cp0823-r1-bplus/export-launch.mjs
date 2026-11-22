/* CP08.23-R1 — view-only bridge. Adds navigation without changing CP08.22 B+ handlers. */
const EXPORT_ROUTE = '../cp0823-export/index.html';
function navigateExport(event) {
  const target = event.target?.closest?.('#openExport, #resultExportBtn');
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign(EXPORT_ROUTE);
}
document.addEventListener('click', navigateExport, true);
