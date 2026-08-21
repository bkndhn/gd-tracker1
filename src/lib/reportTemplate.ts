/**
 * Per-admin export template (branding) applied to every PDF / Excel export.
 */

export interface ExportTemplate {
  orgName: string;
  /** Small logo stored inline as a data URL (kept under ~200KB) */
  logoDataUrl: string | null;
  headerNote: string;
  footerNote: string;
  showDateRange: boolean;
  accentColor: string;
}

export const DEFAULT_EXPORT_TEMPLATE: ExportTemplate = {
  orgName: '',
  logoDataUrl: null,
  headerNote: '',
  footerNote: '',
  showDateRange: true,
  accentColor: '#7c3aed',
};

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v.slice(0, 400) : fallback);

export function normalizeExportTemplate(raw: any): ExportTemplate {
  const t = raw || {};
  const logo = typeof t.logoDataUrl === 'string' && t.logoDataUrl.startsWith('data:image/')
    ? t.logoDataUrl
    : null;
  return {
    orgName: str(t.orgName, DEFAULT_EXPORT_TEMPLATE.orgName),
    logoDataUrl: logo,
    headerNote: str(t.headerNote),
    footerNote: str(t.footerNote),
    showDateRange: t.showDateRange !== false,
    accentColor: /^#[0-9a-f]{6}$/i.test(t.accentColor || '') ? t.accentColor : DEFAULT_EXPORT_TEMPLATE.accentColor,
  };
}

export const EXPORT_TEMPLATE_KEY = 'export_template';
