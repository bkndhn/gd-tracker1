/**
 * Warehouse Manual Fulfillment Sheet Generator
 *
 * Designed for manual, physical warehouse processing (picking, packing, moving, dispatching)
 * featuring:
 * - Physical tick-mark box [ ] / ☐ at the beginning of each row
 * - IST Time with 12-hour AM/PM format across all devices
 * - Destination shop, size, category, and quantity details
 * - Warehouse pack and dispatch signoff lines for physical pen-and-paper signing
 * - Store receipt confirmation lines
 * - Direct Print, PDF, and Excel export formats
 */

import * as XLSX from 'xlsx';
import { formatISTDateTime, formatISTShort, formatISTFileName } from '@/lib/dateUtils';
import { exportToPDFViaHTML } from '@/utils/htmlPdfExport';
import type { StockRequirement } from '@/hooks/useRequirements';
import type { ExportTemplate } from '@/lib/reportTemplate';
import { DEFAULT_EXPORT_TEMPLATE } from '@/lib/reportTemplate';
import { logAudit } from '@/utils/auditLog';

export interface FulfillmentExportOptions {
  rows: StockRequirement[];
  scopeLabel?: string; // e.g. "Filtered Queue", "Selected Items", "All Available"
  template?: ExportTemplate;
  accentColor?: string;
}

/**
 * Direct Print: Opens a dedicated, styled print window formatted for A4 landscape
 * with physical checkbox squares, IST timestamps, alternating row shading, and signature signoffs.
 */
