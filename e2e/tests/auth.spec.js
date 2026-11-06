const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const path = require('path');

// Unauthenticated tests: clear storage state
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('TC-AUTH-01 register with a new email succeeds, same email again is rejected', async ({ page }) => {
    const uniqueEmail = `e2e-user-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
    const password = 'Password@123';

    // 1. First registration succeeds
    await page.goto('/register');
    await page.fill('#name', 'Test Learner');
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', password);
    await page.fill('#confirmPassword', password);
    await page.click('button[type="submit"]');

    const alert = page.locator('div[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toContainText(/Account created successfully/i);

    // 2. Same email again is rejected (409)
    await page.goto('/register');
    await page.fill('#name', 'Duplicate Learner');
    await page.fill('#email', uniqueEmail);
    await page.fill('#password', password);
    await page.fill('#confirmPassword', password);
    await page.click('button[type="submit"]');

    await expect(alert).toContainText(/already registered/i);

    // 3. Complete email verification flow (adapted per auth verification requirement)
    const prisma = require(path.join(__dirname, '..', '..', 'backend', 'src', 'lib', 'prisma'));
    const rawToken = 'verify-' + crypto.randomBytes(16).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.user.update({
      where: { email: uniqueEmail },
      data: {
        verificationTokenHash: tokenHash,
        verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await page.goto(`/verify-email?token=${rawToken}`);
    await expect(page.locator('text=Your email is verified')).toBeVisible();

    const verifiedUser = await prisma.user.findUnique({ where: { email: uniqueEmail } });
    expect(verifiedUser.verified).toBe(true);
  });

  test('TC-AUTH-03 wrong password shows an error and stores no token', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'learner1@example.com');
    await page.fill('#password', 'WrongPassword999!');
    await page.click('button[type="submit"]');

    const alert = page.locator('div[role="alert"]:not(#__next-route-announcer__)');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid email or password|Login failed|Too many requests/i);

    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
