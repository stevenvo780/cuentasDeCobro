export function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export function calculateRowTotal(hours, rate) {
  const h = parseFloat(hours) || 0;
  const r = parseFloat(rate) || 0;
  return h * r;
}

export function toggleExportElements(show) {
  const els = document.querySelectorAll('#app-controls, .no-print, .print-hide');
  els.forEach(el => {
    if (show) {
      el.style.display = el.dataset.origDisplay || '';
    } else {
      el.dataset.origDisplay = el.style.display;
      el.style.display = 'none';
    }
  });
}
