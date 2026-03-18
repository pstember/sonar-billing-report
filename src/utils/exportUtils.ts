/**
 * Export utilities for charts and data
 * XLSX and jsPDF are lazy-loaded on first Excel/PDF export to keep the main bundle smaller.
 */

/**
 * Export data to CSV
 */
export function exportToCSV(data: Array<Record<string, any>>, filename: string) {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h] || '')).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to Excel
 */
export async function exportToExcel(data: Array<Record<string, any>>, filename: string, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-size columns
  const maxWidth = 50;
  const wscols = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(maxWidth, Math.max(key.length, 10)),
  }));
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export data to PDF (billing report table)
 */
export async function exportToPDF(data: Array<Record<string, any>>, filename: string) {
  if (!data || data.length === 0) return;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headers = Object.keys(data[0] || {});
  const body = data.map((row) => headers.map((h) => String(row[h] ?? '')));

  doc.setFontSize(14);
  doc.text('Billing Report', 14, 12);
  doc.setFontSize(10);
  doc.text(`Generated on ${new Date().toISOString().split('T')[0]}`, 14, 18);

  autoTable(doc, {
    head: [headers],
    body,
    startY: 24,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  doc.save(filename);
}