export function directPrintFulfillmentSheet({
  rows,
  scopeLabel = 'Warehouse Queue',
  template = DEFAULT_EXPORT_TEMPLATE,
  accentColor = '#7c3aed',
}: FulfillmentExportOptions) {
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) {
    alert('Please allow popups to open the printable picking sheet.');
    return;
  }

  const generatedTimeIST = formatISTDateTime(new Date());
  const orgName = template.orgName || 'GD Tracker';
  const totalQty = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);

  logAudit({
    action: 'data_export',
    targetType: 'warehouse_queue',
    details: { format: 'print', count: rows.length, totalQty, scope: scopeLabel },
  });
  const urgentCount = rows.filter(r => r.urgency === 'urgent').length;

  const tableRowsHtml = rows.map((r, index) => {
    const isUrgent = r.urgency === 'urgent';
    const reqTime = formatISTShort(r.created_at);
    const packedInfo = r.packed_at
      ? `${r.packed_qty ?? r.quantity} pcs · ${r.packed_by_name || 'Staff'}`
      : '____ pcs by _______';
    const movedInfo = r.moved_at
      ? `${formatISTShort(r.moved_at)} · ${r.moved_by_name || 'Staff'}`
      : 'Date: ____/____';
    const receivedInfo = r.received_at
      ? `Recv: ${r.received_by_name || 'Store'}`
      : 'Sign: ____________';

    return `
      <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'}; ${isUrgent ? 'border-left: 3px solid #dc2626;' : ''}">
        <td style="text-align: center; vertical-align: middle; padding: 6px 4px;">
          <div style="width: 14px; height: 14px; border: 1.8px solid #374151; border-radius: 2px; margin: 0 auto; background: #fff;"></div>
        </td>
        <td style="padding: 6px 6px; font-size: 10px; white-space: nowrap; font-weight: 500;">
          #${index + 1}<br>
          <span style="color: #6b7280; font-size: 9px;">${reqTime}</span>
        </td>
        <td style="padding: 6px 6px; font-size: 11px; font-weight: 600;">
          ${escapeHtml(r.shop_name || '—')}
        </td>
        <td style="padding: 6px 6px; font-size: 11px; font-weight: 700; color: #111827;">
          ${escapeHtml(r.size)}
        </td>
        <td style="padding: 6px 6px; font-size: 10px; color: #4b5563;">
          ${escapeHtml(r.category || 'General')}
        </td>
        <td style="padding: 6px 6px; font-size: 12px; font-weight: 700; text-align: right; color: #1e1b4b;">
          ${r.quantity}
        </td>
        <td style="padding: 6px 6px; font-size: 10px; text-align: center;">
          ${isUrgent
            ? '<span style="display:inline-block;padding:2px 5px;font-size:9px;font-weight:700;color:#991b1b;background:#fee2e2;border-radius:4px;border:1px solid #f87171;">URGENT</span>'
            : '<span style="color:#6b7280;">Normal</span>'}
        </td>
        <td style="padding: 6px 6px; font-size: 10px; color: #374151;">
          ${escapeHtml(r.requested_by_name || '—')}
        </td>
        <td style="padding: 6px 6px; font-size: 10px;">
          <span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;text-transform:uppercase;background:#e0e7ff;color:#3730a3;">
            ${r.status}
          </span>
        </td>
        <td style="padding: 6px 6px; font-size: 9.5px; font-family: monospace; color: #4b5563; border-left: 1px dashed #d1d5db;">
          ${packedInfo}
        </td>
        <td style="padding: 6px 6px; font-size: 9.5px; font-family: monospace; color: #4b5563;">
          ${movedInfo}
        </td>
        <td style="padding: 6px 6px; font-size: 9.5px; font-family: monospace; color: #4b5563; border-left: 1px dashed #d1d5db;">
          ${receivedInfo}
        </td>
        <td style="padding: 6px 6px; font-size: 9px; color: #6b7280; max-width: 140px; word-break: break-word;">
          ${escapeHtml(r.note || r.reject_reason || '—')}
        </td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Warehouse Fulfillment Picking Sheet - ${scopeLabel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      padding: 16px;
      color: #111827;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 2px solid ${accentColor};
      margin-bottom: 12px;
    }
    .title {
      font-size: 18px;
      font-weight: 700;
      color: ${accentColor};
      letter-spacing: -0.02em;
    }
    .sub {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }
    .stats-pills {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .pill {
      font-size: 10px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
    }
    .pill.urgent { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    .pill.accent { background: #ede9fe; color: #5b21b6; border-color: #ddd6fe; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th {
      background: ${accentColor};
      color: #ffffff;
      padding: 6px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border: 1px solid ${accentColor};
      text-align: left;
    }
    td {
      border: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    .signoff-box {
      margin-top: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      padding: 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      page-break-inside: avoid;
    }
    .sign-line {
      margin-top: 32px;
      border-bottom: 1px dashed #9ca3af;
      padding-bottom: 2px;
      font-size: 10px;
      color: #4b5563;
      text-align: center;
    }
    .sign-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 4px;
    }
    .no-print {
      position: fixed;
      top: 12px;
      right: 12px;
      display: flex;
      gap: 8px;
      z-index: 1000;
    }
    .btn {
      padding: 8px 16px;
      background: ${accentColor};
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .btn.close { background: #6b7280; }
    @media print {
      body { padding: 4mm 6mm; }
      .no-print { display: none !important; }
      @page {
        size: A4 landscape;
        margin: 6mm;
      }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn" onclick="window.print()">Print Picking Sheet</button>
    <button class="btn close" onclick="window.close()">Close Window</button>
  </div>

  <div class="header-bar">
    <div>
      <div class="title">${escapeHtml(orgName)} — Warehouse Stock Fulfillment Sheet</div>
      <div class="sub">
        <strong>${escapeHtml(scopeLabel)}</strong> · Printed on <strong>${generatedTimeIST} (IST)</strong>
      </div>
      <div class="stats-pills">
        <span class="pill accent">Total Requests: ${rows.length}</span>
        <span class="pill accent">Total Quantity: ${totalQty} pcs</span>
        ${urgentCount > 0 ? `<span class="pill urgent">⚠ ${urgentCount} URGENT</span>` : ''}
      </div>
    </div>
    <div style="text-align: right; font-size: 10px; color: #6b7280;">
      <div>Standard Operating Procedure</div>
      <div style="font-weight: 600; color: #374151;">Manual Warehouse Fulfillment Checklist</div>
      <div>Tick ☐ when packed & verified</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 28px; text-align: center;">☐</th>
        <th style="width: 70px;">Req # / IST</th>
        <th>Destination Shop</th>
        <th style="width: 55px;">Size</th>
        <th style="width: 75px;">Category</th>
        <th style="width: 45px; text-align: right;">Qty</th>
        <th style="width: 65px; text-align: center;">Urgency</th>
        <th>Requested By</th>
        <th style="width: 70px;">Status</th>
        <th style="width: 140px;">Warehouse Packing</th>
        <th style="width: 120px;">Move / Dispatch</th>
        <th style="width: 120px;">Store Receipt</th>
        <th style="width: 120px;">Notes / Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length === 0
        ? `<tr><td colspan="13" style="text-align:center;padding:24px;color:#9ca3af;">No stock requirements match the selected criteria.</td></tr>`
        : tableRowsHtml}
    </tbody>
  </table>

  <div class="signoff-box">
    <div>
      <div class="sign-label">1. Warehouse Picker / Packer</div>
      <div class="sign-line">Sign & Employee ID</div>
    </div>
    <div>
      <div class="sign-label">2. Warehouse Dispatcher / Driver</div>
      <div class="sign-line">Sign & Vehicle / Handover Time</div>
    </div>
    <div>
      <div class="sign-label">3. Store Receiving Staff</div>
      <div class="sign-line">Sign & Branch Stamp</div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      // Small timeout to allow styles/fonts to paint
      setTimeout(() => { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Excel Export with physical tick mark column `[  ]` and IST AM/PM formatting.
 */
export function exportFulfillmentSheetToExcel({
  rows,
  scopeLabel = 'Warehouse Queue',
  template = DEFAULT_EXPORT_TEMPLATE,
}: FulfillmentExportOptions) {
  const generatedTimeIST = formatISTDateTime(new Date());
  const orgName = template.orgName || 'GD Tracker';

  logAudit({
    action: 'data_export',
    targetType: 'warehouse_queue',
    details: { format: 'excel', count: rows.length, scope: scopeLabel },
  });

  const head: (string | number)[][] = [
    [orgName],
    [`WAREHOUSE STOCK FULFILLMENT & PICKING SHEET — ${scopeLabel.toUpperCase()}`],
    [`Generated: ${generatedTimeIST} (IST) · Total Requests: ${rows.length}`],
    [],
  ];

  const columns = [
    'Check [ ]',
    'Req #',
    'Requested At (IST)',
    'Shop Name',
    'Size',
    'Category',
    'Quantity',
    'Urgency',
    'Requested By',
    'Status',
    'Packed By',
    'Packed At (IST)',
    'Packed Qty',
    'Moved By',
    'Moved At (IST)',
    'Received By',
    'Received At (IST)',
    'Warehouse Pack Signoff',
    'Dispatch Signoff',
    'Store Receipt Sign',
    'Notes / Reason',
  ];

  const dataRows: (string | number)[][] = rows.map((r, idx) => [
    '[   ]',
    `#${idx + 1}`,
    formatISTDateTime(r.created_at),
    r.shop_name || '—',
    r.size,
    r.category || 'General',
    r.quantity,
    r.urgency.toUpperCase(),
    r.requested_by_name || '—',
    r.status.toUpperCase(),
    r.packed_by_name || '—',
    r.packed_at ? formatISTDateTime(r.packed_at) : '—',
    r.packed_qty ?? (r.status === 'packed' ? r.quantity : '—'),
    r.moved_by_name || '—',
    r.moved_at ? formatISTDateTime(r.moved_at) : '—',
    r.received_by_name || '—',
    r.received_at ? formatISTDateTime(r.received_at) : '—',
    r.packed_by_name ? `Packed by ${r.packed_by_name}` : '____ pcs by _______',
    r.moved_by_name ? `Moved by ${r.moved_by_name}` : 'Date: ____/____',
    r.received_by_name ? `Received by ${r.received_by_name}` : 'Sign: ____________',
    r.note || r.reject_reason || '—',
  ]);

  const foot: (string | number)[][] = [
    [],
    ['Manual Warehouse Fulfilment Sign-off:'],
    ['Packer Signature: _______________________', 'Dispatcher Signature: _______________________', 'Store Receiver Signature: _______________________'],
  ];

  const aoa = [...head, columns, ...dataRows, ...foot];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Real dynamic Auto-fit column widths based on longest string in each column
  sheet['!cols'] = columns.map((col, colIdx) => {
    let maxLen = col.length;
    for (const r of dataRows) {
      const val = r[colIdx];
      if (val != null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    return { wch: Math.min(50, Math.max(10, maxLen + 3)) };
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Fulfillment');
  const fileName = formatISTFileName(new Date(), `warehouse-fulfillment-${scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  XLSX.writeFile(book, `${fileName}.xlsx`);
}

/**
 * Plain CSV Export for warehouse fulfillment with physical tick mark column `[  ]` and IST timestamps.
 */
export function exportFulfillmentSheetToCSV({
  rows,
  scopeLabel = 'Warehouse Queue',
  template = DEFAULT_EXPORT_TEMPLATE,
}: FulfillmentExportOptions) {
  const generatedTimeIST = formatISTDateTime(new Date());
  const orgName = template.orgName || 'GD Tracker';

  logAudit({
    action: 'data_export',
    targetType: 'warehouse_queue',
    details: { format: 'csv', count: rows.length, scope: scopeLabel },
  });

  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const columns = [
    'Check [ ]',
    'Req #',
    'Requested At (IST)',
    'Shop Name',
    'Size',
    'Category',
    'Quantity',
    'Urgency',
    'Requested By',
    'Status',
    'Packed By',
    'Packed At (IST)',
    'Packed Qty',
    'Moved By',
    'Moved At (IST)',
    'Received By',
    'Received At (IST)',
    'Notes / Reason',
  ];

  const lines: string[] = [];
  lines.push(esc(orgName));
  lines.push(esc(`WAREHOUSE STOCK FULFILLMENT & PICKING SHEET — ${scopeLabel.toUpperCase()}`));
  lines.push(esc(`Generated: ${generatedTimeIST} (IST) · Total Requests: ${rows.length}`));
  lines.push('');
  lines.push(columns.map(esc).join(','));

  rows.forEach((r, idx) => {
    const row = [
      '[  ]',
      `#${idx + 1}`,
      formatISTDateTime(r.created_at),
      r.shop_name || '—',
      r.size,
      r.category || 'General',
      r.quantity,
      r.urgency.toUpperCase(),
      r.requested_by_name || '—',
      r.status.toUpperCase(),
      r.packed_by_name || '—',
      r.packed_at ? formatISTDateTime(r.packed_at) : '—',
      r.packed_qty ?? (r.status === 'packed' ? r.quantity : '—'),
      r.moved_by_name || '—',
      r.moved_at ? formatISTDateTime(r.moved_at) : '—',
      r.received_by_name || '—',
      r.received_at ? formatISTDateTime(r.received_at) : '—',
      r.note || r.reject_reason || '—',
    ];
    lines.push(row.map(esc).join(','));
  });

  lines.push('');
  lines.push(esc('Manual Warehouse Fulfillment Sign-off:'));
  lines.push('Packer Signature: _______________________,Dispatcher Signature: _______________________,Store Receiver Signature: _______________________');

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = formatISTFileName(new Date(), `warehouse-fulfillment-${scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  a.download = `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * PDF Export with physical tick mark column `☐` and IST AM/PM formatting.
 */
export function exportFulfillmentSheetToPDF({
  rows,
  scopeLabel = 'Warehouse Queue',
  template = DEFAULT_EXPORT_TEMPLATE,
  accentColor = '#7c3aed',
}: FulfillmentExportOptions) {
  const generatedTimeIST = formatISTDateTime(new Date());
  const orgName = template.orgName || 'GD Tracker';

  logAudit({
    action: 'data_export',
    targetType: 'warehouse_queue',
    details: { format: 'pdf', count: rows.length, scope: scopeLabel },
  });

  exportToPDFViaHTML({
    title: `${orgName} — Warehouse Stock Fulfillment Sheet`,
    subtitle: `${scopeLabel} · ${rows.length} requests · Printed ${generatedTimeIST} (IST)`,
    orientation: 'landscape',
    branding: {
      orgName,
      accentColor,
      footerNote: 'Manual fulfillment sheet with tick box [☐]. All dates/times rendered in Indian Standard Time (IST, UTC+5:30).',
    },
    columns: [
      { header: '☐', width: '28px', align: 'center' },
      { header: 'Req #', width: '40px', align: 'center' },
      { header: 'Requested At (IST)', width: '100px' },
      { header: 'Shop', width: '90px' },
      { header: 'Size', width: '50px' },
      { header: 'Category', width: '70px' },
      { header: 'Qty', width: '40px', align: 'right' },
      { header: 'Urgency', width: '55px', align: 'center' },
      { header: 'Requested By', width: '85px' },
      { header: 'Status', width: '65px', align: 'center' },
      { header: 'Warehouse Pack', width: '105px' },
      { header: 'Dispatch / Move', width: '95px' },
      { header: 'Store Receipt', width: '95px' },
      { header: 'Notes', width: '100px' },
    ],
    rows: rows.map((r, idx) => [
      { html: '<div style="width:12px;height:12px;border:1.5px solid #333;margin:0 auto;border-radius:2px;"></div>' },
      `#${idx + 1}`,
      formatISTShort(r.created_at),
      r.shop_name || '—',
      r.size,
      r.category || 'General',
      String(r.quantity),
      r.urgency === 'urgent' ? '<span style="color:#b91c1c;font-weight:700;">URGENT</span>' : 'Normal',
      r.requested_by_name || '—',
      r.status.toUpperCase(),
      r.packed_at ? `${r.packed_qty ?? r.quantity} pcs (${r.packed_by_name || 'Staff'})` : '___ pcs by ____',
      r.moved_at ? `${formatISTShort(r.moved_at)} (${r.moved_by_name || 'Staff'})` : 'Date: ____/____',
      r.received_at ? `Recv by ${r.received_by_name || 'Store'}` : 'Sign: _________',
      r.note || r.reject_reason || '—',
    ]),
    fileName: formatISTFileName(new Date(), `warehouse-fulfillment-${scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
  });
}

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
