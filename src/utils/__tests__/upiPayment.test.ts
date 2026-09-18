import { describe, it, expect } from 'vitest';
import {
  buildUpiDeepLink,
  cleanPhoneForDialing,
  cleanPhoneForWhatsApp,
  getContactDeepLinks,
  generateQRCodeSVG,
} from '../upiPayment';

describe('upiPayment utilities', () => {
  it('should build valid UPI deep links with required and optional parameters', () => {
    const upiLink = buildUpiDeepLink({
      upiId: 'admin@okaxis',
      payeeName: 'GD Tracker',
      amount: 2999,
      note: 'Monthly Plan Subscription',
    });

    expect(upiLink).toContain('upi://pay?');
    expect(upiLink).toContain('pa=admin%40okaxis');
    expect(upiLink).toContain('pn=GD%20Tracker');
    expect(upiLink).toContain('am=2999.00');
    expect(upiLink).toContain('cu=INR');
    expect(upiLink).toContain('tn=Monthly%20Plan%20Subscription');
  });

  it('should format clean phone numbers for dialing', () => {
    expect(cleanPhoneForDialing('+91 98765-43210')).toBe('+919876543210');
    expect(cleanPhoneForDialing('098765 43210')).toBe('09876543210');
  });

  it('should format 10-digit Indian numbers with 91 for WhatsApp', () => {
    expect(cleanPhoneForWhatsApp('9876543210')).toBe('919876543210');
    expect(cleanPhoneForWhatsApp('+91 9876543210')).toBe('919876543210');
    expect(cleanPhoneForWhatsApp('919876543210')).toBe('919876543210');
  });

  it('should generate deep contact links for Super Admin', () => {
    const links = getContactDeepLinks('9876543210', 'tenant@test.com', 'Acme Store');
    expect(links.telLink).toBe('tel:9876543210');
    expect(links.waLink).toContain('https://wa.me/919876543210?text=');
    expect(links.waLink).toContain('Acme%20Store');
    expect(links.mailLink).toContain('mailto:tenant@test.com?subject=');
  });

  it('should generate SVG QR code string', () => {
    const svg = generateQRCodeSVG('upi://pay?pa=test@upi&pn=Test&am=100.00&cu=INR');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<path');
  });
});
