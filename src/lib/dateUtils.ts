/**
 * Indian Standard Time (IST, UTC+5:30) date & time utilities.
 *
 * Uses native Intl.DateTimeFormat with 'Asia/Kolkata' timezone to guarantee
 * consistent IST rendering and 12-hour AM/PM formatting across ALL devices:
 * - iOS Safari
 * - Android Chrome / WebView
 * - Windows, macOS, Linux browsers
 */

const IST_TIMEZONE = 'Asia/Kolkata';
const EN_IN_LOCALE = 'en-IN';

const isValidDate = (d: any): d is Date => {
  return d instanceof Date && !isNaN(d.getTime());
};

const toDate = (input: Date | string | number | null | undefined): Date | null => {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return isValidDate(d) ? d : null;
};

/**
 * Full IST Date & Time with AM/PM
 * Example: "17 Sep 2026, 01:20 PM"
 */
export const formatISTDateTime = (input: Date | string | number | null | undefined, fallback = '—'): string => {
  const d = toDate(input);
  if (!d) return fallback;

  try {
    const parts = new Intl.DateTimeFormat(EN_IN_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    let day = '', month = '', year = '', hour = '', minute = '', dayPeriod = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
      else if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    }

    return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return d.toLocaleString(EN_IN_LOCALE, { timeZone: IST_TIMEZONE, hour12: true });
  }
};

/**
 * Short IST Date & Time (without year) with AM/PM
 * Example: "17 Sep, 01:20 PM"
 */
export const formatISTShort = (input: Date | string | number | null | undefined, fallback = '—'): string => {
  const d = toDate(input);
  if (!d) return fallback;

  try {
    const parts = new Intl.DateTimeFormat(EN_IN_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    let day = '', month = '', hour = '', minute = '', dayPeriod = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    }

    return `${day} ${month}, ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return d.toLocaleString(EN_IN_LOCALE, { timeZone: IST_TIMEZONE, hour12: true });
  }
};

/**
 * IST Date Only
 * Example: "17 Sep 2026"
 */
export const formatISTDate = (input: Date | string | number | null | undefined, fallback = '—'): string => {
  const d = toDate(input);
  if (!d) return fallback;

  try {
    const parts = new Intl.DateTimeFormat(EN_IN_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).formatToParts(d);

    let day = '', month = '', year = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
    }

    return `${day} ${month} ${year}`;
  } catch {
    return d.toLocaleDateString(EN_IN_LOCALE, { timeZone: IST_TIMEZONE });
  }
};

/**
 * IST Time Only with AM/PM
 * Example: "01:20 PM"
 */
export const formatISTTime = (input: Date | string | number | null | undefined, fallback = '—'): string => {
  const d = toDate(input);
  if (!d) return fallback;

  try {
    const parts = new Intl.DateTimeFormat(EN_IN_LOCALE, {
      timeZone: IST_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    let hour = '', minute = '', dayPeriod = '';
    for (const p of parts) {
      if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    }

    return `${hour}:${minute} ${dayPeriod}`;
  } catch {
    return d.toLocaleTimeString(EN_IN_LOCALE, { timeZone: IST_TIMEZONE, hour12: true });
  }
};

/**
 * IST Formatted String for File Names
 * Example: "prefix-20260917-0120PM"
 */
export const formatISTFileName = (input: Date | string | number | null | undefined = new Date(), prefix = ''): string => {
  const d = toDate(input) || new Date();
  try {
    const parts = new Intl.DateTimeFormat(EN_IN_LOCALE, {
      timeZone: IST_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);

    let day = '', month = '', year = '', hour = '', minute = '', dayPeriod = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
      else if (p.type === 'hour') hour = p.value;
      else if (p.type === 'minute') minute = p.value;
      else if (p.type === 'dayPeriod') dayPeriod = p.value.toUpperCase();
    }

    const stamp = `${year}${month}${day}-${hour}${minute}${dayPeriod}`;
    return prefix ? `${prefix}-${stamp}` : stamp;
  } catch {
    return `${prefix || 'file'}-${Date.now()}`;
  }
};
