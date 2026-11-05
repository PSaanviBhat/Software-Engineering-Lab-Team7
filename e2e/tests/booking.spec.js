const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const prisma = require(path.join(__dirname, '..', '..', 'backend', 'src', 'lib', 'prisma'));

test.describe('Booking', () => {
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

  test('TC-BOOK-01 learner books a free slot from the calendar, sees it in My bookings, slot shows as booked', async ({ page }, testInfo) => {
    const tutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } });
    const uniqueSubject = `BOOK-${Date.now()}-${testInfo.workerIndex}`;
    const dayOffset = 2 + ((testInfo.workerIndex * 2) % 12);
    const startUtc = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    startUtc.setUTCHours(18, 0, 0, 0);
    const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000);

    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: uniqueSubject,
        startUtc,
        endUtc,
        mode: 'ONLINE',
        link: 'https://meet.example.com/e2e',
      },
    });

    try {
      await page.goto('/calendar');
      await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 10000 });

      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/slots') && resp.url().includes(encodeURIComponent(uniqueSubject)) && resp.status() === 200
      );
      await page.fill('#subject', uniqueSubject);
      await responsePromise;

      const event = page.locator(`.fc-event:has-text("${uniqueSubject}")`);
      await expect(event).toBeVisible({ timeout: 10000 });

      await event.click();
      const dialog = page.locator('div[role="dialog"]');
      await expect(dialog).toBeVisible();

      const bookBtn = dialog.locator('button:has-text("Book")');
      await expect(bookBtn).toBeVisible();
      await bookBtn.click();

      await expect(page.locator('role=status')).toContainText(/Slot booked! You can see it under My bookings/i);

      await page.goto('/my-bookings');
      await expect(page.locator(`text=${uniqueSubject}`)).toBeVisible();

      await page.goto('/calendar');
      await expect(page.locator('.fc-event').first()).toBeVisible({ timeout: 10000 });

      const filterPromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/slots') && resp.url().includes(encodeURIComponent(uniqueSubject)) && resp.status() === 200
      );
      await page.fill('#subject', uniqueSubject);
      await filterPromise;

      const bookedEvent = page.locator(`.fc-event:has-text("${uniqueSubject}")`);
      await expect(bookedEvent).toBeVisible();
      await bookedEvent.click();

      await expect(page.locator('text=Already booked')).toBeVisible();
    } finally {
      await prisma.booking.deleteMany({ where: { slotId: slot.id } });
      await prisma.slot.deleteMany({ where: { id: slot.id } });
    }
  });

  test('TC-BOOK-05 cancel a booking from My bookings (use a slot more than 2 hours away)', async ({ page }, testInfo) => {
    const learnerNum = (testInfo.workerIndex % 15) + 1;
    const learner = await prisma.user.findUnique({ where: { email: `learner${learnerNum}@example.com` } });
    const tutor = await prisma.user.findFirst({ where: { role: 'TUTOR' } });
    const uniqueSubject = `CANCEL-${Date.now()}-${testInfo.workerIndex}`;
    const dayOffset = 3 + ((testInfo.workerIndex * 2) % 12);
    const startUtc = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    startUtc.setUTCHours(19, 0, 0, 0);
    const endUtc = new Date(startUtc.getTime() + 60 * 60 * 1000);

    const slot = await prisma.slot.create({
      data: {
        tutorId: tutor.id,
        subject: uniqueSubject,
        startUtc,
        endUtc,
        mode: 'ONLINE',
        status: 'BOOKED',
      },
    });

    const booking = await prisma.booking.create({
      data: {
        slotId: slot.id,
        learnerId: learner.id,
        status: 'CONFIRMED',
      },
    });

    try {
      await page.goto('/my-bookings');
      const bookingItem = page.locator(`li:has-text("${uniqueSubject}")`);
      await expect(bookingItem).toBeVisible({ timeout: 10000 });

      page.on('dialog', (dialog) => dialog.accept());
      const cancelBtn = bookingItem.locator('button:has-text("Cancel")');
      await cancelBtn.click();

      await expect(page.locator('role=status')).toContainText(/Booking cancelled/i);
      await expect(bookingItem.locator('text=Cancelled')).toBeVisible();
      await expect(bookingItem.locator('button:has-text("Cancel")')).toBeHidden();

      const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });
      expect(updatedBooking.status).toBe('CANCELLED');

      const updatedSlot = await prisma.slot.findUnique({ where: { id: slot.id } });
      expect(updatedSlot.status).toBe('FREE');
    } finally {
      await prisma.booking.deleteMany({ where: { id: booking.id } });
      await prisma.slot.deleteMany({ where: { id: slot.id } });
    }
  });
});
