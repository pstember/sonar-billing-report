import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCSV, exportToExcel, exportToPDF } from './exportUtils';

describe('exportToCSV', () => {
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    capturedBlob = null;
    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();
    createObjectURLSpy = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: vi.fn(),
    });
    const mockLink = {
      setAttribute: vi.fn(),
      style: {},
      click: vi.fn(),
    };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => mockLink),
      body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces CSV with headers and rows matching expected content', async () => {
    const data = [
      { name: 'Project A', ncloc: 1000 },
      { name: 'Project B', ncloc: 2000 },
    ];
    exportToCSV(data, 'report.csv');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(capturedBlob).not.toBeNull();
    const content = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(capturedBlob!);
    });
    expect(content).toContain('name,ncloc');
    expect(content).toContain('"Project A",1000');
    expect(content).toContain('"Project B",2000');
  });

  it('handles empty array', async () => {
    exportToCSV([], 'empty.csv');
    expect(capturedBlob).not.toBeNull();
    const content = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(capturedBlob!);
    });
    expect(content).toBe('');
  });

  it('handles missing keys in row (uses empty string)', async () => {
    const data = [{ a: 1 }, { a: 2, b: 'x' }];
    exportToCSV(data, 'partial.csv');
    const content = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(capturedBlob!);
    });
    // Headers come from first row only; second row's extra key 'b' is not in headers
    expect(content).toContain('a');
    expect(content).toContain('1');
    expect(content).toContain('2');
    expect(content.split('\n')).toHaveLength(3);
  });
});

const xlsxMocks = vi.hoisted(() => ({
  json_to_sheet: vi.fn(() => ({})),
  book_new: vi.fn(() => ({})),
  book_append_sheet: vi.fn(),
  writeFile: vi.fn(),
}));
vi.mock('xlsx', () => ({
  utils: {
    json_to_sheet: xlsxMocks.json_to_sheet,
    book_new: xlsxMocks.book_new,
    book_append_sheet: xlsxMocks.book_append_sheet,
  },
  writeFile: xlsxMocks.writeFile,
}));

describe('exportToExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes xlsx with expected data, filename and sheetName', async () => {
    const data = [{ col1: 'a', col2: 1 }];
    await exportToExcel(data, 'report.xlsx', 'MySheet');

    expect(xlsxMocks.json_to_sheet).toHaveBeenCalledWith(data);
    expect(xlsxMocks.book_append_sheet).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MySheet'
    );
    expect(xlsxMocks.writeFile).toHaveBeenCalledWith(expect.anything(), 'report.xlsx');
  });
});

const jspdfMocks = vi.hoisted(() => ({
  doc: {
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    internal: { pageSize: { getHeight: () => 297 } },
  },
  jsPDF: vi.fn(),
  autoTable: vi.fn(),
}));
// Vitest 4: mock constructor with mockImplementation (mockReturnValue not allowed for `new`)
jspdfMocks.jsPDF.mockImplementation(function () {
  return jspdfMocks.doc;
});
vi.mock('jspdf', () => ({ jsPDF: jspdfMocks.jsPDF }));
vi.mock('jspdf-autotable', () => ({ default: jspdfMocks.autoTable }));

describe('exportToPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes jspdf and autoTable with expected data and saves filename', async () => {
    const data = [{ name: 'P1', ncloc: 100 }];
    await exportToPDF(data, 'report.pdf');

    expect(jspdfMocks.autoTable).toHaveBeenCalledWith(
      jspdfMocks.doc,
      expect.objectContaining({
        head: [['name', 'ncloc']],
        body: [['P1', '100']],
      })
    );
    expect(jspdfMocks.doc.save).toHaveBeenCalledWith('report.pdf');
  });

  it('renders last row as table footer with distinct styling when multiple rows', async () => {
    const data = [
      { name: 'P1', ncloc: 100 },
      { name: 'Total', ncloc: 100 },
    ];
    await exportToPDF(data, 'report.pdf');

    expect(jspdfMocks.autoTable).toHaveBeenCalledWith(
      jspdfMocks.doc,
      expect.objectContaining({
        head: [['name', 'ncloc']],
        body: [['P1', '100']],
        foot: [['Total', '100']],
        footStyles: expect.objectContaining({ fontStyle: 'bold' }),
      })
    );
  });

  it('does nothing when data is empty', async () => {
    await exportToPDF([], 'report.pdf');
    expect(jspdfMocks.doc.save).not.toHaveBeenCalled();
  });
});
