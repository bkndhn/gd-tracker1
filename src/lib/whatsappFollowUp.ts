/**
 * Phone validation + WhatsApp deep-link helpers for lost-sale follow ups.
 * Everything here works on data the caller already has (RLS/tenant scoped),
 * so no cross-tenant data can leak into a generated link.
 */

/** Indian mobile: exactly 10 digits, first digit 6-9. */
export const INDIAN_MOBILE_RE = /^[6-9][0-9]{9}$/;

/** Keeps only digits and trims a leading 91 / 0 country or trunk prefix. */
export const normalizePhone = (raw: string | undefined | null): string => {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
};

export const isValidPhone = (raw: string | undefined | null): boolean =>
  INDIAN_MOBILE_RE.test(normalizePhone(raw));

export const PHONE_RULE_MESSAGE = 'must be exactly 10 digits and start with 6, 7, 8 or 9';

/** wa.me needs the number in international format without symbols. */
export const toWaNumber = (raw: string): string => `91${normalizePhone(raw)}`;

export interface FollowUpContext {
  phone: string;
  shopName?: string;
  reason?: string;
  category?: string;
  size?: string;
  customerType?: string;
  notes?: string;
  visitedAt?: string | Date | null;
  /** Extra tenant custom fields: label -> value */
  extras?: Record<string, string>;
  /** Signature line, usually the reporter or the shop */
  reporterName?: string;
}

const lower = (s?: string) => (s || '').toLowerCase();

/** Picks a context-aware ask so staff do not have to think about the reply. */
export const smartAsk = (ctx: FollowUpContext): string => {
  const hay = `${lower(ctx.reason)} ${lower(ctx.category)} ${lower(ctx.notes)}`;

  if (/(stock|unavailab|not available|sold out|out of)/.test(hay)) {
    return 'We are restocking this shortly. Shall I reserve one for you and message you the moment it arrives?';
  }
  if (/(size|fit|small|large|medium)/.test(hay)) {
    return `We can arrange the right size${ctx.size ? ` (${ctx.size})` : ''} for you. Would you like me to book it in your name?`;
  }
  if (/(price|cost|expensive|budget|discount|offer)/.test(hay)) {
    return 'We have a better offer running on this now. Would you like me to share the revised price and options in your budget?';
  }
  if (/(colour|color|design|model|variant|style)/.test(hay)) {
    return 'We just received new colours and designs in this range. Can I share a few photos that match what you were looking for?';
  }
  if (/(quality|damage|defect|torn|broken)/.test(hay)) {
    return 'Sorry about that experience. We have fresh stock now and I would personally check it for you. May I keep a piece aside?';
  }
  if (/(service|staff|wait|queue|billing|slow|rude)/.test(hay)) {
    return 'Sorry for the inconvenience during your visit. Could you share what went wrong so we can fix it and make your next visit smooth?';
  }
  return 'Could you let us know what would have made this purchase work for you? We would love to arrange it on your next visit.';
};

const formatVisitDate = (value?: string | Date | null): string => {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

/** Builds the pre-filled WhatsApp text for one lost-sale log. */
export const buildFollowUpMessage = (ctx: FollowUpContext): string => {
  const lines: string[] = [];
  const shop = ctx.shopName && ctx.shopName !== 'Unknown' ? ctx.shopName : 'our store';
  const when = formatVisitDate(ctx.visitedAt);

  lines.push(`Hello 👋 This is ${shop}.`);
  lines.push(when ? `Thank you for visiting us on ${when}.` : 'Thank you for visiting us recently.');

  const detail: string[] = [];
  if (ctx.category && ctx.category !== 'Unknown') detail.push(ctx.category);
  if (ctx.size && ctx.size !== 'Unknown') detail.push(`size ${ctx.size}`);
  if (detail.length) lines.push(`You were looking for ${detail.join(', ')}.`);
  if (ctx.reason && ctx.reason !== 'Unknown') lines.push(`Reason noted: ${ctx.reason}.`);

  Object.entries(ctx.extras || {}).forEach(([label, value]) => {
    if (value) lines.push(`${label}: ${value}`);
  });

  if (ctx.notes?.trim()) lines.push(`Our note: "${ctx.notes.trim().slice(0, 200)}"`);

  lines.push('');
  lines.push(smartAsk(ctx));
  if (ctx.reporterName) lines.push(`- ${ctx.reporterName}, ${shop}`);

  return lines.join('\n');
};

export const buildFollowUpLink = (ctx: FollowUpContext): string =>
  `https://wa.me/${toWaNumber(ctx.phone)}?text=${encodeURIComponent(buildFollowUpMessage(ctx))}`;

/* ------------------------------------------------------------------ *
 * Smart reply templates (per-admin configurable, tenant isolated)
 * ------------------------------------------------------------------ */

export type TemplateKey =
  | 'stock' | 'size' | 'price' | 'variant' | 'quality' | 'service' | 'general';

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  stock: 'Out of stock',
  size: 'Size / fit not available',
  price: 'Price / budget',
  variant: 'Colour, design or model',
  quality: 'Quality concern',
  service: 'Service experience',
  general: 'General follow-up',
};

