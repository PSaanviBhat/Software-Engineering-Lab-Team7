const { test, expect } = require('@playwright/test');
const path = require('path');

const prisma = require(path.join(__dirname, '..', '..', 'backend', 'src', 'lib', 'prisma'));
const tutorAuthFile = path.join(__dirname, '..', '.auth', 'tutor.json');
test.use({ storageState: tutorAuthFile });

function getFutureDateString(daysAhead) {
  const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe('Tutor Slots Management', () => {
  test.beforeEach(async () => {
    // Ensure clean state from any aborted runs
    await prisma.slot.deleteMany({
      where: {
        OR: [
          { subject: { startsWith: 'REC-TEST-' } },
          { subject: { startsWith: 'EDIT-DEL-' } },
        ],
      },
    });
  });

  test('TC-SLOT-02 tutor creates weekly recurring slots on /my-slots (repeat 4 weeks) and 4 slots appear', async ({ page }, testInfo) => {
    await page.goto('/my-slots');

    const uniqueSubject = `REC-TEST-${Date.now()}-${testInfo.workerIndex}`;
    // Isolated days ahead per worker
    const daysAhead = 40 + (testInfo.workerIndex * 5);
    const dateStr = getFutureDateString(daysAhead);
    const startHourStr = '15:00';
    const endHourStr = '16:00';

    try {
      await page.fill('#subject', uniqueSubject);
      await page.fill('#date', dateStr);
      await page.fill('#startTime', startHourStr);
      await page.fill('#endTime', endHourStr);
      await page.selectOption('#mode', 'ONLINE');
      await page.fill('#repeatWeeks', '4');
      await page.fill('#link', 'https://meet.example.com/weekly');

      await page.click('button[type="submit"]:has-text("Create")');

      // Assert success message
      await expect(page.locator('role=status')).toContainText(/Created 4 slots/i);

      // Assert 4 slots with this subject appear in the list
      const slotItems = page.locator(`li:has-text("${uniqueSubject}")`);
      await expect(slotItems).toHaveCount(4, { timeout: 10000 });
    } finally {
      // Clean up created recurring slots
      await prisma.slot.deleteMany({ where: { subject: uniqueSubject } });
    }
  });

  test('TC-SLOT-04 tutor edits a free slot and deletes a slot on /my-slots', async ({ page }, testInfo) => {
    await page.goto('/my-slots');

    // 1. Create a dedicated slot to edit and delete
    const uniqueSubject = `EDIT-DEL-${Date.now()}-${testInfo.workerIndex}`;
    const daysAhead = 70 + (testInfo.workerIndex * 3);
    const dateStr = getFutureDateString(daysAhead);

    try {
      await page.fill('#subject', uniqueSubject);
      await page.fill('#date', dateStr);
      await page.fill('#startTime', '10:00');
      await page.fill('#endTime', '11:00');
      await page.selectOption('#mode', 'ONLINE');
      await page.fill('#repeatWeeks', '1');
      await page.fill('#link', 'https://meet.example.com/editdel');
      await page.click('button[type="submit"]:has-text("Create")');

      await expect(page.locator('role=status')).toContainText(/Created 1 slot/i);

      // 2. Locate the created slot and click Edit
      const slotItem = page.locator(`li:has-text("${uniqueSubject}")`).first();
      await expect(slotItem).toBeVisible({ timeout: 10000 });
      await slotItem.locator('button:has-text("Edit")').click();

      // 3. Edit form appears; update subject
      const editedSubject = `${uniqueSubject}-MOD`;
      const editSubjectInput = page.locator('#editSubject');
      await expect(editSubjectInput).toBeVisible();
      await editSubjectInput.fill(editedSubject);
      await page.click('button[type="submit"]:has-text("Save Changes")');

      // 4. Verify updated subject in slot list
      await expect(page.locator(`li:has-text("${editedSubject}")`)).toBeVisible({ timeout: 10000 });

      // 5. Delete the slot
      page.on('dialog', (dialog) => dialog.accept());
      const updatedSlotItem = page.locator(`li:has-text("${editedSubject}")`).first();
      await updatedSlotItem.locator('button:has-text("Delete")').click();

      // Verify deleted
      await expect(page.locator(`li:has-text("${editedSubject}")`)).toHaveCount(0, { timeout: 10000 });
    } finally {
      await prisma.slot.deleteMany({
        where: {
          OR: [
            { subject: uniqueSubject },
            { subject: `${uniqueSubject}-MOD` },
          ],
        },
      });
    }
  });
});
