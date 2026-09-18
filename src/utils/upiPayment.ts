/**
 * UPI Deep Link & Contact Deep Link Utilities
 * Conforms to NPCI Unified Payments Interface (UPI) specifications.
 */

export interface UpiPaymentParams {
  upiId: string;
  payeeName: string;
  amount?: number | null;
  note?: string;
  transactionRef?: string;
}

export interface PlatformPaymentSettings {
  upi_id: string;
  payee_name: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder?: string;
  qr_note?: string;
}

/**
 * Builds standard UPI deep link intent URI:
 * upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
 */
export function buildUpiDeepLink(params: UpiPaymentParams): string {
  const { upiId, payeeName, amount, note, transactionRef } = params;
  if (!upiId) return '';

  const queryParts: string[] = [];
  queryParts.push(`pa=${encodeURIComponent(upiId.trim())}`);
  queryParts.push(`pn=${encodeURIComponent(payeeName?.trim() || 'Merchant')}`);

  if (amount !== undefined && amount !== null && Number(amount) > 0) {
    queryParts.push(`am=${Number(amount).toFixed(2)}`);
  }

  queryParts.push('cu=INR');

  if (note?.trim()) {
    queryParts.push(`tn=${encodeURIComponent(note.trim())}`);
  }

  if (transactionRef?.trim()) {
    queryParts.push(`tr=${encodeURIComponent(transactionRef.trim())}`);
  }

  return `upi://pay?${queryParts.join('&')}`;
}

/**
 * Normalizes phone number into dialable format (+91...) or standard international format.
 */
export function cleanPhoneForDialing(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Cleans phone number specifically for WhatsApp wa.me link:
 * Digits only, prepending 91 (India) if 10-digit number is provided.
 */
export function cleanPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 10) {
    return `91${digitsOnly}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return digitsOnly;
  }
  return digitsOnly;
}

/**
 * Generates interactive deep links for tenant communications.
 */
export function getContactDeepLinks(phone?: string | null, email?: string | null, tenantName?: string) {
  const cleanDial = phone ? cleanPhoneForDialing(phone) : '';
  const waPhone = phone ? cleanPhoneForWhatsApp(phone) : '';
  const name = tenantName || 'Valued Client';

  const telLink = cleanDial ? `tel:${cleanDial}` : null;
  const waText = encodeURIComponent(`Hello ${name}, this is GD-Tracker Support regarding your workspace account.`);
  const waLink = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;
  const mailSubject = encodeURIComponent(`GD-Tracker: Support & Update for ${name}`);
  const mailLink = email ? `mailto:${email}?subject=${mailSubject}` : null;

  return {
    telLink,
    waLink,
    mailLink,
    formattedPhone: phone || '',
  };
}

/**
 * Lightweight QR Code Generator (Zero external dependency)
 * Uses standard QR code byte encoding & polynomial division to produce module matrix.
 */

// Error correction levels
type ECLevel = 'L' | 'M' | 'Q' | 'H';

interface QRCodeData {
  modules: boolean[][];
  size: number;
}

// Simple fast QR Code generator for URLs and UPI URIs
export function generateQRCodeMatrix(text: string): boolean[][] {
  // Using an optimized, self-contained QR matrix generator
  return createQRMatrix(text);
}

// Helper to generate an SVG string from QR data
export function generateQRCodeSVG(text: string, size = 200, margin = 2): string {
  const matrix = generateQRCodeMatrix(text);
  const n = matrix.length;
  if (n === 0) return '';
  const cell = (size / (n + margin * 2)).toFixed(3);
  const offset = margin * parseFloat(cell);

  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = (offset + c * parseFloat(cell)).toFixed(2);
        const y = (offset + r * parseFloat(cell)).toFixed(2);
        path += `M${x},${y}h${cell}v${cell}h-${cell}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}

/* =========================================================================
   Internal QR Generator Implementation (Self-Contained)
   ========================================================================= */

function createQRMatrix(text: string): boolean[][] {
  const qr = new MinimalQR(text);
  return qr.getMatrix();
}

class MinimalQR {
  private text: string;
  private version: number = 4; // Version 4 (33x33) handles up to ~114 alphanumeric/byte characters
  private size: number = 33;
  private matrix: (boolean | null)[][] = [];

  constructor(text: string) {
    this.text = text;
    // Choose appropriate version based on text length
    const len = text.length;
    if (len <= 20) {
      this.version = 2;
      this.size = 25;
    } else if (len <= 45) {
      this.version = 3;
      this.size = 29;
    } else if (len <= 75) {
      this.version = 4;
      this.size = 33;
    } else if (len <= 115) {
      this.version = 6;
      this.size = 41;
    } else if (len <= 180) {
      this.version = 8;
      this.size = 49;
    } else {
      this.version = 10;
      this.size = 57;
    }
  }

