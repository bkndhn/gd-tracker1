import { useAdminSetting } from '@/hooks/useAdminSetting';
import {
  DEFAULT_EXPORT_TEMPLATE,
  EXPORT_TEMPLATE_KEY,
  normalizeExportTemplate,
  type ExportTemplate,
} from '@/lib/reportTemplate';

/** Per-admin PDF/Excel branding template (logo, shop name, header/footer). */
export const useExportTemplate = () => {
  const { value, loading, save, canEdit, reload } = useAdminSetting<ExportTemplate>(
    EXPORT_TEMPLATE_KEY,
    DEFAULT_EXPORT_TEMPLATE,
    normalizeExportTemplate,
  );
  return { template: value, loading, save, canEdit, reload };
};