/** Placeholders usable inside a template body. */
export const TEMPLATE_PLACEHOLDERS = ['{shop}', '{category}', '{size}', '{reason}', '{customer_type}'];

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  stock: 'We are restocking {category} shortly. Shall I reserve one for you and message you the moment it arrives?',
  size: 'We can arrange the right size {size} for you. Would you like me to book it in your name?',
  price: 'We have a better offer running on this now. Would you like me to share the revised price and options in your budget?',
  variant: 'We just received new colours and designs in this range. Can I share a few photos that match what you were looking for?',
  quality: 'Sorry about that experience. We have fresh stock now and I would personally check it for you. May I keep a piece aside?',
  service: 'Sorry for the inconvenience during your visit. Could you share what went wrong so we can fix it and make your next visit smooth?',
  general: 'Could you let us know what would have made this purchase work for you? We would love to arrange it on your next visit.',
};

/** Chooses the template that best matches the logged lost reason. */
export const matchTemplateKey = (ctx: FollowUpContext): TemplateKey => {
  const hay = `${lower(ctx.reason)} ${lower(ctx.category)} ${lower(ctx.notes)}`;
  if (/(stock|unavailab|not available|sold out|out of)/.test(hay)) return 'stock';
  if (/(size|fit|small|large|medium)/.test(hay)) return 'size';
  if (/(price|cost|expensive|budget|discount|offer)/.test(hay)) return 'price';
  if (/(colour|color|design|model|variant|style)/.test(hay)) return 'variant';
  if (/(quality|damage|defect|torn|broken)/.test(hay)) return 'quality';
  if (/(service|staff|wait|queue|billing|slow|rude)/.test(hay)) return 'service';
  return 'general';
};

const fill = (tpl: string, ctx: FollowUpContext): string =>
  tpl
    .replace(/\{shop\}/g, ctx.shopName && ctx.shopName !== 'Unknown' ? ctx.shopName : 'our store')
    .replace(/\{category\}/g, ctx.category && ctx.category !== 'Unknown' ? ctx.category : 'this item')
    .replace(/\{size\}/g, ctx.size && ctx.size !== 'Unknown' ? `(${ctx.size})` : '')
    .replace(/\{customer_type\}/g, ctx.customerType && ctx.customerType !== 'Unknown' ? ctx.customerType : '')
    .replace(/\{reason\}/g, ctx.reason && ctx.reason !== 'Unknown' ? ctx.reason : 'your feedback')
    .replace(/[ ]{2,}/g, ' ')
    .trim();

/** Same as buildFollowUpMessage but uses the admin's saved template set. */
export const buildFollowUpMessageWithTemplates = (
  ctx: FollowUpContext,
  templates: Partial<Record<TemplateKey, string>> | undefined,
  key?: TemplateKey,
  anomalyNote?: string,
): string => {
  const chosen = key || matchTemplateKey(ctx);
  const body = fill(templates?.[chosen] || DEFAULT_TEMPLATES[chosen], ctx);
  const base = buildFollowUpMessage(ctx);
  const withoutAsk = base.split('\n').slice(0, -(ctx.reporterName ? 2 : 1)).join('\n').replace(/\s+$/, '');
  const lines = [withoutAsk, ''];
  if (anomalyNote) lines.push(anomalyNote, '');
  lines.push(body);
  if (ctx.reporterName) {
    const shop = ctx.shopName && ctx.shopName !== 'Unknown' ? ctx.shopName : 'our store';
    lines.push(`- ${ctx.reporterName}, ${shop}`);
  }
  return lines.join('\n');
};

export const buildFollowUpLinkFromText = (phone: string, text: string): string =>
  `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(text)}`;
