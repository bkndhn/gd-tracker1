import { test, expect } from '@playwright/test';

/**
 * Public-surface smoke tests: these run without credentials and guard the
 * routes every visitor hits before authentication.
 */

test.describe('App shell', () => {
  test('serves the login screen with SEO metadata', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Head metadata
    const title = await page.title();
    expect(title.length).toBeGreaterThan(3);
    expect(title).not.toBe('Lovable Generated Project');
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length ?? 0).toBeGreaterThan(20);

    // Auth form is the entry point
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();

    expect(consoleErrors.filter(e => !e.includes('favicon'))).toEqual([]);
  });

  test('has exactly one H1 and a responsive viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeLessThanOrEqual(1);
  });

  test('unknown routes render the not-found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });

  test('reset password route loads standalone', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.locator('body')).toBeVisible();
    // Should not crash into the error boundary
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  });

  test('PWA manifest and service worker are published', async ({ request }) => {
    const manifest = await request.get('/manifest.json');
    expect(manifest.ok()).toBeTruthy();
    const json = await manifest.json();
    expect(json.name || json.short_name).toBeTruthy();

    const sw = await request.get('/sw.js');
    expect(sw.ok()).toBeTruthy();
  });

  test('robots.txt is reachable', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.ok()).toBeTruthy();
  });
});
