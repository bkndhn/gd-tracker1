/**
 * HTML + Browser Print PDF Export Utility
 * Generates styled HTML tables and opens them in a new window for printing/saving as PDF.
 * Supports Tamil/Unicode text perfectly since it uses native browser rendering.
 */

export interface PDFColumn {
  header: string;
  width?: string; // CSS width (e.g., '60px', '15%')
  align?: 'left' | 'center' | 'right';
}

/** A cell can be plain text or raw HTML (e.g. for embedded images) */
export type CellContent = string | { html: string };

/** Optional per-tenant branding printed in the report header/footer */
export interface PDFBranding {
  orgName?: string;
  logoDataUrl?: string | null;
  footerNote?: string;
  accentColor?: string;
}

export interface HTMLPDFExportOptions {
  title: string;
  subtitle?: string;
  columns: PDFColumn[];
  rows: CellContent[][];
  fileName?: string;
  orientation?: 'portrait' | 'landscape';
  branding?: PDFBranding;
}

export function exportToPDFViaHTML({
  title,
  subtitle,
  columns,
  rows,
  fileName = 'report',
  orientation = 'landscape',
  branding,
}: HTMLPDFExportOptions) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(branding?.accentColor || '') ? branding!.accentColor! : '#7c3aed';
  const brandBlock = branding && (branding.logoDataUrl || branding.orgName)
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        ${branding.logoDataUrl ? `<img src="${branding.logoDataUrl}" alt="" style="height:34px;width:auto;object-fit:contain;" />` : ''}
        ${branding.orgName ? `<div style="font-size:13px;font-weight:700;color:${accent};">${escapeHtml(branding.orgName)}</div>` : ''}
      </div>`
    : '';
  const footerBlock = branding?.footerNote
    ? `<div style="margin-top:10px;padding-top:6px;border-top:1px solid #e5e7eb;font-size:8px;color:#64748b;">${escapeHtml(branding.footerNote)}</div>`
    : '';
  const headerCells = columns
    .map(
      (col) =>
        `<th style="
          padding: 4px 6px;
          text-align: ${col.align || 'left'};
          font-weight: 700;
          font-size: 9px;
          color: #fff;
          background: #7c3aed;
          border: 1px solid #6d28d9;
          white-space: nowrap;
          ${col.width ? `width: ${col.width};` : ''}
        ">${escapeHtml(col.header)}</th>`
    )
    .join('');

  const bodyRows = rows
    .map(
      (row, rowIdx) =>
        `<tr style="background: ${rowIdx % 2 === 0 ? '#fff' : '#f5f3ff'};">
          ${row
            .map(
              (cell, colIdx) => {
                const cellContent = typeof cell === 'string' ? escapeHtml(cell) : cell.html;
                return `<td style="
                  padding: 3px 6px;
                  font-size: 9px;
                  border: 1px solid #e5e7eb;
                  text-align: ${columns[colIdx]?.align || 'left'};
                  word-wrap: break-word;
                  max-width: 220px;
                  vertical-align: middle;
                ">${cellContent}</td>`;
              }
            )
            .join('')}
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;700&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Noto Sans Tamil', 'Latha', 'Tamil Sangam MN', Arial, sans-serif;
      padding: 12px;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-header {
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 2px solid #7c3aed;
    }

    .report-title {
      font-size: 15px;
      font-weight: 700;
      color: #7c3aed;
      margin-bottom: 4px;
    }

    .report-subtitle {
      font-size: 9px;
      color: #64748b;
    }

    .report-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .entry-count {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-family: 'Noto Sans Tamil', 'Latha', 'Tamil Sangam MN', Arial, sans-serif;
    }

    @media print {
      body {
        padding: 0;
      }

      @page {
        size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
        margin: 8mm;
      }

      .no-print {
        display: none !important;
      }

      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      thead { display: table-header-group; }
    }

    .print-btn {
      position: fixed;
      top: 16px;
      right: 16px;
      padding: 10px 24px;
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 1000;
      font-family: 'Noto Sans Tamil', Arial, sans-serif;
    }

    .print-btn:hover {
      background: #6d28d9;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📄 Save as PDF</button>

  ${brandBlock}
  <div class="report-header">
    <div class="report-meta">
      <div class="report-title">${escapeHtml(title)}</div>
      <div class="entry-count">Total: ${rows.length} entries</div>
    </div>
    ${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  ${footerBlock}

  <script>
    // Auto-trigger print after fonts load, with fallback timeout
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() {
        setTimeout(function() { window.print(); }, 500);
      });
    } else {
      setTimeout(function() { window.print(); }, 1500);
    }
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // Fallback: try opening as blob
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export interface MultiSectionPDFOptions {
  title: string;
  subtitle?: string;
  columns: PDFColumn[];
  sections: { title: string; rows: CellContent[][] }[];
  orientation?: 'portrait' | 'landscape';
}

