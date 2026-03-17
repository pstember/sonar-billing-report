/**
 * Export utilities for charts and data
 */

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
export function exportToExcel(data: Array<Record<string, any>>, filename: string, sheetName = 'Sheet1') {
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
export function exportToPDF(data: Array<Record<string, any>>, filename: string) {
  if (!data || data.length === 0) return;

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

/**
 * Export chart as PNG
 */
export function exportChartAsPNG(chartId: string, filename: string) {
  const chartElement = document.getElementById(chartId);
  if (!chartElement) return;

  // This is a simplified version - for production, use html2canvas or similar
  const svg = chartElement.querySelector('svg');
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx?.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
    });
  };

  img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
}

/**
 * Generate billing report data
 */
export function generateBillingReport(data: {
  teams: Array<{
    teamName: string;
    totalNLOC: number;
    totalCost: number;
    projectCount: number;
  }>;
  period: string;
  currency: string;
}) {
  return {
    reportDate: new Date().toISOString(),
    period: data.period,
    currency: data.currency,
    totalCost: data.teams.reduce((sum, t) => sum + t.totalCost, 0),
    totalNLOC: data.teams.reduce((sum, t) => sum + t.totalNLOC, 0),
    teams: data.teams,
  };
}
