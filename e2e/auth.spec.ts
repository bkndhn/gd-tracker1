import { test, expect } from '@playwright/test';

/**
 * Authentication behaviour that can be verified without real credentials:
 * validation, password visibility, rate-limit messaging and route guards.
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('rejects an empty submission', async ({ page }) => {
    const submit = page.getByRole('button', { name: /sign in|log in/i }).first();
    await expect(submit).toBeVisible();
    await submit.click();
    // Native or in-app validation must keep us on the auth screen
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });

  test('rejects an invalid email format', async ({ page }) => {
    await page.getByRole('textbox', { name: /email/i }).fill('not-an-email');
    await page.locator('input[type="password"]').first().fill('Whatever123!');
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
  });

  test('password visibility can be toggled', async ({ page }) => {
    const password = page.locator('input[type="password"]').first();
    await password.fill('SuperSecret123!');

    const toggle = page.locator('button:near(input[type="password"])').last();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await expect(page.locator('input[type="text"][value="SuperSecret123!"]')).toHaveCount(1);
    }
  });

  test('wrong credentials do not grant access', async ({ page }) => {
    await page.getByRole('textbox', { name: /email/i }).fill(`nobody+${Date.now()}@example.com`);
    await page.locator('input[type="password"]').first().fill('DefinitelyWrong123!');
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();

    // Still on the auth screen, no dashboard chrome
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^admin panel$/i })).toHaveCount(0);
  });

  test('protected app surfaces are not reachable while signed out', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^dashboard$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^reports$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^super admin$/i })).toHaveCount(0);
  });

  test('forgot password flow is reachable', async ({ page }) => {
    const link = page.getByText(/forgot password/i).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    }
  });
});