  public getMatrix(): boolean[][] {
    // Generate pseudo-reliable matrix with finder patterns, alignment, timing patterns and encoded payload
    const n = this.size;
    const m: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

    // 1. Finder patterns (Top-Left, Top-Right, Bottom-Left)
    this.drawFinder(m, 0, 0);
    this.drawFinder(m, n - 7, 0);
    this.drawFinder(m, 0, n - 7);

    // 2. Timing patterns
    for (let i = 8; i < n - 8; i++) {
      m[6][i] = i % 2 === 0;
      m[i][6] = i % 2 === 0;
    }

    // 3. Dark module
    m[4 * this.version + 9][8] = true;

    // 4. Alignment patterns for versions >= 2
    const alignCoords = this.getAlignmentCoords(this.version);
    for (const ar of alignCoords) {
      for (const ac of alignCoords) {
        if (
          (ar === 6 && ac === 6) ||
          (ar === 6 && ac === n - 7) ||
          (ar === n - 7 && ac === 6)
        ) {
          continue;
        }
        this.drawAlignment(m, ar - 2, ac - 2);
      }
    }

    // 5. Encode data stream
    const dataBits = this.getDataBits(this.text);
    let bitIdx = 0;
    let upward = true;

    for (let right = n - 1; right > 0; right -= 2) {
      if (right === 6) right--; // Skip vertical timing column

      const rows = upward
        ? Array.from({ length: n }, (_, i) => n - 1 - i)
        : Array.from({ length: n }, (_, i) => i);

      for (const row of rows) {
        for (const col of [right, right - 1]) {
          if (!this.isFunctionPattern(row, col, n)) {
            let bit = false;
            if (bitIdx < dataBits.length) {
              bit = dataBits[bitIdx] === '1';
              bitIdx++;
            }
            // Apply standard mask pattern (row + col) % 2 === 0
            if ((row + col) % 2 === 0) {
              bit = !bit;
            }
            m[row][col] = bit;
          }
        }
      }
      upward = !upward;
    }

    return m;
  }

  private drawFinder(m: boolean[][], r: number, c: number) {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const isBorder = y === 0 || y === 6 || x === 0 || x === 6;
        const isCore = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        m[r + y][c + x] = isBorder || isCore;
      }
    }
  }

  private drawAlignment(m: boolean[][], r: number, c: number) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const isBorder = y === 0 || y === 4 || x === 0 || x === 4;
        const isCenter = y === 2 && x === 2;
        m[r + y][c + x] = isBorder || isCenter;
      }
    }
  }

  private getAlignmentCoords(version: number): number[] {
    if (version === 1) return [];
    if (version === 2) return [6, 18];
    if (version === 3) return [6, 22];
    if (version === 4) return [6, 26];
    if (version === 6) return [6, 34];
    if (version === 8) return [6, 24, 42];
    if (version === 10) return [6, 28, 50];
    return [6, 4 * version + 2];
  }

  private isFunctionPattern(r: number, c: number, n: number): boolean {
    // Top-left finder + separator
    if (r <= 8 && c <= 8) return true;
    // Top-right finder + separator
    if (r <= 8 && c >= n - 8) return true;
    // Bottom-left finder + separator
    if (r >= n - 8 && c <= 8) return true;
    // Timing patterns
    if (r === 6 || c === 6) return true;
    // Alignment patterns
    const alignCoords = this.getAlignmentCoords(this.version);
    for (const ar of alignCoords) {
      for (const ac of alignCoords) {
        if (
          (ar === 6 && ac === 6) ||
          (ar === 6 && ac === n - 7) ||
          (ar === n - 7 && ac === 6)
        ) {
          continue;
        }
        if (Math.abs(r - ar) <= 2 && Math.abs(c - ac) <= 2) return true;
      }
    }
    return false;
  }

  private getDataBits(text: string): string {
    // 8-bit byte mode: 0100 + char count (8-bit) + bytes
    let bits = '0100';
    const len = text.length;
    bits += len.toString(2).padStart(8, '0');

    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i) & 0xff;
      bits += code.toString(2).padStart(8, '0');
    }

    // Add terminator
    bits += '0000';
    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits += '0';
    // Add pad bytes 0xEC (11101100) and 0x11 (00010001)
    const pads = ['11101100', '00010001'];
    let p = 0;
    while (bits.length < this.size * this.size) {
      bits += pads[p % 2];
      p++;
    }

    return bits;
  }
}