export function exportMultiSectionPDFViaHTML({
  title,
  subtitle,
  columns,
  sections,
  orientation = 'landscape',
}: MultiSectionPDFOptions) {
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);

  const buildTable = (rows: CellContent[][]) => {
    const headerCells = columns
      .map(
        (col) =>
          `<th style="
            padding: 4px 6px;
            text-align: ${col.align || 'left'};
            font-weight: 700;
            font-size: 9px;
            color: #fff;
            background: #7c3aed;
            border: 1px solid #6d28d9;
            white-space: nowrap;
            ${col.width ? `width: ${col.width};` : ''}
          ">${escapeHtml(col.header)}</th>`
      )
      .join('');

    const bodyRows = rows
      .map(
        (row, rowIdx) =>
          `<tr style="background: ${rowIdx % 2 === 0 ? '#fff' : '#f5f3ff'};">
            ${row
              .map(
                (cell, colIdx) => {
                  const cellContent = typeof cell === 'string' ? escapeHtml(cell) : cell.html;
                  return `<td style="
                    padding: 3px 6px;
                    font-size: 9px;
                    border: 1px solid #e5e7eb;
                    text-align: ${columns[colIdx]?.align || 'left'};
                    word-wrap: break-word;
                    max-width: 220px;
                    vertical-align: middle;
                  ">${cellContent}</td>`;
                }
              )
              .join('')}
          </tr>`
      )
      .join('');

    return `<table style="width:100%;border-collapse:collapse;font-family:'Noto Sans Tamil','Latha',Arial,sans-serif;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
  };

  const sectionBlocks = sections
    .map(
      (section, idx) =>
        `<div style="${idx > 0 ? 'page-break-before: always;' : ''}margin-bottom:20px;">
          <h2 style="font-size:12px;font-weight:700;color:#7c3aed;margin:12px 0 8px 0;">
            ${escapeHtml(section.title)} (${section.rows.length} entries)
          </h2>
          ${buildTable(section.rows)}
        </div>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Noto Sans Tamil','Latha','Tamil Sangam MN',Arial,sans-serif;
      padding: 12px; color: #1a1a2e;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .report-header { margin-bottom:8px; padding-bottom:6px; border-bottom:2px solid #7c3aed; }
    .report-title { font-size:15px; font-weight:700; color:#7c3aed; margin-bottom:4px; }
    .report-subtitle { font-size:9px; color:#64748b; }
    .entry-count { font-size:9px; color:#64748b; font-weight:600; }
    .report-meta { display:flex; justify-content:space-between; align-items:center; }
    @media print {
      body { padding:0; }
      @page { size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'}; margin:8mm; }
      .no-print { display:none !important; }
      table { page-break-inside:auto; }
      tr { page-break-inside:avoid; }
      thead { display:table-header-group; }
    }
    .print-btn {
      position:fixed; top:16px; right:16px; padding:10px 24px;
      background:#7c3aed; color:#fff; border:none; border-radius:8px;
      font-size:14px; font-weight:600; cursor:pointer; z-index:1000;
      font-family:'Noto Sans Tamil',Arial,sans-serif;
    }
    .print-btn:hover { background:#6d28d9; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📄 Save as PDF</button>
  <div class="report-header">
    <div class="report-meta">
      <div class="report-title">${escapeHtml(title)}</div>
      <div class="entry-count">Total: ${totalRows} entries | ${sections.length} sections</div>
    </div>
    ${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ''}
  </div>
  ${sectionBlocks}
  <script>
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function() { setTimeout(function() { window.print(); }, 500); });
    } else {
      setTimeout(function() { window.print(); }, 1500);
    }
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Helper to create an image cell for PDF export */
export function makeImageCell(imageUrls: string[]): CellContent {
  if (!imageUrls || imageUrls.length === 0) {
    return { html: '<span style="color:#94a3b8;font-size:10px;">—</span>' };
  }
  const imgs = imageUrls.slice(0, 3).map(
    (url) =>
      `<img src="${url}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb;" onerror="this.style.display='none'" />`
  ).join(' ');
  return { html: `<div style="display:flex;gap:4px;align-items:center;justify-content:center;">${imgs}</div>` };
}
