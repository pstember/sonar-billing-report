/**
 * Export utilities for charts and data
 * XLSX and jsPDF are lazy-loaded on first Excel/PDF export to keep the main bundle smaller.
 */

/**
 * Export data to CSV
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(data[0] ?? {});
  const csvContent = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
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
export async function exportToExcel(data: Record<string, unknown>[], filename: string, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-size columns
  const maxWidth = 50;
  const wscols = Object.keys(data[0] ?? {}).map((key) => ({
    wch: Math.min(maxWidth, Math.max(key.length, 10)),
  }));
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, filename);
}

/** Sonar brand colors as RGB arrays for jsPDF (0–255). */
const SONAR_PDF = {
  blue: [18, 110, 211] as [number, number, number],       // #126ED3 primary
  blueSecondary: [12, 93, 181] as [number, number, number], // #0C5DB5
  purple: [41, 0, 66] as [number, number, number],         // #290042
  purpleLight: [80, 40, 100] as [number, number, number],   // lighter purple for footer
  teal: [27, 153, 139] as [number, number, number],        // #1B998B
  backgroundLight: [238, 252, 252] as [number, number, number], // #EEFCFC
  white: [255, 255, 255] as [number, number, number],
  textSecondary: [105, 128, 155] as [number, number, number],   // #69809B
};

/**
 * Export data to PDF (billing report table).
 * Uses Sonar brand colors; last row is rendered as a distinct footer (Total row).
 */
export async function exportToPDF(data: Record<string, unknown>[], filename: string) {
  if (!data || data.length === 0) return;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headers = Object.keys(data[0] ?? {});
  const rowToCells = (row: Record<string, unknown>) =>
    headers.map((h) => (typeof row[h] === 'string' || typeof row[h] === 'number' ? String(row[h]) : ''));

  const hasFooterRow = data.length > 1;
  const bodyRows = hasFooterRow ? data.slice(0, -1) : data;
  const body = bodyRows.map(rowToCells);
  const foot = hasFooterRow ? [rowToCells(data[data.length - 1]!)] : undefined;

  const generatedDate = new Date().toISOString().split('T')[0];

  doc.setTextColor(...SONAR_PDF.purple);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Billing Report', 14, 12);
  doc.setTextColor(...SONAR_PDF.textSecondary);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${generatedDate}`, 14, 18);

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerText = `SonarQube Cloud Billing Report · Generated on ${generatedDate}`;

  autoTable(doc, {
    head: [headers],
    body,
    ...(foot ? { foot } : {}),
    startY: 24,
    styles: { fontSize: 8 },
    headStyles: {
      fillColor: SONAR_PDF.blue,
      textColor: SONAR_PDF.white,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: SONAR_PDF.purple,
      textColor: SONAR_PDF.white,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    showFoot: 'lastPage',
    didDrawPage: (data) => {
      if (data.pageNumber !== doc.getNumberOfPages()) return;
      doc.setTextColor(...SONAR_PDF.textSecondary);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(footerText, 14, pageHeight - 8);
    },
  });

  doc.save(filename);
}
