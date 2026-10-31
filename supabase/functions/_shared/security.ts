// Shared security helpers for edge functions.

/** Escape a value for safe interpolation into HTML (email bodies, etc). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Render untrusted plain text (e.g. AI output) as escaped HTML paragraphs. */
export function textToSafeHtml(text: unknown): string {
  const plain = String(text ?? '').replace(/<[^>]*>/g, '');
  return plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.5">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** Neutralise spreadsheet formula triggers in a CSV cell. */
export function neutralizeFormula(value: unknown): string {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/**
 * Verify the scheduled-job secret header against the value stored in the
 * database vault. Requires a service-role client.
 */
// deno-lint-ignore no-explicit-any
export async function isValidCronRequest(req: Request, serviceClient: any): Promise<boolean> {
  const header = req.headers.get('x-cron-secret');
  if (!header) return false;
  const { data, error } = await serviceClient.rpc('verify_cron_secret', { _secret: header });
  if (error) return false;
  return data === true;
}
