const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const prisma = require(path.join(__dirname, '..', '..', 'backend', 'src', 'lib', 'prisma'));

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const learnerNum = (testInfo.workerIndex % 15) + 1;
    const authFile = path.join(__dirname, '..', '.auth', `learner-${learnerNum}.json`);
    if (fs.existsSync(authFile)) {
      const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      const token = state.origins[0].localStorage.find((x) => x.name === 'token')?.value;
      const user = state.origins[0].localStorage.find((x) => x.name === 'user')?.value;
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', user);
      }, { token, user });
    }
  });

  test('TC-CAL-02 filter subject = DBMS shows only DBMS slots', async ({ page }) => {
    await page.goto('/calendar');

    // Wait for initial events to load
    await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 10000 });

    // Set up response listener before typing filter
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/slots') && resp.url().includes('subject=DBMS') && resp.status() === 200
    );

    // Filter by subject = DBMS
    const subjectInput = page.locator('#subject');
    await subjectInput.fill('DBMS');

    // Wait for the filtered network response
    await responsePromise;

    // Small auto-wait to ensure FullCalendar re-rendered
    await expect(page.locator('.fc-event').first()).toBeVisible();

    // Verify all displayed events match DBMS
    const events = page.locator('.fc-event');
    const count = await events.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const text = await events.nth(i).innerText();
      expect(text).toContain('DBMS');
      expect(text).not.toContain('Networks');
      expect(text).not.toContain('DSA');
    }
  });

  test('TC-UX-02 a new user reaches a confirmed booking from the calendar in 3 clicks or fewer', async ({ page }, testInfo) => {
    // 1. Create a guaranteed free slot in the future to isolate test
    const tutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } });
    const uniqueSubject = `UX-${Date.now()}-${testInfo.workerIndex}`;
    const dayOffset = 5 + ((testInfo.workerIndex * 2) % 10);
    const startUtc = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    startUtc.setUTCHours(17, 0, 0, 0);
    const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000);

    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: uniqueSubject,
        startUtc,
        endUtc,
        mode: 'ONLINE',
      },
    });

    // Inject click tracker into page DOM
    await page.addInitScript(() => {
      window.__clickCounter = 0;
      window.addEventListener('click', () => {
        window.__clickCounter = (window.__clickCounter || 0) + 1;
      }, true);
    });

    try {
      await page.goto('/calendar');
      await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 10000 });

      // Filter to our specific slot so it's readily located
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/slots') && resp.url().includes(encodeURIComponent(uniqueSubject)) && resp.status() === 200
      );
      await page.fill('#subject', uniqueSubject);
      await responsePromise;

      // Reset click counter after search typing (prompt: "reaches a confirmed booking from the calendar in 3 clicks or fewer")
      await page.evaluate(() => { window.__clickCounter = 0; });

      // Click 1: Click on the free slot event
      const event = page.locator(`.fc-event:has-text("${uniqueSubject}")`);
      await expect(event).toBeVisible();
      await event.click();

      // Dialog appears
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();

      // Click 2: Click the "Book" button in the dialog
      const bookButton = dialog.locator('button:has-text("Book")');
      await expect(bookButton).toBeVisible();
      await bookButton.click();

      // Assert booking confirmed notice
      const statusNotice = page.locator('role=status');
      await expect(statusNotice).toContainText(/Slot booked! You can see it under My bookings/i);

      // Verify total click count to book from calendar is 3 or fewer (actually 2)
      const clicks = await page.evaluate(() => window.__clickCounter);
      expect(clicks).toBeLessThanOrEqual(3);
    } finally {
      // Cleanup
      await prisma.booking.deleteMany({ where: { slotId: slot.id } });
      await prisma.slot.deleteMany({ where: { id: slot.id } });
    }
  });
});
